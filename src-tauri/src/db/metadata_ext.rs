use crate::db::models::{
    BatchMatchJob, BatchMatchStatus, ExternalIdRecord, FieldLock, Game, MetadataSearchResult,
    MetadataSourceRecord,
};
use crate::db::{Database, DbResult};

impl Database {
    pub fn cache_get<T: serde::de::DeserializeOwned>(&self, key: &str) -> DbResult<Option<T>> {
        self.metadata_cache_repository().get(key)
    }

    pub fn cache_set<T: serde::Serialize>(
        &self,
        key: &str,
        provider: &str,
        request: &str,
        value: &T,
        ttl_seconds: i64,
    ) -> DbResult<()> {
        self.metadata_cache_repository()
            .set(key, provider, request, value, ttl_seconds)
    }

    pub fn create_match_job(
        &self,
        game_ids: &[String],
        task_id: Option<String>,
    ) -> DbResult<BatchMatchJob> {
        self.metadata_match_repository()
            .create_match_job(game_ids, task_id)
    }

    pub fn get_match_job(&self, job_id: &str) -> DbResult<BatchMatchJob> {
        self.metadata_match_repository().get_match_job(job_id)
    }

    pub fn find_match_job_by_task_id(&self, task_id: &str) -> DbResult<Option<BatchMatchJob>> {
        self.metadata_match_repository()
            .find_match_job_by_task_id(task_id)
    }

    pub fn set_match_job_status(&self, job_id: &str, status: &str) -> DbResult<()> {
        self.metadata_match_repository()
            .set_match_job_status(job_id, status)
    }

    pub fn insert_match_result(
        &self,
        job_id: &str,
        game_id: &str,
        original_title: &str,
        cleaned_title: &str,
        selected: Option<&MetadataSearchResult>,
        status: &str,
        reason: Option<String>,
        candidates: Vec<MetadataSearchResult>,
    ) -> DbResult<()> {
        self.metadata_match_repository().insert_match_result(
            job_id,
            game_id,
            original_title,
            cleaned_title,
            selected,
            status,
            reason,
            candidates,
        )
    }

    pub fn match_status(&self, job_id: String) -> DbResult<BatchMatchStatus> {
        self.metadata_match_repository().match_status(job_id)
    }

    pub fn list_field_locks(&self, game_id: String) -> DbResult<Vec<FieldLock>> {
        self.get_game(game_id.clone())?;
        self.metadata_id_repository().list_field_locks(game_id)
    }

    pub fn set_field_lock(
        &self,
        game_id: String,
        field_name: String,
        locked_by_user: bool,
    ) -> DbResult<FieldLock> {
        self.get_game(game_id.clone())?;
        self.metadata_id_repository()
            .set_field_lock(game_id, field_name, locked_by_user)
    }

    pub fn set_field_locks(
        &self,
        game_id: String,
        field_names: Vec<String>,
        locked_by_user: bool,
    ) -> DbResult<Vec<FieldLock>> {
        self.get_game(game_id.clone())?;
        self.metadata_id_repository()
            .set_field_locks(game_id, field_names, locked_by_user)
    }

    pub fn locked_field_names(&self, game_id: &str) -> DbResult<Vec<String>> {
        self.metadata_id_repository().locked_field_names(game_id)
    }

    pub fn list_metadata_sources(&self) -> DbResult<Vec<MetadataSourceRecord>> {
        self.metadata_source_repository().list_metadata_sources()
    }

    pub fn list_external_ids(&self, game_id: String) -> DbResult<Vec<ExternalIdRecord>> {
        self.get_game(game_id.clone())?;
        self.metadata_id_repository().list_external_ids(game_id)
    }

    pub fn upsert_external_id(
        &self,
        game_id: &str,
        provider: &str,
        external_id: &str,
        source: Option<&str>,
        confidence: Option<f64>,
    ) -> DbResult<ExternalIdRecord> {
        self.get_game(game_id.to_string())?;
        self.metadata_id_repository().upsert_external_id(
            game_id,
            provider,
            external_id,
            source,
            confidence,
        )
    }

    pub fn sync_game_external_ids(&self, game: &Game, source: Option<&str>) -> DbResult<()> {
        self.metadata_id_repository()
            .sync_game_external_ids(game, source)
    }
}
