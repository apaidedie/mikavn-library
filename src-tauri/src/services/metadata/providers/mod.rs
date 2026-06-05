pub mod dlsite;
pub mod fanza;
pub mod vndb;

use regex::Regex;
use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use scraper::{Html, Selector};
use std::time::Duration;

use crate::db::{DbError, DbResult};

pub fn http_client() -> DbResult<Client> {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("MikaVN-Library/0.1"));
    Client::builder()
        .default_headers(headers)
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|error| {
            DbError::metadata_provider_failed(format!("failed to build HTTP client: {error}"))
        })
}

pub fn absolute_url(value: &str) -> String {
    if value.starts_with("//") {
        format!("https:{value}")
    } else {
        value.to_string()
    }
}

pub fn decode_html(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .trim()
        .to_string()
}

pub fn strip_tags(value: &str) -> String {
    let with_spaces = Regex::new(r"(?i)<\s*br\s*/?>|</\s*(?:a|span|li|dd|td|p|div)\s*>")
        .unwrap()
        .replace_all(value, " ");
    let stripped = Regex::new(r"<[^>]+>")
        .unwrap()
        .replace_all(&with_spaces, " ");
    collapse_spaces(&decode_html(&stripped))
}

pub fn extract_meta_content(text: &str, keys: &[&str]) -> Option<String> {
    if let Some(value) = extract_meta_content_dom(text, keys) {
        return Some(value);
    }

    for key in keys {
        let pattern = format!(
            r#"(?is)<meta[^>]+(?:name|property)=["']{}["'][^>]+content=["'](.*?)["']"#,
            regex::escape(key)
        );
        let re = Regex::new(&pattern).ok()?;
        if let Some(cap) = re.captures(text) {
            let value = cap
                .get(1)
                .map(|m| strip_tags(m.as_str()))
                .unwrap_or_default();
            if !value.is_empty() {
                return Some(value);
            }
        }

        let reverse = format!(
            r#"(?is)<meta[^>]+content=["'](.*?)["'][^>]+(?:name|property)=["']{}["']"#,
            regex::escape(key)
        );
        let re = Regex::new(&reverse).ok()?;
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
    None
}

pub fn extract_meta_content_dom(text: &str, keys: &[&str]) -> Option<String> {
    let document = Html::parse_document(text);
    let selector = Selector::parse("meta").ok()?;
    for element in document.select(&selector) {
        let value = element.value();
        let meta_key = value.attr("name").or_else(|| value.attr("property"));
        if meta_key.is_some_and(|key| {
            keys.iter()
                .any(|candidate| candidate.eq_ignore_ascii_case(key))
        }) {
            if let Some(content) = value.attr("content") {
                let content = strip_tags(content);
                if !content.is_empty() {
                    return Some(content);
                }
            }
        }
    }
    None
}

pub fn extract_first_text_by_selectors(text: &str, selectors: &[&str]) -> Option<String> {
    let document = Html::parse_document(text);
    for selector in selectors {
        let selector = Selector::parse(selector).ok()?;
        for element in document.select(&selector) {
            let value = element.text().collect::<Vec<_>>().join(" ");
            let value = collapse_spaces(&decode_html(&value));
            if !value.is_empty() {
                return Some(value);
            }
        }
    }
    None
}

pub fn extract_first_rich_text_by_selectors(text: &str, selectors: &[&str]) -> Option<String> {
    let document = Html::parse_document(text);
    for selector in selectors {
        let selector = Selector::parse(selector).ok()?;
        for element in document.select(&selector) {
            let value = html_to_description_text(&element.html());
            if !value.is_empty() {
                return Some(value);
            }
        }
    }
    None
}

pub fn html_to_description_text(value: &str) -> String {
    let without_noise = Regex::new(
        r"(?is)<\s*(?:script|style|noscript)\b[^>]*>.*?</\s*(?:script|style|noscript)\s*>",
    )
    .unwrap()
    .replace_all(value, " ");
    let with_images = Regex::new(r"(?is)<\s*img\b[^>]*>").unwrap().replace_all(
        &without_noise,
        |caps: &regex::Captures| {
            let tag = caps.get(0).map(|m| m.as_str()).unwrap_or_default();
            image_markdown_from_tag(tag)
                .map(|markdown| format!("\n\n{markdown}\n\n"))
                .unwrap_or_else(|| "\n\n".to_string())
        },
    );
    let with_line_breaks = Regex::new(r"(?i)<\s*br\s*/?\s*>")
        .unwrap()
        .replace_all(&with_images, "\n");
    let with_blocks = Regex::new(r"(?i)</\s*(?:p|div|section|article|header|footer|li|ul|ol|tr|td|th|dd|dt|h[1-6]|blockquote)\s*>")
        .unwrap()
        .replace_all(&with_line_breaks, "\n");
    let stripped = Regex::new(r"<[^>]+>")
        .unwrap()
        .replace_all(&with_blocks, " ");
    normalize_description_lines(&decode_html(&stripped))
}

fn image_markdown_from_tag(tag: &str) -> Option<String> {
    let src = extract_html_attr(
        tag,
        &[
            "src",
            "data-src",
            "data-original",
            "data-lazy-src",
            "data-srcset",
        ],
    )?;
    let src = first_image_candidate(&src)?;
    let alt = extract_html_attr(tag, &["alt", "title"])
        .map(|value| sanitize_markdown_alt(&decode_html(&value)))
        .unwrap_or_default();
    Some(format!("![{alt}]({})", absolute_url(&decode_html(&src))))
}

fn extract_html_attr(tag: &str, names: &[&str]) -> Option<String> {
    for name in names {
        let pattern = format!(
            r#"(?is)\b{}\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))"#,
            regex::escape(name)
        );
        let re = Regex::new(&pattern).ok()?;
        if let Some(cap) = re.captures(tag) {
            let value = cap
                .get(1)
                .or_else(|| cap.get(2))
                .or_else(|| cap.get(3))
                .map(|m| m.as_str().trim().to_string())
                .unwrap_or_default();
            if !value.is_empty() {
                return Some(value);
            }
        }
    }
    None
}

fn first_image_candidate(value: &str) -> Option<String> {
    value
        .split(',')
        .filter_map(|candidate| candidate.split_whitespace().next())
        .map(str::trim)
        .find(|candidate| !candidate.is_empty())
        .map(str::to_string)
}

fn sanitize_markdown_alt(value: &str) -> String {
    value
        .replace(['[', ']', '\r', '\n'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn normalize_description_lines(value: &str) -> String {
    let value = value.replace('\r', "\n");
    let mut lines = Vec::new();
    let mut previous_blank = true;

    for raw in value.lines() {
        let line = raw.split_whitespace().collect::<Vec<_>>().join(" ");
        if line.is_empty() {
            if !previous_blank && !lines.is_empty() {
                lines.push(String::new());
            }
            previous_blank = true;
            continue;
        }
        lines.push(line);
        previous_blank = false;
    }

    while lines.last().is_some_and(|line| line.is_empty()) {
        lines.pop();
    }

    lines.join("\n")
}

pub fn extract_first_attr_by_selectors(
    text: &str,
    selectors: &[&str],
    attr: &str,
) -> Option<String> {
    let document = Html::parse_document(text);
    for selector in selectors {
        let selector = Selector::parse(selector).ok()?;
        for element in document.select(&selector) {
            if let Some(value) = element.value().attr(attr) {
                let value = decode_html(value);
                if !value.is_empty() {
                    return Some(value);
                }
            }
        }
    }
    None
}

pub fn extract_labeled_value(text: &str, labels: &[&str]) -> Option<String> {
    if let Some(value) = extract_labeled_value_dom(text, labels) {
        return Some(value);
    }

    for label in labels {
        let escaped = regex::escape(label);
        for pattern in [
            format!(
                r#"(?is)<th[^>]*>\s*{}\s*</th>\s*<td[^>]*>(.*?)</td>"#,
                escaped
            ),
            format!(
                r#"(?is)<dt[^>]*>\s*{}\s*</dt>\s*<dd[^>]*>(.*?)</dd>"#,
                escaped
            ),
            format!(
                r#"(?is)<[^>]+class=["'][^"']*(?:label|ttl|title|heading)[^"']*["'][^>]*>\s*{}\s*</[^>]+>\s*<[^>]+>(.*?)</[^>]+>"#,
                escaped
            ),
        ] {
            let re = Regex::new(&pattern).ok()?;
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
    }
    None
}

pub fn extract_labeled_value_dom(text: &str, labels: &[&str]) -> Option<String> {
    let document = Html::parse_document(text);
    let row_selector = Selector::parse("tr, dl, div").ok()?;
    let label_selector = Selector::parse("th, dt, .label, .ttl, .title, .heading").ok()?;
    let value_selector = Selector::parse("td, dd, .value, .txt, .data").ok()?;

    for row in document.select(&row_selector) {
        let label_text = row
            .select(&label_selector)
            .next()
            .map(|element| collapse_spaces(&element.text().collect::<Vec<_>>().join(" ")))
            .unwrap_or_default();
        if !labels.iter().any(|label| label_text.contains(label)) {
            continue;
        }

        if let Some(value_node) = row.select(&value_selector).next() {
            let value = collapse_spaces(&value_node.text().collect::<Vec<_>>().join(" "));
            if !value.is_empty() {
                return Some(decode_html(&value));
            }
        }
    }
    None
}

pub fn split_values(value: &str) -> Vec<String> {
    let normalized = value.replace(['/', '／', '、', ',', '，', '｜', '|', '\n', '\t'], " ");
    let mut result = Vec::new();
    for part in normalized.split_whitespace() {
        let item = part.trim().to_string();
        if !item.is_empty() && !result.contains(&item) {
            result.push(item);
        }
    }
    result
}

pub fn normalize_date(value: &str) -> Option<String> {
    let value = collapse_spaces(value);
    let re = Regex::new(r"(\d{4})\D+(\d{1,2})\D+(\d{1,2})").ok()?;
    if let Some(cap) = re.captures(&value) {
        let year = cap.get(1)?.as_str();
        let month = cap.get(2)?.as_str().parse::<u32>().ok()?;
        let day = cap.get(3)?.as_str().parse::<u32>().ok()?;
        return Some(format!("{year}-{month:02}-{day:02}"));
    }
    if Regex::new(r"^\d{4}-\d{2}-\d{2}$").ok()?.is_match(&value) {
        return Some(value);
    }
    None
}

fn collapse_spaces(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_labeled_table_values() {
        let html = r#"<table><tr><th>販売日</th><td>2024年04月26日</td></tr><tr><th>ジャンル</th><td><a>ADV</a> / <a>萌え</a></td></tr></table>"#;
        assert_eq!(
            extract_labeled_value(html, &["販売日"]).as_deref(),
            Some("2024年04月26日")
        );
        assert_eq!(
            normalize_date("2024年04月26日").as_deref(),
            Some("2024-04-26")
        );
        assert_eq!(
            split_values(&extract_labeled_value(html, &["ジャンル"]).unwrap()),
            vec!["ADV", "萌え"]
        );
    }

    #[test]
    fn converts_description_html_images_to_markdown() {
        let html = r#"
          <div class="summary">
            <p>第一行。<br>第二行。</p>
            <img data-src="//img.example.test/work/sample.webp" alt="紹介画像">
            <p>第三行。</p>
          </div>
        "#;

        assert_eq!(
            html_to_description_text(html),
            "第一行。\n第二行。\n\n![紹介画像](https://img.example.test/work/sample.webp)\n\n第三行。"
        );
    }
}
