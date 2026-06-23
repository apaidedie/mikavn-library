use crate::db::models::{
    CollectionGameLink, CollectionInput, Game, GameCollection, UpdateCollectionInput,
};
use crate::db::{Database, DbResult};

impl Database {
    pub fn list_collections(&self) -> DbResult<Vec<GameCollection>> {
        self.collection_repository().list_collections()
    }

    pub fn create_collection(&self, input: CollectionInput) -> DbResult<GameCollection> {
        self.collection_repository().create_collection(input)
    }

    pub fn update_collection(
        &self,
        id: String,
        input: UpdateCollectionInput,
    ) -> DbResult<GameCollection> {
        self.collection_repository().update_collection(id, input)
    }

    pub fn delete_collection(&self, id: String) -> DbResult<()> {
        self.collection_repository().delete_collection(id)
    }

    pub fn list_collection_games(&self, collection_id: String) -> DbResult<Vec<Game>> {
        self.collection_repository()
            .list_collection_games(collection_id)
    }

    pub fn list_game_collections(&self, game_id: String) -> DbResult<Vec<GameCollection>> {
        self.get_game(game_id.clone())?;
        self.collection_repository().list_game_collections(game_id)
    }

    pub fn add_game_to_collection(
        &self,
        collection_id: String,
        game_id: String,
    ) -> DbResult<CollectionGameLink> {
        self.get_game(game_id.clone())?;
        self.collection_repository()
            .add_game_to_collection(collection_id, game_id)
    }

    pub fn remove_game_from_collection(
        &self,
        collection_id: String,
        game_id: String,
    ) -> DbResult<()> {
        self.collection_repository()
            .remove_game_from_collection(collection_id, game_id)
    }
}
