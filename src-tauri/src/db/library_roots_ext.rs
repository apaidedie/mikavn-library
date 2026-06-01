use crate::db::models::LibraryRoot;
use crate::db::{Database, DbResult};

impl Database {
    pub fn add_library_root(&self, path: String) -> DbResult<LibraryRoot> {
        self.library_root_repository().add_library_root(path)
    }

    pub fn update_library_root(
        &self,
        id: String,
        recursive: Option<bool>,
        enabled: Option<bool>,
    ) -> DbResult<LibraryRoot> {
        self.library_root_repository()
            .update_library_root(id, recursive, enabled)
    }

    pub fn remove_library_root(&self, id: String) -> DbResult<()> {
        self.library_root_repository().remove_library_root(id)
    }

    pub fn list_library_roots(&self) -> DbResult<Vec<LibraryRoot>> {
        self.library_root_repository().list_library_roots()
    }

    pub fn get_library_root(&self, id: &str) -> DbResult<LibraryRoot> {
        self.library_root_repository().get_library_root(id)
    }
}
