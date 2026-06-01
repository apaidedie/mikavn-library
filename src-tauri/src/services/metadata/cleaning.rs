use regex::Regex;
use std::sync::OnceLock;

static RULES: OnceLock<Vec<Regex>> = OnceLock::new();
static SPLITTER: OnceLock<Regex> = OnceLock::new();
static SPECIAL_CHARS: OnceLock<Regex> = OnceLock::new();
static DLSITE_ID: OnceLock<Regex> = OnceLock::new();
static FANZA_ID: OnceLock<Regex> = OnceLock::new();

pub fn clean_title(value: &str) -> String {
    let mut result = value.trim().to_string();
    for rule in rules() {
        result = rule.replace_all(&result, " ").to_string();
    }
    normalize_spaces(&result)
        .trim_matches([' ', '-', '_', '　'])
        .to_string()
}

pub fn generate_search_variants(keyword: &str) -> Vec<String> {
    let keyword = keyword.trim();
    let mut variants = Vec::new();
    add_variant(&mut variants, keyword);

    let cleaned = clean_title(keyword);
    add_variant(&mut variants, &cleaned);

    let no_brackets = keyword.replace(
        [
            '(', ')', '[', ']', '【', '】', '「', '」', '『', '』', '（', '）', '《', '》', '〈',
            '〉',
        ],
        " ",
    );
    add_variant(&mut variants, &clean_title(&no_brackets));

    if let Some(first) = splitter().split(&cleaned).next() {
        add_variant(&mut variants, first);
    }

    if contains_cjk(keyword) {
        let cjk = trim_ascii_edges(keyword);
        add_variant(&mut variants, &clean_title(&cjk));
    }

    variants
}

pub fn normalize_for_match(text: &str) -> String {
    let lower = text.to_lowercase();
    let stripped = special_chars().replace_all(&lower, "");
    normalize_spaces(&stripped)
}

pub fn is_dlsite_id(value: &str) -> bool {
    dlsite_id().is_match(value.trim())
}

pub fn is_fanza_id(value: &str) -> bool {
    fanza_id().is_match(value.trim())
}

fn add_variant(values: &mut Vec<String>, value: &str) {
    let value = normalize_spaces(value);
    if value.chars().count() >= 2 && !values.contains(&value) {
        values.push(value);
    }
}

fn normalize_spaces(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn contains_cjk(value: &str) -> bool {
    value
        .chars()
        .any(|ch| matches!(ch as u32, 0x4e00..=0x9fff | 0x3040..=0x309f | 0x30a0..=0x30ff))
}

fn trim_ascii_edges(value: &str) -> String {
    let mut start = 0;
    let mut end = value.len();
    for (idx, ch) in value.char_indices() {
        if !ch.is_ascii() {
            start = idx;
            break;
        }
    }
    for (idx, ch) in value.char_indices().rev() {
        if !ch.is_ascii() {
            end = idx + ch.len_utf8();
            break;
        }
    }
    value[start..end].trim().to_string()
}

fn rules() -> &'static [Regex] {
    RULES.get_or_init(|| {
        vec![
            Regex::new(r"^[^\]】]+[\]】]\s*").unwrap(),
            Regex::new(r"\s*\([^)]*\)\s*").unwrap(),
            Regex::new(r"\s*\[[^\]]*\]\s*").unwrap(),
            Regex::new(r"\s*[【「『（《〈][^】」』）》〉]*[】」』）》〉]\s*").unwrap(),
            Regex::new(r"(?i)\s*\+?\s*(?:iso|mds|mdf|bin|cue|img|nrg|rar|zip|7z|exe|ccd|sub)\s*\+?\s*").unwrap(),
            Regex::new(r"\s*(?:DL版|ダウンロード版|パッケージ版|PKG版|汉化硬盘版|汉化版|硬盘版|绿色版|破解版|中文版)\s*").unwrap(),
            Regex::new(r"\s*(?:通常版|限定版|完全版|豪華版|廉価版|Best版|ベスト版)\s*").unwrap(),
            Regex::new(r"(?i)\s*(?:for\s*)?(?:Windows|Win|PC|Android|iOS)\s*").unwrap(),
            Regex::new(r"(?i)\s*v(?:er)?\.?\s*[\d.]+[a-z]?\s*").unwrap(),
            Regex::new(r"\s*\d{4}年?\s*$").unwrap(),
            Regex::new(r"(?i)\s*[-_]?\s*(?:rip|crack|repack|gog|fitgirl|codex|plaza|skidrow)\s*").unwrap(),
        ]
    })
}

fn splitter() -> &'static Regex {
    SPLITTER.get_or_init(|| Regex::new(r"[～~\-—｜|／/《》「」『』【】\[\]()（）!！?？]").unwrap())
}

fn special_chars() -> &'static Regex {
    SPECIAL_CHARS.get_or_init(|| Regex::new(r"[○×★☆◆◇■□▲△▼▽♀♂♪♡♥！!？?…．.、，,：:；;\s]").unwrap())
}

fn dlsite_id() -> &'static Regex {
    DLSITE_ID.get_or_init(|| Regex::new(r"(?i)^[RV]J\d{6,8}$").unwrap())
}

fn fanza_id() -> &'static Regex {
    FANZA_ID.get_or_init(|| Regex::new(r"(?i)^[a-z]{1,5}_?\d{3,6}[a-z]?$").unwrap())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cleans_common_noise() {
        assert_eq!(clean_title("[汉化硬盘版] 星之终途 v1.02"), "星之终途");
    }

    #[test]
    fn keeps_main_japanese_title() {
        assert_eq!(
            clean_title("[230428][ゆずソフト] 天使☆騒々 RE-BOOT!"),
            "天使☆騒々 RE-BOOT!"
        );
    }

    #[test]
    fn detects_shop_ids() {
        assert!(is_dlsite_id("RJ01000000"));
        assert!(is_fanza_id("abc_1234"));
    }
}
