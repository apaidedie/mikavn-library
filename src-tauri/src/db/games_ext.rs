use crate::db::models::{
    AddGameInput, ArchiveImportConflictRow, Game, GameFilter, UpdateGameInput,
};
use crate::db::{Database, DbResult};
use crate::services::games as game_service;

impl Database {
    #[allow(dead_code)]
    pub fn add_game(&self, input: AddGameInput) -> DbResult<Game> {
        game_service::add_game(self, input)
    }

    #[allow(dead_code)]
    pub fn insert_imported_game(&self, game: Game) -> DbResult<Game> {
        game_service::insert_imported_game(self, game)
    }

    #[allow(dead_code)]
    pub fn update_game(&self, id: String, input: UpdateGameInput) -> DbResult<Game> {
        game_service::update_game(self, id, input)
    }

    pub(crate) fn add_game_record(&self, input: AddGameInput) -> DbResult<Game> {
        self.game_repository().add(input)
    }

    pub(crate) fn insert_imported_game_record(&self, game: Game) -> DbResult<Game> {
        self.game_repository().insert_imported(game)
    }

    pub(crate) fn update_game_record(&self, id: String, input: UpdateGameInput) -> DbResult<Game> {
        self.game_repository().update(id, input)
    }

    pub fn delete_game_record(&self, id: String) -> DbResult<()> {
        self.game_repository().delete_record(id)
    }

    pub fn set_game_path_health(
        &self,
        game_id: &str,
        status: &str,
        checked_at: &str,
    ) -> DbResult<()> {
        self.game_repository()
            .set_path_health(game_id, status, checked_at)
    }

    #[allow(dead_code)]
    pub fn relocate_game_paths(&self, game_id: String, install_path: String) -> DbResult<Game> {
        crate::services::library_paths::relocate_game_paths(self, game_id, install_path)
    }

    pub fn update_relocated_game_paths(&self, game: &Game) -> DbResult<()> {
        self.game_repository().update_relocated_paths(game)
    }

    pub fn get_game(&self, id: String) -> DbResult<Game> {
        self.game_repository().get(id)
    }

    pub fn list_games(&self, filter: GameFilter) -> DbResult<Vec<Game>> {
        let collection_game_ids =
            if let Some(collection_id) = trim_optional(filter.collection_id.clone()) {
                Some(
                    self.collection_repository()
                        .collection_game_ids(&collection_id)?,
                )
            } else {
                None
            };
        self.game_repository()
            .list(filter, collection_game_ids.as_deref())
    }

    pub fn list_archive_import_conflict_rows(&self) -> DbResult<Vec<ArchiveImportConflictRow>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, title, install_path FROM games")?;
        let rows = stmt.query_map([], |row| {
            Ok(ArchiveImportConflictRow {
                id: row.get(0)?,
                title: row.get(1)?,
                install_path: row.get(2)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }
}

fn trim_optional(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}
