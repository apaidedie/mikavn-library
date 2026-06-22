use crate::db::models::DashboardData;
use crate::db::{Database, DbResult};

pub fn dashboard(db: &Database) -> DbResult<DashboardData> {
    db.dashboard()
}
