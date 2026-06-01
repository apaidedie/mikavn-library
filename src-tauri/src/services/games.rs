use crate::db::models::{AddGameInput, Game, GameFilter, UpdateGameInput};
use crate::db::{Database, DbResult};

pub fn add_game(db: &Database, input: AddGameInput) -> DbResult<Game> {
    let game = db.add_game_record(input)?;
    sync_normalized_game_records(db, &game, Some("games"))?;
    Ok(game)
}

pub fn insert_imported_game(db: &Database, game: Game) -> DbResult<Game> {
    let game = db.insert_imported_game_record(game)?;
    sync_normalized_game_records(db, &game, Some("archive_import"))?;
    Ok(game)
}

pub fn update_game(db: &Database, id: String, input: UpdateGameInput) -> DbResult<Game> {
    let game = db.update_game_record(id, input)?;
    sync_normalized_game_records(db, &game, Some("games"))?;
    Ok(game)
}

pub fn delete_game_record(db: &Database, id: String) -> DbResult<()> {
    db.delete_game_record(id)
}

pub fn get_game(db: &Database, id: String) -> DbResult<Game> {
    db.get_game(id)
}

pub fn list_games(db: &Database, filter: Option<GameFilter>) -> DbResult<Vec<Game>> {
    db.list_games(filter.unwrap_or_default())
}

pub fn sync_normalized_game_records(
    db: &Database,
    game: &Game,
    source: Option<&str>,
) -> DbResult<()> {
    db.sync_game_external_ids(game, source)?;
    db.sync_game_assets(game, source)?;
    db.sync_game_tags(game)?;
    Ok(())
}
