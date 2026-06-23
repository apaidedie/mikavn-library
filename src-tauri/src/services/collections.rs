use crate::db::models::{
    CollectionGameLink, CollectionInput, Game, GameCollection, UpdateCollectionInput,
};
use crate::db::{Database, DbResult};

pub fn list_collections(db: &Database) -> DbResult<Vec<GameCollection>> {
    db.list_collections()
}

pub fn create_collection(db: &Database, input: CollectionInput) -> DbResult<GameCollection> {
    db.create_collection(input)
}

pub fn update_collection(
    db: &Database,
    id: String,
    input: UpdateCollectionInput,
) -> DbResult<GameCollection> {
    db.update_collection(id, input)
}

pub fn delete_collection(db: &Database, id: String) -> DbResult<()> {
    db.delete_collection(id)
}

pub fn list_collection_games(db: &Database, collection_id: String) -> DbResult<Vec<Game>> {
    db.list_collection_games(collection_id)
}

pub fn list_game_collections(db: &Database, game_id: String) -> DbResult<Vec<GameCollection>> {
    db.list_game_collections(game_id)
}

pub fn add_game_to_collection(
    db: &Database,
    collection_id: String,
    game_id: String,
) -> DbResult<CollectionGameLink> {
    db.add_game_to_collection(collection_id, game_id)
}

pub fn remove_game_from_collection(
    db: &Database,
    collection_id: String,
    game_id: String,
) -> DbResult<()> {
    db.remove_game_from_collection(collection_id, game_id)
}
