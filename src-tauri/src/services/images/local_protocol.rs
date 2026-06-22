use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use percent_encoding::percent_decode;
use tauri::http::{header, Request, Response, StatusCode};

use crate::db::{DbError, DbResult};
use crate::infrastructure::paths::AppPaths;

pub fn handle_local_image_protocol_request(
    app: &tauri::AppHandle,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let paths = match AppPaths::from_app(app) {
        Ok(paths) => paths,
        Err(error) => {
            return response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "text/plain",
                error.to_string().into_bytes(),
            )
        }
    };
    let image_path = match resolve_local_image_path(paths.root(), request.uri().path()) {
        Ok(path) => path,
        Err(_) => {
            return response(
                StatusCode::FORBIDDEN,
                "text/plain",
                b"image path is not allowed".to_vec(),
            )
        }
    };
    let Some(content_type) = local_image_content_type(&image_path) else {
        return response(
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "text/plain",
            b"unsupported image type".to_vec(),
        );
    };

    match fs::read(&image_path) {
        Ok(bytes) => response(StatusCode::OK, content_type, bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => response(
            StatusCode::NOT_FOUND,
            "text/plain",
            b"image not found".to_vec(),
        ),
        Err(error) => response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "text/plain",
            error.to_string().into_bytes(),
        ),
    }
}

fn resolve_local_image_path(app_data_root: &Path, protocol_path: &str) -> DbResult<PathBuf> {
    let encoded = protocol_path.strip_prefix('/').unwrap_or(protocol_path);
    let decoded = percent_decode(encoded.as_bytes())
        .decode_utf8()
        .map_err(|_| DbError::validation("image path is not valid UTF-8"))?;
    let images_root = app_data_root.join("images").canonicalize()?;
    let requested = PathBuf::from(decoded.as_ref());
    if requested.is_absolute() {
        return resolve_absolute_image_path(&images_root, &requested);
    }

    resolve_cache_relative_image_path(&images_root, decoded.as_ref())
}

fn resolve_absolute_image_path(images_root: &Path, requested: &Path) -> DbResult<PathBuf> {
    let requested = requested.canonicalize()?;
    if !requested.is_file() || !requested.starts_with(images_root) {
        return Err(DbError::validation("image path is outside the image cache"));
    }
    Ok(requested)
}

fn resolve_cache_relative_image_path(images_root: &Path, value: &str) -> DbResult<PathBuf> {
    let normalized = value.replace('\\', "/");
    let relative = normalized.strip_prefix("images/").unwrap_or(&normalized);
    if relative.is_empty()
        || relative
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err(DbError::validation("image path is outside the image cache"));
    }

    resolve_absolute_image_path(images_root, &images_root.join(relative))
}

fn local_image_content_type(path: &Path) -> Option<&'static str> {
    if let Some(content_type) = sniff_image_content_type(path) {
        return Some(content_type);
    }
    match path
        .extension()?
        .to_string_lossy()
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        "gif" => Some("image/gif"),
        "ico" => Some("image/x-icon"),
        _ => None,
    }
}

fn sniff_image_content_type(path: &Path) -> Option<&'static str> {
    let mut file = fs::File::open(path).ok()?;
    let mut header = [0u8; 16];
    let read = file.read(&mut header).ok()?;
    let bytes = &header[..read];
    if bytes.len() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF {
        return Some("image/jpeg");
    }
    if bytes.starts_with(b"\x89PNG\r\n\x1A\n") {
        return Some("image/png");
    }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return Some("image/webp");
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some("image/gif");
    }
    None
}

fn response(status: StatusCode, content_type: &'static str, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .body(body)
        .expect("local image protocol response should be valid")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_only_images_under_app_data() {
        let root =
            std::env::temp_dir().join(format!("mikavn-image-protocol-{}", std::process::id()));
        let images = root.join("images");
        fs::create_dir_all(&images).unwrap();
        let cover = images.join("cover.jpg");
        fs::write(&cover, b"jpg").unwrap();

        let resolved = resolve_local_image_path(&root, &protocol_path_for(&cover)).unwrap();

        assert_eq!(resolved, cover.canonicalize().unwrap());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_traversal_outside_images() {
        let root = std::env::temp_dir().join(format!(
            "mikavn-image-protocol-traversal-{}",
            std::process::id()
        ));
        let images = root.join("images");
        fs::create_dir_all(&images).unwrap();
        let database = root.join("mikavn.db");
        fs::write(&database, b"db").unwrap();
        let traversal = images.join("..").join("mikavn.db");

        assert!(resolve_local_image_path(&root, &protocol_path_for(&traversal)).is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_cache_relative_image_paths_under_app_data_images() {
        let root = std::env::temp_dir().join(format!(
            "mikavn-image-protocol-relative-{}",
            std::process::id()
        ));
        let images = root.join("images");
        fs::create_dir_all(&images).unwrap();
        let cover = images.join("roundtrip-cover.webp");
        fs::write(&cover, b"webp").unwrap();

        let resolved = resolve_local_image_path(&root, "/images%2Froundtrip-cover.webp").unwrap();

        assert_eq!(resolved, cover.canonicalize().unwrap());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn supports_icon_cover_images() {
        assert_eq!(
            local_image_content_type(Path::new("cover.ico")),
            Some("image/x-icon")
        );
    }

    #[test]
    fn detects_png_content_even_when_cache_extension_is_jpg() {
        let root =
            std::env::temp_dir().join(format!("mikavn-image-protocol-mime-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let mislabeled = root.join("cover.jpg");
        fs::write(&mislabeled, b"\x89PNG\r\n\x1A\npng-body").unwrap();

        assert_eq!(local_image_content_type(&mislabeled), Some("image/png"));
        let _ = fs::remove_dir_all(root);
    }

    fn protocol_path_for(path: &Path) -> String {
        format!(
            "/{}",
            path.to_string_lossy()
                .replace('\\', "%5C")
                .replace(':', "%3A")
        )
    }
}
