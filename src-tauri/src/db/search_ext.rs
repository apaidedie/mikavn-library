use crate::db::models::{
    AdvancedSearchInput, AdvancedSearchResult, SavedSearch, SavedSearchInput, SearchQueryValidation,
};
use crate::db::{Database, DbResult};
use crate::services::search;

impl Database {
    pub fn list_saved_searches(&self) -> DbResult<Vec<SavedSearch>> {
        self.saved_search_repository().list_saved_searches()
    }

    pub fn create_saved_search(&self, input: SavedSearchInput) -> DbResult<SavedSearch> {
        self.saved_search_repository().create_saved_search(input)
    }

    pub fn update_saved_search(
        &self,
        id: String,
        input: SavedSearchInput,
    ) -> DbResult<SavedSearch> {
        self.saved_search_repository()
            .update_saved_search(id, input)
    }

    pub fn delete_saved_search(&self, id: String) -> DbResult<()> {
        self.saved_search_repository().delete_saved_search(id)
    }

    #[allow(dead_code)]
    pub fn search_games_advanced(
        &self,
        input: AdvancedSearchInput,
    ) -> DbResult<AdvancedSearchResult> {
        search::search_games(self, input)
    }

    #[allow(dead_code)]
    pub fn validate_search_query(&self, query: &str) -> DbResult<SearchQueryValidation> {
        Ok(search::validate_query(query))
    }
}
