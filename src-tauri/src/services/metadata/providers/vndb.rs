use regex::Regex;
use serde_json::{json, Value};
use std::sync::OnceLock;

use crate::db::models::{ExternalIds, MetadataSearchResult, NormalizedMetadata};
use crate::db::{DbError, DbResult};
use crate::services::metadata::{make_result, metadata_from_result};

use super::{absolute_url, http_client};

const VNDB_API: &str = "https://api.vndb.org/kana/vn";

pub fn search(_query: &str, variants: &[String]) -> DbResult<Vec<MetadataSearchResult>> {
    let client = http_client()?;
    let mut results = Vec::new();
    let mut seen = Vec::new();

    for variant in variants.iter().take(3) {
        if results.len() >= 5 {
            break;
        }
        let data = request_vndb(&client, json!(["search", "=", variant]), 5)?;

        for item in data
            .get("results")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            if let Some(result) = result_from_item_if_new(item, &seen) {
                seen.push(result.id.clone());
                results.push(result);
            }
        }
        if !results.is_empty() {
            break;
        }
    }

    Ok(results)
}

pub fn detail(id: &str) -> DbResult<NormalizedMetadata> {
    let client = http_client()?;
    let data = request_vndb(&client, json!(["id", "=", id]), 1)?;
    let result = data
        .get("results")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .map(item_to_result)
        .find(|item| item.id == id)
        .ok_or_else(|| DbError::metadata_provider_failed(format!("VNDB detail not found: {id}")))?;
    Ok(metadata_from_result(&result))
}

fn request_vndb(
    client: &reqwest::blocking::Client,
    filters: Value,
    results: i64,
) -> DbResult<Value> {
    let payload = json!({
        "filters": filters,
        "fields": "id,title,titles.title,titles.lang,image.url,description,released,developers.name,tags.name",
        "results": results
    });
    client
        .post(VNDB_API)
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .and_then(|resp| resp.error_for_status())
        .map_err(|error| {
            DbError::metadata_provider_failed(format!("VNDB request failed: {error}"))
        })?
        .json()
        .map_err(|error| {
            DbError::metadata_provider_failed(format!("VNDB response parse failed: {error}"))
        })
}

fn item_to_result(item: &Value) -> MetadataSearchResult {
    let id = item
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let title = preferred_title(item);
    let mut result = make_result("vndb", id.clone(), title, format!("https://vndb.org/{id}"));
    result.image_url = item
        .pointer("/image/url")
        .and_then(Value::as_str)
        .map(absolute_url);
    result.description = item
        .get("description")
        .and_then(Value::as_str)
        .map(ToString::to_string);
    result.release_date = item
        .get("released")
        .and_then(Value::as_str)
        .map(ToString::to_string);
    result.developers = string_array(item.get("developers"), "name");
    result.tags = string_array(item.get("tags"), "name");
    result
}

fn result_from_item_if_new(item: &Value, seen: &[String]) -> Option<MetadataSearchResult> {
    let id = item
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    if id.is_empty() || seen.contains(&id) {
        return None;
    }
    Some(item_to_result(item))
}

pub fn integrate_sniffed_ids(
    results: &mut Vec<MetadataSearchResult>,
    errors: &mut Vec<String>,
    enabled_providers: &[String],
) {
    let allow_dlsite = enabled_providers
        .iter()
        .any(|provider| provider == "dlsite");
    let allow_fanza = enabled_providers.iter().any(|provider| provider == "fanza");
    if !allow_dlsite && !allow_fanza {
        return;
    }

    let vndb_urls = results
        .iter()
        .filter(|item| item.provider == "vndb")
        .map(|item| item.url.clone())
        .collect::<Vec<_>>();
    if vndb_urls.is_empty() {
        return;
    }

    let client = match http_client() {
        Ok(client) => client,
        Err(error) => {
            errors.push(format!("vndb sniff: {error}"));
            return;
        }
    };

    for url in vndb_urls.iter().take(5) {
        let Ok(resp) = client
            .get(url)
            .send()
            .and_then(|resp| resp.error_for_status())
        else {
            continue;
        };
        let Ok(text) = resp.text() else {
            continue;
        };

        if allow_dlsite {
            for id in sniff_dlsite_ids(&text) {
                mark_or_push(
                    results,
                    "dlsite",
                    &id,
                    &format!("https://www.dlsite.com/maniax/work/=/product_id/{id}.html"),
                    errors,
                    detail_result_for_provider,
                );
            }
        }
        if allow_fanza {
            for id in sniff_fanza_ids(&text) {
                mark_or_push(
                    results,
                    "fanza",
                    &id,
                    &format!("https://dlsoft.dmm.co.jp/detail/{id}/"),
                    errors,
                    detail_result_for_provider,
                );
            }
        }
    }
}

fn preferred_title(item: &Value) -> String {
    if let Some(titles) = item.get("titles").and_then(Value::as_array) {
        for title in titles {
            if title.get("lang").and_then(Value::as_str) == Some("ja") {
                if let Some(value) = title.get("title").and_then(Value::as_str) {
                    return value.to_string();
                }
            }
        }
    }
    item.get("title")
        .and_then(Value::as_str)
        .unwrap_or("Unknown")
        .to_string()
}

fn string_array(value: Option<&Value>, field: &str) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| {
            item.get(field)
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .collect()
}

fn sniff_dlsite_ids(text: &str) -> Vec<String> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re =
        RE.get_or_init(|| Regex::new(r"(?i)(?:product_id|/id)/([RV]J\d{6,8})(?:\.html)?").unwrap());
    unique(
        re.captures_iter(text)
            .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_uppercase()))
            .collect(),
    )
}

