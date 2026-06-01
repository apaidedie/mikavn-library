use std::collections::HashMap;

use crate::db::{Database, DbResult};

pub fn get_app_settings(db: &Database) -> DbResult<HashMap<String, String>> {
    Ok(db.list_settings()?.into_iter().collect())
}

pub fn set_app_setting(db: &Database, key: String, value: String) -> DbResult<()> {
    db.set_setting(&key, &value)
}

pub fn set_app_settings(db: &Database, settings: HashMap<String, String>) -> DbResult<()> {
    for (key, value) in settings {
        db.set_setting(&key, &value)?;
    }
    Ok(())
}
