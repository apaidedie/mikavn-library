use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use reqwest::blocking::Client;
use reqwest::header::CONTENT_TYPE;
use uuid::Uuid;

use crate::db::{DbError, DbResult};
use crate::services::metadata::providers::http_client;

const MAX_IMAGE_BYTES: u64 = 10 * 1024 * 1024;

pub fn cache_cover_image(
    app_data_dir: &Path,
    provider: &str,
    id: &str,
    image_url: &str,
) -> DbResult<String> {
    cache_remote_image(app_data_dir, provider, id, image_url, "cover")
}

pub fn cache_remote_image(
    app_data_dir: &Path,
    provider: &str,
    id: &str,
    image_url: &str,
    filename_prefix: &str,
) -> DbResult<String> {
    if !is_remote_url(image_url) {
        return Ok(image_url.to_string());
    }

    let client = http_client()?;
    let mut response = client
        .get(image_url)
        .send()
        .and_then(|resp| resp.error_for_status())
        .map_err(|error| {
            DbError::asset_download_failed(format!("image download failed: {error}"))
        })?;

    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_string();
    let extension = extension_from_content_type(&content_type)
        .or_else(|| extension_from_url(image_url))
        .ok_or_else(|| DbError::asset_download_failed("unsupported cover image type"))?;

    let mut bytes = Vec::new();
    let mut limited = response.by_ref().take(MAX_IMAGE_BYTES + 1);
    limited.read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err(DbError::asset_download_failed("image is larger than 10MB"));
    }
    if bytes.is_empty() {
        return Err(DbError::asset_download_failed("image response is empty"));
    }

    let image_dir = app_data_dir.join("images");
    fs::create_dir_all(&image_dir)?;
    let filename = safe_image_filename(provider, id, &extension, filename_prefix);
    let path = image_dir.join(filename);
    fs::write(&path, bytes)?;
    Ok(path.to_string_lossy().to_string())
}

pub fn is_remote_url(value: &str) -> bool {
    let lower = value.trim().to_lowercase();
    lower.starts_with("http://") || lower.starts_with("https://")
}

pub fn extension_from_content_type(value: &str) -> Option<String> {
    let mime = value.split(';').next()?.trim().to_lowercase();
    match mime.as_str() {
        "image/jpeg" | "image/jpg" => Some("jpg".to_string()),
        "image/png" => Some("png".to_string()),
        "image/webp" => Some("webp".to_string()),
        "image/gif" => Some("gif".to_string()),
        _ => None,
    }
}

pub fn extension_from_url(value: &str) -> Option<String> {
    let clean = value.split(['?', '#']).next().unwrap_or(value);
    let extension = PathBuf::from(clean)
        .extension()?
        .to_string_lossy()
        .to_lowercase();
    match extension.as_str() {
        "jpg" | "jpeg" => Some("jpg".to_string()),
        "png" | "webp" | "gif" => Some(extension),
        _ => None,
    }
}

fn safe_image_filename(provider: &str, id: &str, extension: &str, prefix: &str) -> String {
    let provider = safe_part(provider);
    let id = safe_part(id);
    let prefix = safe_part(prefix);
    format!("{provider}-{id}-{prefix}-{}.{}", Uuid::new_v4(), extension)
}

fn safe_part(value: &str) -> String {
    let part = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>();
    let trimmed = part.trim_matches('-');
    if trimmed.is_empty() {
        "item".to_string()
    } else {
        trimmed.to_string()
    }
}

#[allow(dead_code)]
fn _assert_client_send(client: Client) -> Client {
    client
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn infers_supported_image_extensions() {
        assert_eq!(
            extension_from_content_type("image/jpeg; charset=utf-8").as_deref(),
            Some("jpg")
        );
        assert_eq!(
            extension_from_content_type("image/webp").as_deref(),
            Some("webp")
        );
        assert_eq!(
            extension_from_url("https://example.com/cover.PNG?x=1").as_deref(),
            Some("png")
        );
        assert_eq!(extension_from_url("https://example.com/file.exe"), None);
    }

    #[test]
    fn detects_remote_urls() {
        assert!(is_remote_url("https://example.com/a.jpg"));
        assert!(is_remote_url("http://example.com/a.jpg"));
        assert!(!is_remote_url("C:\\Games\\cover.jpg"));
    }
}
