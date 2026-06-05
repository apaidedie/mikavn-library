use crate::db::models::{
    DuplicateGameMergeOptions, DuplicateGameMergePreview, DuplicateGameMergeResult,
};
use crate::db::{Database, DbResult};

pub fn preview_duplicate_game_merge(
    db: &Database,
    options: DuplicateGameMergeOptions,
) -> DbResult<DuplicateGameMergePreview> {
    db.preview_duplicate_game_merge(options)
}

pub fn merge_duplicate_games(
    db: &Database,
    options: DuplicateGameMergeOptions,
) -> DbResult<DuplicateGameMergeResult> {
    db.merge_duplicate_games(options)
}
