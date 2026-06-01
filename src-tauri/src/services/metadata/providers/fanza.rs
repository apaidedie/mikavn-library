use regex::Regex;
use std::sync::OnceLock;

use crate::db::models::NormalizedMetadata;
use crate::db::{DbError, DbResult};
use crate::services::metadata::cleaning::is_fanza_id;
use crate::services::metadata::{make_result, metadata_from_result};

use super::{
    absolute_url, decode_html, extract_first_attr_by_selectors, extract_first_text_by_selectors,
    extract_labeled_value, extract_meta_content, http_client, normalize_date, split_values,
    strip_tags,
};

pub fn search(
    query: &str,
    variants: &[String],
) -> DbResult<Vec<crate::db::models::MetadataSearchResult>> {
    let clean = query.trim();
    if is_fanza_id(clean) {
        return detail_result(&clean.to_lowercase()).map(|item| vec![item]);
    }

    let client = http_client()?;
    let mut results = Vec::new();
    let mut seen = Vec::new();

    for variant in variants.iter().take(4) {
        let url = format!(
            "https://www.dmm.co.jp/search/=/searchstr={}/floor=digital/group=adult/",
            url_encode(variant)
        );
        let text = client
            .get(url)
            .header("Cookie", "age_check_done=1")
            .send()
            .and_then(|resp| resp.error_for_status())
            .map_err(|error| {
                DbError::metadata_provider_failed(format!("FANZA search failed: {error}"))
            })?
            .text()
            .map_err(|error| {
                DbError::metadata_provider_failed(format!("FANZA response failed: {error}"))
            })?;

        for (id, title) in parse_links(&text) {
            if seen.contains(&id) {
                continue;
            }
            let mut result = make_result(
                "fanza",
                id.clone(),
                clean_title_prefix(&title),
                detail_url(&id),
            );
            result.external_ids.fanza = Some(id.clone());
            results.push(result);
            seen.push(id);
            if results.len() >= 5 {
                break;
            }
        }
        if !results.is_empty() {
            break;
        }
    }

    Ok(results)
}

pub fn detail(id: &str) -> DbResult<NormalizedMetadata> {
    detail_result(&id.to_lowercase()).map(|result| metadata_from_result(&result))
}

pub fn detail_result(id: &str) -> DbResult<crate::db::models::MetadataSearchResult> {
    let client = http_client()?;
    let url = detail_url(id);
    let text = client
        .get(&url)
        .header("Cookie", "age_check_done=1")
        .send()
        .and_then(|resp| resp.error_for_status())
        .map_err(|error| {
            DbError::metadata_provider_failed(format!("FANZA detail failed: {error}"))
        })?
        .text()
        .map_err(|error| {
            DbError::metadata_provider_failed(format!("FANZA detail body failed: {error}"))
        })?;
    let title = extract_title(&text)
        .ok_or_else(|| DbError::metadata_provider_failed(format!("FANZA title not found: {id}")))?;
    let mut result = make_result("fanza", id.to_string(), clean_title_prefix(&title), url);
    result.image_url = extract_og_image(&text);
    result.description = extract_description(&text);
    result.release_date = extract_labeled_value(&text, &["配信開始日", "発売日", "販売日"])
        .and_then(|value| normalize_date(&value));
    result.developers = extract_labeled_value(&text, &["ブランド", "メーカー", "サークル"])
        .map(|value| vec![value])
        .unwrap_or_default();
    result.tags = extract_tags(&text);
    result.external_ids.fanza = Some(id.to_string());
    Ok(result)
}

fn detail_url(id: &str) -> String {
    format!("https://dlsoft.dmm.co.jp/detail/{id}/")
}

fn parse_links(text: &str) -> Vec<(String, String)> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| {
        Regex::new(r#"href="[^"]*/detail/([a-zA-Z0-9_]+)/?"[^>]*>(.*?)</a>"#).unwrap()
    });
    re.captures_iter(text)
        .filter_map(|cap| {
            let id = cap.get(1)?.as_str().to_lowercase();
            let title = strip_tags(&decode_html(cap.get(2)?.as_str()));
            if title.is_empty() {
                None
            } else {
                Some((id, title))
            }
        })
        .collect()
}

