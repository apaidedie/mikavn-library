use chrono::{DateTime, Utc};

use crate::db::models::{
    CreateLaunchProfileInput, LaunchProfile, PlaySession, UpdateLaunchProfileInput,
};
use crate::db::{Database, DbResult};

impl Database {
    pub fn update_relocated_launch_profile_paths(
        &self,
        game_id: &str,
        old_install: &str,
        new_install: &str,
        updated_at: &str,
    ) -> DbResult<()> {
        self.launch_repository().update_relocated_profile_paths(
            game_id,
            old_install,
            new_install,
            updated_at,
        )
    }

    pub fn create_play_session(
        &self,
        game_id: String,
        launch_profile_id: Option<String>,
    ) -> DbResult<PlaySession> {
        self.get_game(game_id.clone())?;
        self.launch_repository()
            .create_play_session(game_id, launch_profile_id)
    }

    pub fn finish_play_session(
        &self,
        session_id: String,
        exit_status: Option<String>,
    ) -> DbResult<()> {
        self.launch_repository()
            .finish_play_session(session_id, exit_status)
    }

    pub fn list_play_sessions(&self, game_id: String, limit: i64) -> DbResult<Vec<PlaySession>> {
        self.get_game(game_id.clone())?;
        self.launch_repository().list_play_sessions(game_id, limit)
    }

    pub fn create_launch_profile(
        &self,
        input: CreateLaunchProfileInput,
    ) -> DbResult<LaunchProfile> {
        self.get_game(input.game_id.clone())?;
        self.launch_repository().create_launch_profile(input)
    }

    pub fn list_launch_profiles(&self, game_id: String) -> DbResult<Vec<LaunchProfile>> {
        self.get_game(game_id.clone())?;
        self.launch_repository().list_launch_profiles(game_id)
    }

    pub fn get_launch_profile(&self, id: &str) -> DbResult<LaunchProfile> {
        self.launch_repository().get_launch_profile(id)
    }

    pub fn get_default_launch_profile(&self, game_id: &str) -> DbResult<Option<LaunchProfile>> {
        self.launch_repository().get_default_launch_profile(game_id)
    }

    pub fn update_launch_profile(
        &self,
        id: String,
        input: UpdateLaunchProfileInput,
    ) -> DbResult<LaunchProfile> {
        self.launch_repository().update_launch_profile(id, input)
    }

    pub fn delete_launch_profile(&self, id: String) -> DbResult<()> {
        self.launch_repository().delete_launch_profile(id)
    }

    pub fn set_default_launch_profile(&self, id: String) -> DbResult<LaunchProfile> {
        self.launch_repository().set_default_launch_profile(id)
    }

    pub fn play_seconds_since(&self, since: DateTime<Utc>) -> DbResult<i64> {
        self.launch_repository().play_seconds_since(since)
    }
}
