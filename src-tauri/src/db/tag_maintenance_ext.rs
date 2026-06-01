use crate::db::models::TagRecord;
use crate::db::{Database, DbResult};

impl Database {
    pub fn rename_tag(&self, id: String, name: String) -> DbResult<TagRecord> {
        self.asset_tag_repository().rename_tag(id, name)
    }

    pub fn merge_tags(&self, source_ids: Vec<String>, target_id: String) -> DbResult<TagRecord> {
        self.asset_tag_repository()
            .merge_tags(source_ids, target_id)
    }

    pub fn delete_tag(&self, id: String) -> DbResult<()> {
        self.asset_tag_repository().delete_tag(id)
    }
}