fn extract_title(text: &str) -> Option<String> {
    if let Some(value) = extract_meta_content(text, &["og:title"]) {
        return Some(value);
    }
    if let Some(value) = extract_first_text_by_selectors(
        text,
        &["#title", ".productTitle__txt", "h1.productTitle__txt", "h1"],
    ) {
        return Some(value);
    }

    for pattern in [
        r#"<meta property="og:title" content="(.*?)""#,
        r#"<h1[^>]*id="title"[^>]*>(.*?)</h1>"#,
        r#"<h1[^>]*class="productTitle__txt"[^>]*>(.*?)</h1>"#,
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
            "section.summary",
            ".summary",
            ".mg-b20",
            "[itemprop='description']",
        ],
    ) {
        if value.chars().count() > 12 {
            return Some(value);
        }
    }

    for pattern in [
        r#"(?is)<div[^>]+class=["'][^"']*mg-b20[^"']*["'][^>]*>(.*?)</div>"#,
        r#"(?is)<section[^>]+class=["'][^"']*summary[^"']*["'][^>]*>(.*?)</section>"#,
    ] {
        let re = Regex::new(pattern).ok()?;
        if let Some(cap) = re.captures(text) {
            let value = cap
                .get(1)
                .map(|m| strip_tags(m.as_str()))
                .unwrap_or_default();
            if value.chars().count() > 12 {
                return Some(value);
            }
        }
    }
    extract_meta_content(text, &["description", "og:description"])
}

fn extract_tags(text: &str) -> Vec<String> {
    let mut tags = Vec::new();
    for label in ["ジャンル", "カテゴリ", "品番"] {
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

fn clean_title_prefix(value: &str) -> String {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| {
        Regex::new(r"^(?:【[^】]+】)?(?:デジタル\|?)?(?:還元)?(?:アダルト)?(?:PC)?(?:ゲーム)?\s*")
            .unwrap()
    });
    let cleaned = re.replace(value, "");
    let suffix = Regex::new(r"\s*[-|｜].*(?:DMM|FANZA).*$").unwrap();
    suffix.replace(&cleaned, "").trim().to_string()
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
    fn extracts_fanza_detail_from_dom_fixture() {
        let html = r#"
            <html><head>
              <meta property="og:image" content="https://pics.dmm.co.jp/digital/pcgame/abc_1234/abc_1234pl.jpg">
            </head><body>
              <h1 class="productTitle__txt">PCゲーム 星之终途 - FANZA</h1>
              <section class="summary">これはFANZAの作品紹介テキストです。十分な長さがあります。</section>
              <table>
                <tr><th>配信開始日</th><td>2022/09/30</td></tr>
                <tr><th>ブランド</th><td><a>Key</a></td></tr>
                <tr><th>ジャンル</th><td><a>感動</a>、<a>ADV</a></td></tr>
              </table>
            </body></html>
        "#;

        assert_eq!(
            extract_title(html)
                .map(|value| clean_title_prefix(&value))
                .as_deref(),
            Some("星之终途")
        );
        assert_eq!(
            extract_og_image(html).as_deref(),
            Some("https://pics.dmm.co.jp/digital/pcgame/abc_1234/abc_1234pl.jpg")
        );
        assert_eq!(
            extract_description(html).as_deref(),
            Some("これはFANZAの作品紹介テキストです。十分な長さがあります。")
        );
        assert_eq!(
            extract_labeled_value(html, &["配信開始日"])
                .and_then(|value| normalize_date(&value))
                .as_deref(),
            Some("2022-09-30")
        );
        assert_eq!(
            extract_labeled_value(html, &["ブランド"]).as_deref(),
            Some("Key")
        );
        assert_eq!(extract_tags(html), vec!["感動", "ADV"]);
    }
}
