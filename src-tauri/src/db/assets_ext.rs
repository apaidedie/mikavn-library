use crate::db::models::{AssetInput, Game, GameAsset, TagRecord};
use crate::db::{Database, DbResult};

impl Database {
    pub fn list_game_assets(&self, game_id: String) -> DbResult<Vec<GameAsset>> {
        self.get_game(game_id.clone())?;
        self.asset_tag_repository().list_game_assets(game_id)
    }

    pub fn upsert_game_asset(&self, game_id: String, input: AssetInput) -> DbResult<GameAsset> {
        self.get_game(game_id.clone())?;
        self.asset_tag_repository()
            .upsert_game_asset(game_id, input)
    }

    pub fn remove_game_asset(&self, id: String) -> DbResult<Game> {
        let game_id = self.asset_tag_repository().remove_game_asset(id)?;
        self.get_game(game_id)
    }

    pub fn set_primary_asset(&self, id: String) -> DbResult<Game> {
        let game_id = self.asset_tag_repository().set_primary_asset(id)?;
        self.get_game(game_id)
    }

    pub fn list_tags(&self, kind: Option<String>) -> DbResult<Vec<TagRecord>> {
        self.asset_tag_repository().list_tags(kind)
    }

    pub fn sync_game_assets(&self, game: &Game, source: Option<&str>) -> DbResult<()> {
        self.asset_tag_repository().sync_game_assets(game, source)
    }

    pub fn sync_game_tags(&self, game: &Game) -> DbResult<()> {
        self.asset_tag_repository().sync_game_tags(game)
    }
}
