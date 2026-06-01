use crate::db::models::DashboardData;
use crate::db::{Database, DbResult};
use crate::services::dashboard as dashboard_service;

impl Database {
    pub fn dashboard(&self) -> DbResult<DashboardData> {
        dashboard_service::dashboard(self)
    }
}
