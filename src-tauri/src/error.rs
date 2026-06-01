use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new("VALIDATION_ERROR", message)
    }

    pub fn path_not_found(message: impl Into<String>) -> Self {
        Self::new("PATH_NOT_FOUND", message)
    }

    pub fn executable_not_found(message: impl Into<String>) -> Self {
        Self::new("EXECUTABLE_NOT_FOUND", message)
    }

    pub fn launch_failed(message: impl Into<String>) -> Self {
        Self::new("LAUNCH_FAILED", message)
    }

    pub fn launch_cancelled(message: impl Into<String>) -> Self {
        Self::new("LAUNCH_CANCELLED", message)
    }

    pub fn backup_failed(message: impl Into<String>) -> Self {
        Self::new("BACKUP_FAILED", message)
    }

    pub fn metadata_provider_failed(message: impl Into<String>) -> Self {
        Self::new("METADATA_PROVIDER_FAILED", message)
    }

    pub fn asset_download_failed(message: impl Into<String>) -> Self {
        Self::new("ASSET_DOWNLOAD_FAILED", message)
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}", self.message)
    }
}

impl std::error::Error for AppError {}

impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        Self::new("DB_ERROR", format!("database error: {error}"))
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        let code = match error.kind() {
            std::io::ErrorKind::NotFound => "PATH_NOT_FOUND",
            std::io::ErrorKind::PermissionDenied => "PATH_ACCESS_DENIED",
            _ => "IO_ERROR",
        };
        Self::new(code, format!("io error: {error}"))
    }
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        Self::new("VALIDATION_ERROR", format!("json error: {error}"))
    }
}

impl From<tauri::Error> for AppError {
    fn from(error: tauri::Error) -> Self {
        Self::new("IO_ERROR", format!("tauri error: {error}"))
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(error: zip::result::ZipError) -> Self {
        Self::new("ARCHIVE_ERROR", format!("zip archive error: {error}"))
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_app_error_contract() {
        let error = AppError::validation("title is required");
        let value = serde_json::to_value(error).unwrap();
        assert_eq!(value["code"], "VALIDATION_ERROR");
        assert_eq!(value["message"], "title is required");
    }

    #[test]
    fn maps_not_found_io_error_to_path_code() {
        let error: AppError = std::io::Error::new(std::io::ErrorKind::NotFound, "missing").into();
        assert_eq!(error.code, "PATH_NOT_FOUND");
    }
}
