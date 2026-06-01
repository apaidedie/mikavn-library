use regex::Regex;
use std::sync::OnceLock;

use crate::db::models::NormalizedMetadata;
use crate::db::{DbError, DbResult};
use crate::services::metadata::cleaning::is_dlsite_id;
use crate::services::metadata::{make_result, metadata_from_result};

use super::{
    absolute_url, decode_html, extract_first_attr_by_selectors, extract_first_text_by_selectors,
    extract_labeled_value, extract_meta_content, http_client, normalize_date, split_values,
    strip_tags,
};

const MODES: [&str; 2] = ["maniax", "pro"];

pub fn search(
    query: &str,
    variants: &[String],
) -> DbResult<Vec<crate::db::models::MetadataSearchResult>> {
    let clean = query.trim();
    if is_dlsite_id(clean) {
        return detail_result(&clean.to_uppercase()).map(|item| vec![item]);
    }

    let client = http_client()?;
    let mut results = Vec::new();
    let mut seen = Vec::new();

    for variant in variants.iter().take(4) {
        if results.len() >= 5 {
            break;
        }
        let terms = dlsite_terms(variant);
        for term in terms.iter().take(3) {
            for mode in MODES {
                let url = format!(
                    "https://www.dlsite.com/{mode}/fsr/=/keyword/{}/order/trend",
                    url_encode(term)
                );
                let text = client
                    .get(url)
                    .header("Cookie", "adult_checked=1; locale=ja_JP")
                    .send()
                    .and_then(|resp| resp.error_for_status())
                    .map_err(|error| {
                        DbError::metadata_provider_failed(format!("DLsite search failed: {error}"))
                    })?
                    .text()
                    .map_err(|error| {
                        DbError::metadata_provider_failed(format!(
                            "DLsite response failed: {error}"
                        ))
                    })?;

                for (link, id, title) in parse_search_links(&text) {
                    if seen.contains(&id) {
                        continue;
                    }
                    let mut result = make_result("dlsite", id.clone(), title, link);
                    result.external_ids.dlsite = Some(id.clone());
                    results.push(result);
                    seen.push(id);
                    if results.len() >= 5 {
                        break;
                    }
                }
            }
        }
    }
    Ok(results)
}

pub fn detail(id: &str) -> DbResult<NormalizedMetadata> {
    detail_result(&id.to_uppercase()).map(|result| metadata_from_result(&result))
}

pub fn detail_result(id: &str) -> DbResult<crate::db::models::MetadataSearchResult> {
    let client = http_client()?;
    for mode in MODES {
        let url = format!("https://www.dlsite.com/{mode}/work/=/product_id/{id}.html");
        let resp = client
            .get(&url)
            .header("Cookie", "adult_checked=1; locale=ja_JP")
            .send()
            .map_err(|error| {
                DbError::metadata_provider_failed(format!("DLsite detail failed: {error}"))
            })?;
        if !resp.status().is_success() {
            continue;
        }
        let text = resp.text().map_err(|error| {
            DbError::metadata_provider_failed(format!("DLsite detail body failed: {error}"))
        })?;
        if !text.contains(id) {
            continue;
        }
        let title = extract_title(&text).unwrap_or_else(|| id.to_string());
        let mut result = make_result("dlsite", id.to_string(), title, url);
        result.image_url = extract_og_image(&text);
        result.description = extract_description(&text);
        result.release_date = extract_labeled_value(&text, &["販売日", "配信開始日", "発売日"])
            .and_then(|value| normalize_date(&value));
        result.developers = extract_labeled_value(&text, &["サークル名", "ブランド", "メーカー"])
            .map(|value| vec![value])
            .unwrap_or_default();
        result.tags = extract_tags(&text);
        result.external_ids.dlsite = Some(id.to_string());
        return Ok(result);
    }
    Err(DbError::metadata_provider_failed(format!(
        "DLsite item not found: {id}"
    )))
}

fn dlsite_terms(value: &str) -> Vec<String> {
    let compact = value
        .chars()
        .filter(|ch| {
            !matches!(
                ch,
                '[' | ']' | '(' | ')' | '（' | '）' | '【' | '】' | '~' | '～' | '！' | '!' | ' '
            )
        })
        .collect::<String>();
    let mut terms = vec![compact, value.to_string()];
    for part in value.split([
        '～', '~', '-', '—', '｜', '|', '/', '／', '《', '》', '「', '」', '『', '』', '【', '】',
        '[', ']', '(', ')', '（', '）',
    ]) {
        if part.trim().chars().count() >= 2 {
            terms.push(part.trim().to_string());
        }
    }
    dedup(terms)
}

