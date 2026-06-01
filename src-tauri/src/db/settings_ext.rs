use crate::db::{Database, DbResult};

impl Database {
    pub fn get_setting(&self, key: &str) -> DbResult<Option<String>> {
        self.setting_repository().get_setting(key)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> DbResult<()> {
        self.setting_repository().set_setting(key, value)
    }

    pub fn list_settings(&self) -> DbResult<Vec<(String, String)>> {
        self.setting_repository().list_settings()
    }
}