fn sniff_fanza_ids(text: &str) -> Vec<String> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re =
        RE.get_or_init(|| Regex::new(r"(?i)(?:cid=|/detail/)([a-z0-9_]+?)(?:/|$|\?)").unwrap());
    unique(
        re.captures_iter(text)
            .filter_map(|cap| cap.get(1).map(|m| m.as_str().to_lowercase()))
            .filter(|id| {
                !id.ends_with("_ost") && !id.contains("soundtrack") && !id.contains("drama")
            })
            .collect(),
    )
}

fn unique(values: Vec<String>) -> Vec<String> {
    let mut result = Vec::new();
    for value in values {
        if !result.contains(&value) {
            result.push(value);
        }
    }
    result
}

fn mark_or_push<F>(
    results: &mut Vec<MetadataSearchResult>,
    provider: &str,
    id: &str,
    url: &str,
    errors: &mut Vec<String>,
    detail_fetcher: F,
) where
    F: Fn(&str, &str) -> DbResult<MetadataSearchResult>,
{
    if let Some(existing) = results
        .iter_mut()
        .find(|item| item.provider == provider && item.id.eq_ignore_ascii_case(id))
    {
        existing.from_vndb_sniff = true;
        return;
    }
    results.push(sniffed_result_or_fallback(
        provider,
        id,
        url,
        errors,
        detail_fetcher,
    ));
}

fn sniffed_result_or_fallback<F>(
    provider: &str,
    id: &str,
    url: &str,
    errors: &mut Vec<String>,
    detail_fetcher: F,
) -> MetadataSearchResult
where
    F: Fn(&str, &str) -> DbResult<MetadataSearchResult>,
{
    match detail_fetcher(provider, id) {
        Ok(mut result) => {
            result.from_vndb_sniff = true;
            ensure_external_id(&mut result, provider, id);
            result
        }
        Err(error) => {
            errors.push(format!("vndb sniff {provider}:{id}: {error}"));
            fallback_sniffed_result(provider, id, url)
        }
    }
}

fn detail_result_for_provider(provider: &str, id: &str) -> DbResult<MetadataSearchResult> {
    match provider {
        "dlsite" => super::dlsite::detail_result(&id.to_uppercase()),
        "fanza" => super::fanza::detail_result(&id.to_lowercase()),
        _ => Err(DbError::metadata_provider_failed(format!(
            "unsupported sniff provider: {provider}"
        ))),
    }
}

fn ensure_external_id(result: &mut MetadataSearchResult, provider: &str, id: &str) {
    if provider == "dlsite" {
        result.external_ids.dlsite = Some(id.to_string());
    } else if provider == "fanza" {
        result.external_ids.fanza = Some(id.to_string());
    }
}

fn fallback_sniffed_result(provider: &str, id: &str, url: &str) -> MetadataSearchResult {
    let mut external_ids = ExternalIds::default();
    if provider == "dlsite" {
        external_ids.dlsite = Some(id.to_string());
    } else {
        external_ids.fanza = Some(id.to_string());
    }
    MetadataSearchResult {
        provider: provider.to_string(),
        id: id.to_string(),
        title: id.to_string(),
        url: url.to_string(),
        image_url: None,
        description: None,
        release_date: None,
        developers: Vec::new(),
        tags: Vec::new(),
        external_ids,
        relevance_score: 0.0,
        from_vndb_sniff: true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::ExternalIds;

    #[test]
    fn sniffed_result_prefers_detail_payload() {
        let mut errors = Vec::new();
        let result = sniffed_result_or_fallback(
            "dlsite",
            "RJ01000000",
            "https://example.invalid",
            &mut errors,
            |provider, id| {
                let mut result = MetadataSearchResult {
                    provider: provider.to_string(),
                    id: id.to_string(),
                    title: "星之终途".to_string(),
                    url: "https://www.dlsite.com/maniax/work/=/product_id/RJ01000000.html"
                        .to_string(),
                    image_url: Some("https://img.example/cover.jpg".to_string()),
                    description: Some("detail".to_string()),
                    release_date: Some("2022-09-30".to_string()),
                    developers: vec!["Key".to_string()],
                    tags: vec!["ADV".to_string()],
                    external_ids: ExternalIds::default(),
                    relevance_score: 0.0,
                    from_vndb_sniff: false,
                };
                result.external_ids.dlsite = Some(id.to_string());
                Ok(result)
            },
        );

        assert!(errors.is_empty());
        assert!(result.from_vndb_sniff);
        assert_eq!(result.title, "星之终途");
        assert_eq!(
            result.image_url.as_deref(),
            Some("https://img.example/cover.jpg")
        );
        assert_eq!(result.external_ids.dlsite.as_deref(), Some("RJ01000000"));
    }

    #[test]
    fn sniffed_result_falls_back_when_detail_fails() {
        let mut errors = Vec::new();
        let result = sniffed_result_or_fallback(
            "fanza",
            "abc_1234",
            "https://dlsoft.dmm.co.jp/detail/abc_1234/",
            &mut errors,
            |_provider, _id| Err(DbError::metadata_provider_failed("network down")),
        );

        assert_eq!(result.provider, "fanza");
        assert_eq!(result.title, "abc_1234");
        assert!(result.from_vndb_sniff);
        assert_eq!(result.external_ids.fanza.as_deref(), Some("abc_1234"));
        assert_eq!(errors.len(), 1);
    }
}