fn parse_search_links(text: &str) -> Vec<(String, String, String)> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r#"href="(https://www\.dlsite\.com/[^"]+?/product_id/((?:RJ|VJ)\d+)\.html)"[^>]*?(?:title="(.*?)")?"#).unwrap());
    re.captures_iter(text)
        .filter_map(|cap| {
            let link = cap.get(1)?.as_str().to_string();
            let id = cap.get(2)?.as_str().to_string();
            let title = cap
                .get(3)
                .map(|m| decode_html(m.as_str()))
                .unwrap_or_else(|| id.clone());
            Some((link, id, title))
        })
        .collect()
}

fn extract_title(text: &str) -> Option<String> {
    if let Some(value) = extract_meta_content(text, &["og:title"]) {
        return Some(value);
    }
    if let Some(value) = extract_first_text_by_selectors(
        text,
        &[
            "#work_name",
            "h1#work_name",
            "h1.work_name",
            "h1[itemprop='name']",
            "h1",
        ],
    ) {
        return Some(value);
    }

    for pattern in [
        r#"<meta property="og:title" content="(.*?)""#,
        r#"<h1[^>]*id="work_name"[^>]*>(.*?)</h1>"#,
        r#"id="work_name"[^>]*>\s*<a[^>]*>(.*?)</a>"#,
    ] {
        let re = Regex::new(pattern).ok()?;
        if let Some(cap) = re.captures(text) {
            return cap.get(1).map(|m| strip_tags(&decode_html(m.as_str())));
        }
    }
    None
}

fn extract_description(text: &str) -> Option<String> {
    if let Some(value) = extract_first_text_by_selectors(
        text,
        &[
            "#work_intro",
            ".work_parts_area",
            "[itemprop='description']",
        ],
    ) {
        return Some(value);
    }

    for pattern in [
        r#"(?is)<div[^>]+id=["']work_intro["'][^>]*>(.*?)</div>"#,
        r#"(?is)<div[^>]+class=["'][^"']*work_parts_area[^"']*["'][^>]*>(.*?)</div>"#,
    ] {
        let re = Regex::new(pattern).ok()?;
        if let Some(cap) = re.captures(text) {
            let value = cap
                .get(1)
                .map(|m| strip_tags(m.as_str()))
                .unwrap_or_default();
            if !value.is_empty() {
                return Some(value);
            }
        }
    }
    extract_meta_content(text, &["description", "og:description"])
}

fn extract_tags(text: &str) -> Vec<String> {
    let mut tags = Vec::new();
    for label in ["ジャンル", "作品形式", "ファイル形式"] {
        if let Some(value) = extract_labeled_value(text, &[label]) {
            for item in split_values(&value) {
                if !tags.contains(&item) {
                    tags.push(item);
                }
            }
        }
    }
    tags
}

fn extract_og_image(text: &str) -> Option<String> {
    if let Some(value) = extract_first_attr_by_selectors(
        text,
        &["meta[property='og:image']", "meta[name='og:image']"],
        "content",
    ) {
        return Some(absolute_url(&value));
    }
    let re = Regex::new(r#"<meta property="og:image" content="(.*?)""#).ok()?;
    re.captures(text)
        .and_then(|cap| cap.get(1).map(|m| absolute_url(m.as_str())))
}

fn dedup(values: Vec<String>) -> Vec<String> {
    let mut result = Vec::new();
    for value in values {
        let value = value.trim().to_string();
        if !value.is_empty() && !result.contains(&value) {
            result.push(value);
        }
    }
    result
}

fn url_encode(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            b' ' => "%20".to_string(),
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_dlsite_detail_from_dom_fixture() {
        let html = r#"
            <html><head>
              <meta property="og:image" content="//img.dlsite.jp/modpub/images2/work/doujin/RJ01000000_img_main.jpg">
            </head><body>
              <h1 id="work_name">星之终途</h1>
              <div id="work_intro"><p>这是作品简介。<br>第二行。</p></div>
              <table>
                <tr><th>販売日</th><td>2022年09月30日</td></tr>
                <tr><th>サークル名</th><td><a>Key</a></td></tr>
                <tr><th>ジャンル</th><td><a>感動</a> / <a>ADV</a></td></tr>
              </table>
            </body></html>
        "#;

        assert_eq!(extract_title(html).as_deref(), Some("星之终途"));
        assert_eq!(
            extract_og_image(html).as_deref(),
            Some("https://img.dlsite.jp/modpub/images2/work/doujin/RJ01000000_img_main.jpg")
        );
        assert_eq!(
            extract_description(html).as_deref(),
            Some("这是作品简介。 第二行。")
        );
        assert_eq!(
            extract_labeled_value(html, &["販売日"])
                .and_then(|value| normalize_date(&value))
                .as_deref(),
            Some("2022-09-30")
        );
        assert_eq!(
            extract_labeled_value(html, &["サークル名"]).as_deref(),
            Some("Key")
        );
        assert_eq!(extract_tags(html), vec!["感動", "ADV"]);
    }
}
