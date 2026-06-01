use std::env;
use std::io::Cursor;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, GenericImageView};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::db::models::AiRecognitionResult;
use crate::db::{Database, DbError, DbResult};

use super::providers::http_client;

const SYSTEM_PROMPT: &str = "You identify Galgame / Visual Novel titles from images. Return only the most likely game title. If uncertain, return a short uncertainty note after the title. Do not describe the image.";

pub struct AiConfig {
    api_key: String,
    base_url: String,
    model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConnectionTestResult {
    pub ok: bool,
    pub base_url: String,
    pub model: String,
    pub message: String,
}

pub fn config_from_sources(db: &Database) -> DbResult<AiConfig> {
    let api_key = env::var("MIKAVN_AI_API_KEY")
        .ok()
        .or_else(|| db.get_setting("ai_api_key").ok().flatten());
    let api_key =
        api_key.ok_or_else(|| DbError::validation("MIKAVN_AI_API_KEY is not configured"))?;
    let base_url = env::var("MIKAVN_AI_BASE_URL")
        .ok()
        .or_else(|| db.get_setting("ai_base_url").ok().flatten())
        .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
    let model = env::var("MIKAVN_AI_MODEL")
        .ok()
        .or_else(|| db.get_setting("ai_model").ok().flatten())
        .unwrap_or_else(|| "gpt-4o-mini".to_string());

    Ok(AiConfig {
        api_key,
        base_url,
        model,
    })
}

pub fn recognize_from_image(config: AiConfig, image_path: String) -> DbResult<AiRecognitionResult> {
    let b64 = encode_image(image_path)?;
    let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));
    let payload = json!({
        "model": config.model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": [
                {"type": "text", "text": "Identify this image."},
                {"type": "image_url", "image_url": {"url": format!("data:image/jpeg;base64,{b64}")}}
            ]}
        ],
        "temperature": 0.1,
        "stream": false
    });

    let data: Value = http_client()?
        .post(url)
        .bearer_auth(config.api_key)
        .json(&payload)
        .send()
        .and_then(|resp| resp.error_for_status())
        .map_err(|error| {
            DbError::metadata_provider_failed(format!("AI recognition request failed: {error}"))
        })?
        .json()
        .map_err(|error| {
            DbError::metadata_provider_failed(format!(
                "AI recognition response parse failed: {error}"
            ))
        })?;

    let raw_text = data
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    let title = raw_text
        .lines()
        .next()
        .unwrap_or_default()
        .trim()
        .to_string();
    Ok(AiRecognitionResult {
        title,
        raw_text,
        confidence: None,
    })
}

pub fn test_connection(config: AiConfig) -> DbResult<AiConnectionTestResult> {
    let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));
    let payload = json!({
        "model": config.model,
        "messages": [
            {"role": "system", "content": "Reply with OK."},
            {"role": "user", "content": "ping"}
        ],
        "temperature": 0,
        "max_tokens": 8,
        "stream": false
    });

    let data: Value = http_client()?
        .post(&url)
        .bearer_auth(&config.api_key)
        .json(&payload)
        .send()
        .and_then(|resp| resp.error_for_status())
        .map_err(|error| {
            DbError::metadata_provider_failed(format!("AI connection test failed: {error}"))
        })?
        .json()
        .map_err(|error| {
            DbError::metadata_provider_failed(format!(
                "AI connection test response parse failed: {error}"
            ))
        })?;

    let content = data
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim();
    if content.is_empty() {
        return Err(DbError::metadata_provider_failed(
            "AI connection test returned an empty response",
        ));
    }

    Ok(AiConnectionTestResult {
        ok: true,
        base_url: config.base_url,
        model: config.model,
        message: "AI connection is available".to_string(),
    })
}

fn encode_image(path: String) -> DbResult<String> {
    let image = image::open(path)
        .map_err(|error| DbError::path_not_found(format!("failed to open image: {error}")))?;
    let image = resize_for_ai(image).into_rgb8();
    let mut bytes = Vec::new();
    let mut cursor = Cursor::new(&mut bytes);
    let mut encoder = JpegEncoder::new_with_quality(&mut cursor, 85);
    encoder
        .encode_image(&image)
        .map_err(|error| DbError::validation(format!("failed to encode image: {error}")))?;
    Ok(STANDARD.encode(bytes))
}

fn resize_for_ai(image: DynamicImage) -> DynamicImage {
    let (width, height) = image.dimensions();
    let max_side = width.max(height);
    if max_side <= 1024 {
        return image;
    }
    let ratio = 1024.0 / max_side as f32;
    let next_width = (width as f32 * ratio).round().max(1.0) as u32;
    let next_height = (height as f32 * ratio).round().max(1.0) as u32;
    image.resize(next_width, next_height, FilterType::Lanczos3)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ai_connection_test_result_uses_frontend_field_names() {
        let result = AiConnectionTestResult {
            ok: true,
            base_url: "https://api.example.com/v1".to_string(),
            model: "test-model".to_string(),
            message: "ok".to_string(),
        };
        let value = serde_json::to_value(result).unwrap();
        assert_eq!(value["baseUrl"], "https://api.example.com/v1");
        assert_eq!(value["model"], "test-model");
    }
}
