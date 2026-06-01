use crate::db::models::MetadataSearchResult;

use super::cleaning::normalize_for_match;

pub const AUTO_MATCH_THRESHOLD: f64 = 0.30;

pub fn relevance_score(keyword: &str, title: &str) -> f64 {
    let kw = normalize_for_match(keyword);
    let tt = normalize_for_match(title);
    if kw.is_empty() || tt.is_empty() {
        return 0.0;
    }
    if kw == tt {
        return 1.0;
    }
    if tt.contains(&kw) {
        return 0.7 + 0.3 * (kw.chars().count() as f64 / tt.chars().count().max(1) as f64);
    }

    let kw_chars = kw
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .collect::<Vec<_>>();
    if kw_chars.is_empty() {
        return 0.0;
    }
    let tt_chars = tt
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .collect::<Vec<_>>();
    let overlap =
        kw_chars.iter().filter(|ch| tt_chars.contains(ch)).count() as f64 / kw_chars.len() as f64;
    overlap * 0.6
}

pub fn sort_by_relevance(keyword: &str, results: &mut [MetadataSearchResult]) {
    for result in results.iter_mut() {
        result.relevance_score = relevance_score(keyword, &result.title);
        if result.from_vndb_sniff {
            result.relevance_score = (result.relevance_score + 0.1).min(1.0);
        }
    }
    results.sort_by(|a, b| {
        b.from_vndb_sniff.cmp(&a.from_vndb_sniff).then_with(|| {
            b.relevance_score
                .partial_cmp(&a.relevance_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
    });
}

pub fn select_best(results: &[MetadataSearchResult]) -> Option<MetadataSearchResult> {
    let starred = results
        .iter()
        .filter(|item| item.from_vndb_sniff)
        .max_by(score_order);
    if let Some(item) = starred {
        return Some(item.clone());
    }
    results
        .iter()
        .filter(|item| item.relevance_score >= AUTO_MATCH_THRESHOLD)
        .max_by(score_order)
        .cloned()
}

fn score_order(a: &&MetadataSearchResult, b: &&MetadataSearchResult) -> std::cmp::Ordering {
    a.relevance_score
        .partial_cmp(&b.relevance_score)
        .unwrap_or(std::cmp::Ordering::Equal)
}

#[cfg(test)]
mod tests {
    use crate::db::models::{ExternalIds, MetadataSearchResult};

    use super::*;

    #[test]
    fn vndb_sniff_bonus_affects_sorting() {
        let mut results = vec![
            result("dlsite", "RJ1", "星之终途", false),
            result("dlsite", "RJ2", "星之终途", true),
        ];
        sort_by_relevance("星之终途", &mut results);
        assert_eq!(results[0].id, "RJ2");
    }

    fn result(
        provider: &str,
        id: &str,
        title: &str,
        from_vndb_sniff: bool,
    ) -> MetadataSearchResult {
        MetadataSearchResult {
            provider: provider.to_string(),
            id: id.to_string(),
            title: title.to_string(),
            url: String::new(),
            image_url: None,
            description: None,
            release_date: None,
            developers: Vec::new(),
            tags: Vec::new(),
            external_ids: ExternalIds::default(),
            relevance_score: 0.0,
            from_vndb_sniff,
        }
    }
}
