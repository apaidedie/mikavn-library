use std::sync::OnceLock;

use regex::Regex;

pub(super) fn description_image_sources(value: &str) -> Vec<String> {
    static DESCRIPTION_IMAGE_RE: OnceLock<Regex> = OnceLock::new();
    let pattern = DESCRIPTION_IMAGE_RE.get_or_init(|| {
        Regex::new(r#"(?is)!\[[^\]]*\]\(([^)]*?)\)|<img\b[^>]*>|\[img\]([\s\S]*?)\[/img\]|https?://[^\s<>"']+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s<>"']*)?"#)
            .expect("valid description image regex")
    });

    pattern
        .captures_iter(value)
        .filter_map(|captures| description_image_source_from_match(&captures))
        .collect()
}

fn description_image_source_from_match(captures: &regex::Captures<'_>) -> Option<String> {
    if let Some(source) = captures.get(1) {
        return clean_description_image_source(source.as_str(), false);
    }
    let token = captures.get(0)?.as_str();
    if token.trim_start().to_lowercase().starts_with("<img") {
        return read_description_image_attr(token)
            .and_then(|source| clean_description_image_source(&source, false));
    }
    if let Some(source) = captures.get(2) {
        return clean_description_image_source(source.as_str(), false);
    }
    clean_description_image_source(token, true)
}

fn read_description_image_attr(tag: &str) -> Option<String> {
    static IMG_SRC_RE: OnceLock<Regex> = OnceLock::new();
    let pattern = IMG_SRC_RE.get_or_init(|| {
        Regex::new(r#"(?i)\b(?:src|data-src|data-original|data-lazy-src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))"#)
            .expect("valid img src regex")
    });
    pattern.captures(tag).and_then(|captures| {
        captures
            .get(1)
            .or_else(|| captures.get(2))
            .or_else(|| captures.get(3))
            .map(|value| decode_description_html(value.as_str().trim()))
    })
}

fn clean_description_image_source(value: &str, trim_trailing_punctuation: bool) -> Option<String> {
    let mut clean = decode_description_html(value)
        .trim()
        .trim_matches(['\'', '"'])
        .to_string();
    if trim_trailing_punctuation {
        clean = clean
            .trim_end_matches([')', ',', '，', '。', '.', ';', '；'])
            .to_string();
    }
    if clean.starts_with("//") {
        clean = format!("https:{clean}");
    }
    if clean.is_empty() {
        None
    } else {
        Some(clean)
    }
}

fn decode_description_html(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}
