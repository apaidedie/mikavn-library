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
}
