use crate::db::models::{SaveBackup, SavePath};
use crate::db::{Database, DbResult};

impl Database {
    pub fn add_save_path(
        &self,
        game_id: String,
        label: String,
        path: String,
    ) -> DbResult<SavePath> {
        self.get_game(game_id.clone())?;
        self.save_repository().add_save_path(game_id, label, path)
    }

    pub fn list_save_paths(&self, game_id: String) -> DbResult<Vec<SavePath>> {
        self.get_game(game_id.clone())?;
        self.save_repository().list_save_paths(game_id)
    }

    pub fn get_save_path(&self, id: &str) -> DbResult<SavePath> {
        self.save_repository().get_save_path(id)
    }

    pub fn remove_save_path(&self, id: String) -> DbResult<()> {
        self.save_repository().remove_save_path(id)
    }

    pub fn insert_save_backup(&self, item: &SaveBackup) -> DbResult<SaveBackup> {
        self.save_repository().insert_save_backup(item)
    }

    pub fn get_save_backup(&self, id: &str) -> DbResult<SaveBackup> {
        self.save_repository().get_save_backup(id)
    }

    pub fn list_save_backups(&self, game_id: String) -> DbResult<Vec<SaveBackup>> {
        self.get_game(game_id.clone())?;
        self.save_repository().list_save_backups(game_id)
    }

    pub fn delete_save_backup_record(&self, id: String) -> DbResult<()> {
        self.save_repository().delete_save_backup_record(id)
    }
}
