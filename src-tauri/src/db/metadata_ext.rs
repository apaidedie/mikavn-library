use crate::db::models::{
    ArtworkProviderIdRow, ArtworkRepairCandidateRow, BatchMatchJob, BatchMatchStatus,
    DescriptionImageProviderIdRow, DescriptionImageRepairCandidateRow, DuplicateExternalIdAuditRow,
    ExternalIdRecord, FieldLock, Game, MetadataSourceRecord,
};
use crate::db::{Database, DbResult};
use crate::repositories::metadata_matches::InsertMatchResultInput;

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

    pub fn insert_match_result(&self, input: InsertMatchResultInput<'_>) -> DbResult<()> {
        self.metadata_match_repository().insert_match_result(input)
    }

    pub fn match_status(&self, job_id: String) -> DbResult<BatchMatchStatus> {
        self.metadata_match_repository().match_status(job_id)
    }

    pub fn missing_metadata_game_ids(&self) -> DbResult<Vec<String>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id
            FROM games
            WHERE NOT (
              TRIM(COALESCE(description, '')) <> ''
              AND TRIM(COALESCE(release_date, '')) <> ''
              AND (TRIM(COALESCE(developer, '')) <> '' OR TRIM(COALESCE(brand, '')) <> '')
              AND TRIM(COALESCE(cover_image, '')) <> ''
              AND (
                TRIM(COALESCE(vndb_id, '')) <> ''
                OR TRIM(COALESCE(bangumi_id, '')) <> ''
                OR TRIM(COALESCE(dlsite_id, '')) <> ''
                OR TRIM(COALESCE(fanza_id, '')) <> ''
                OR TRIM(COALESCE(ymgal_id, '')) <> ''
              )
            )
            ORDER BY updated_at DESC, title ASC
            "#,
        )?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
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

    pub fn list_duplicate_external_id_audit_rows(
        &self,
    ) -> DbResult<Vec<DuplicateExternalIdAuditRow>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT provider, external_id, game_id, title, install_path, source
            FROM (
              SELECT 'vndb' AS provider, vndb_id AS external_id, id AS game_id, title, install_path, 'games.vndb_id' AS source
              FROM games
              UNION ALL
              SELECT 'bangumi' AS provider, bangumi_id AS external_id, id AS game_id, title, install_path, 'games.bangumi_id' AS source
              FROM games
              UNION ALL
              SELECT 'dlsite' AS provider, dlsite_id AS external_id, id AS game_id, title, install_path, 'games.dlsite_id' AS source
              FROM games
              UNION ALL
              SELECT 'fanza' AS provider, fanza_id AS external_id, id AS game_id, title, install_path, 'games.fanza_id' AS source
              FROM games
              UNION ALL
              SELECT 'ymgal' AS provider, ymgal_id AS external_id, id AS game_id, title, install_path, 'games.ymgal_id' AS source
              FROM games
              UNION ALL
              SELECT
                e.provider,
                e.external_id,
                g.id AS game_id,
                g.title,
                g.install_path,
                CASE
                  WHEN TRIM(COALESCE(e.source, '')) <> '' THEN 'external_ids:' || e.source
                  ELSE 'external_ids'
                END AS source
              FROM external_ids e
              INNER JOIN games g ON g.id = e.game_id
            )
            WHERE TRIM(COALESCE(provider, '')) <> ''
              AND TRIM(COALESCE(external_id, '')) <> ''
            ORDER BY title ASC, game_id ASC, provider ASC, source ASC
            "#,
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(DuplicateExternalIdAuditRow {
                provider: row.get(0)?,
                external_id: row.get(1)?,
                game_id: row.get(2)?,
                title: row.get(3)?,
                install_path: row.get(4)?,
                source: row.get(5)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn list_artwork_repair_candidate_rows(&self) -> DbResult<Vec<ArtworkRepairCandidateRow>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, title, cover_image, banner_image, background_image FROM games
            WHERE TRIM(COALESCE(cover_image, '')) = ''
               OR TRIM(COALESCE(banner_image, '')) = ''
               OR TRIM(COALESCE(background_image, '')) = ''
            ORDER BY updated_at DESC, title ASC
            "#,
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ArtworkRepairCandidateRow {
                id: row.get(0)?,
                title: row.get(1)?,
                cover_image: row.get(2)?,
                banner_image: row.get(3)?,
                background_image: row.get(4)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn list_artwork_provider_id_rows(&self) -> DbResult<Vec<ArtworkProviderIdRow>> {
        let missing_artwork_where = r#"
            TRIM(COALESCE(g.cover_image, '')) = ''
            OR TRIM(COALESCE(g.banner_image, '')) = ''
            OR TRIM(COALESCE(g.background_image, '')) = ''
        "#;
        let sql = format!(
            r#"
            SELECT game_id, provider, external_id
            FROM (
              SELECT g.id AS game_id, 'vndb' AS provider, g.vndb_id AS external_id
              FROM games g
              WHERE {missing_artwork_where}
              UNION ALL
              SELECT g.id AS game_id, 'dlsite' AS provider, g.dlsite_id AS external_id
              FROM games g
              WHERE {missing_artwork_where}
              UNION ALL
              SELECT g.id AS game_id, 'fanza' AS provider, g.fanza_id AS external_id
              FROM games g
              WHERE {missing_artwork_where}
              UNION ALL
              SELECT e.game_id, e.provider, e.external_id
              FROM external_ids e
              INNER JOIN games g ON g.id = e.game_id
              WHERE ({missing_artwork_where})
                AND LOWER(TRIM(e.provider)) IN ('vndb', 'dlsite', 'fanza')
            )
            WHERE TRIM(COALESCE(provider, '')) <> ''
              AND TRIM(COALESCE(external_id, '')) <> ''
            ORDER BY game_id ASC, provider ASC, external_id ASC
            "#
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map([], |row| {
            Ok(ArtworkProviderIdRow {
                game_id: row.get(0)?,
                provider: row.get(1)?,
                external_id: row.get(2)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn list_description_image_repair_candidate_rows(
        &self,
    ) -> DbResult<Vec<DescriptionImageRepairCandidateRow>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, title, description FROM games
            WHERE TRIM(COALESCE(description, '')) <> ''
            ORDER BY updated_at DESC, title ASC
            "#,
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(DescriptionImageRepairCandidateRow {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn list_description_image_provider_id_rows(
        &self,
    ) -> DbResult<Vec<DescriptionImageProviderIdRow>> {
        let description_where = "TRIM(COALESCE(g.description, '')) <> ''";
        let sql = format!(
            r#"
            SELECT game_id, provider, external_id
            FROM (
              SELECT g.id AS game_id, 'dlsite' AS provider, g.dlsite_id AS external_id
              FROM games g
              WHERE {description_where}
              UNION ALL
              SELECT g.id AS game_id, 'fanza' AS provider, g.fanza_id AS external_id
              FROM games g
              WHERE {description_where}
              UNION ALL
              SELECT e.game_id, e.provider, e.external_id
              FROM external_ids e
              INNER JOIN games g ON g.id = e.game_id
              WHERE {description_where}
                AND LOWER(TRIM(e.provider)) IN ('dlsite', 'fanza')
            )
            WHERE TRIM(COALESCE(provider, '')) <> ''
              AND TRIM(COALESCE(external_id, '')) <> ''
            ORDER BY game_id ASC, provider ASC, external_id ASC
            "#
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map([], |row| {
            Ok(DescriptionImageProviderIdRow {
                game_id: row.get(0)?,
                provider: row.get(1)?,
                external_id: row.get(2)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
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
