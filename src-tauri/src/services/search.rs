use chrono::{DateTime, Utc};

use std::collections::HashSet;

use crate::db::models::{
    AdvancedSearchInput, AdvancedSearchResult, Game, GameFilter, SavedSearch, SavedSearchInput,
    SearchClause, SearchQueryValidation,
};
use crate::db::{Database, DbResult};

#[derive(Debug, Clone, PartialEq)]
enum Logic {
    And,
    Or,
}

#[derive(Debug, Clone)]
struct ParsedClause {
    clause: SearchClause,
    logic_before: Logic,
}

pub fn validate_query(query: &str) -> SearchQueryValidation {
    let parsed = parse_query(query);
    SearchQueryValidation {
        valid: parsed.errors.is_empty(),
        errors: parsed.errors,
        clauses: parsed.clauses.into_iter().map(|item| item.clause).collect(),
    }
}

pub fn search_games(db: &Database, input: AdvancedSearchInput) -> DbResult<AdvancedSearchResult> {
    let parsed = parse_query(&input.query);
    if !parsed.errors.is_empty() {
        return Ok(AdvancedSearchResult {
            query: input.query,
            cleaned_query: parsed.cleaned_query,
            total: 0,
            games: Vec::new(),
            clauses: parsed.clauses.into_iter().map(|item| item.clause).collect(),
            errors: parsed.errors,
        });
    }

    let mut games = db.list_games(advanced_search_prefilter(&input, &parsed.clauses))?;

    let collection_ids = collection_scoped_game_ids(db, &parsed.clauses)?;
    if !parsed.clauses.is_empty() {
        games.retain(|game| matches_query(game, &parsed.clauses, &collection_ids));
    }

    sort_games(
        &mut games,
        input.sort_by.as_deref(),
        input.sort_direction.as_deref(),
    );
    let total = games.len() as i64;
    if let Some(limit) = input.limit.map(|value| value.clamp(1, 500)) {
        games.truncate(limit as usize);
    }

    Ok(AdvancedSearchResult {
        query: input.query,
        cleaned_query: parsed.cleaned_query,
        total,
        games,
        clauses: parsed.clauses.into_iter().map(|item| item.clause).collect(),
        errors: Vec::new(),
    })
}

pub fn validate_search_query(query: String) -> SearchQueryValidation {
    validate_query(&query)
}

pub fn list_saved_searches(db: &Database) -> DbResult<Vec<SavedSearch>> {
    db.list_saved_searches()
}

pub fn create_saved_search(db: &Database, input: SavedSearchInput) -> DbResult<SavedSearch> {
    db.create_saved_search(input)
}

pub fn update_saved_search(
    db: &Database,
    id: String,
    input: SavedSearchInput,
) -> DbResult<SavedSearch> {
    db.update_saved_search(id, input)
}

pub fn delete_saved_search(db: &Database, id: String) -> DbResult<()> {
    db.delete_saved_search(id)
}

fn advanced_search_prefilter(input: &AdvancedSearchInput, clauses: &[ParsedClause]) -> GameFilter {
    let mut filter = GameFilter {
        sort_by: input.sort_by.clone(),
        sort_direction: input.sort_direction.clone(),
        ..Default::default()
    };

    for parsed in required_prefilter_clauses(clauses) {
        if parsed.clause.negated {
            continue;
        }
        if parsed.clause.kind != "field" {
            continue;
        }

        match parsed.clause.field.as_deref() {
            Some("status") if filter.status.is_none() => {
                if let Some(status) = canonical_play_status(&parsed.clause.value) {
                    filter.status = Some(status);
                }
            }
            Some("meta") if filter.metadata_status.is_none() => {
                if let Some(status) = canonical_metadata_status(&parsed.clause.value) {
                    filter.metadata_status = Some(status);
                }
            }
            _ => {}
        }
    }

    filter
}

fn required_prefilter_clauses(clauses: &[ParsedClause]) -> &[ParsedClause] {
    let start = clauses
        .iter()
        .rposition(|item| item.logic_before == Logic::Or)
        .map(|index| index + 1)
        .unwrap_or(0);
    &clauses[start..]
}

fn canonical_play_status(value: &str) -> Option<String> {
    let status = normalize_text(value);
    matches!(
        status.as_str(),
        "planned" | "playing" | "completed" | "paused" | "archived"
    )
    .then_some(status)
}

fn canonical_metadata_status(value: &str) -> Option<String> {
    let key = metadata_status_key(value);
    let canonical = match key.as_str() {
        "complete" => "complete",
        "needsmetadata" | "missing" => "missing",
        "missingdescription" => "missing_description",
        "missingcover" => "missing_cover",
        "missingbanner" => "missing_banner",
        "missingbackground" => "missing_background",
        "missingartwork" => "missing_artwork",
        "missingdescriptionimage" => "missing_description_image",
        "missingexternalid" => "missing_external_id",
        _ => return None,
    };
    Some(canonical.to_string())
}

struct ParsedQuery {
    cleaned_query: String,
    clauses: Vec<ParsedClause>,
    errors: Vec<String>,
}

fn parse_query(query: &str) -> ParsedQuery {
    let tokens = tokenize(query);
    let mut logic = Logic::And;
    let mut clauses = Vec::new();
    let mut errors = Vec::new();

    for raw_token in tokens {
        if raw_token.eq_ignore_ascii_case("OR") {
            logic = Logic::Or;
            continue;
        }
        if raw_token.eq_ignore_ascii_case("AND") {
            logic = Logic::And;
            continue;
        }

        match parse_clause(&raw_token) {
            Ok(clause) => {
                clauses.push(ParsedClause {
                    clause,
                    logic_before: logic.clone(),
                });
                logic = Logic::And;
            }
            Err(error) => errors.push(error),
        }
    }

    ParsedQuery {
        cleaned_query: query.trim().to_string(),
        clauses,
        errors,
    }
}

fn tokenize(query: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;

    for ch in query.chars() {
        if let Some(active_quote) = quote {
            if ch == active_quote {
                quote = None;
            } else {
                current.push(ch);
            }
            continue;
        }

        if ch == '"' || ch == '\'' {
            quote = Some(ch);
            continue;
        }

        if ch.is_whitespace() {
            if !current.is_empty() {
                tokens.push(std::mem::take(&mut current));
            }
        } else {
            current.push(ch);
        }
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

fn parse_clause(token: &str) -> Result<SearchClause, String> {
    let mut token = token.trim().to_string();
    if token.is_empty() {
        return Err("empty search token".to_string());
    }
    let negated = token.starts_with('-');
    if negated {
        token = token[1..].trim().to_string();
    }
    if token.is_empty() {
        return Err("negated search token is empty".to_string());
    }

    for operator in [">=", "<=", ">", "<", "="] {
        if let Some((field, value)) = token.split_once(operator) {
            let field = normalize_field(field);
            let value = value.trim().to_string();
            if field.is_empty() || value.is_empty() {
                return Err(format!("invalid comparison token: {token}"));
            }
            if !comparison_field_supported(&field) {
                return Err(format!("unsupported comparison field: {field}"));
            }
            return Ok(SearchClause {
                kind: "comparison".to_string(),
                field: Some(field),
                operator: Some(operator.to_string()),
                value,
                negated,
            });
        }
    }

    if let Some((field, value)) = token.split_once(':') {
        let field = normalize_field(field);
        let value = value.trim().to_string();
        if field.is_empty() || value.is_empty() {
            return Err(format!("invalid field token: {token}"));
        }
        if !field_supported(&field) {
            return Err(format!("unsupported search field: {field}"));
        }
        return Ok(SearchClause {
            kind: "field".to_string(),
            field: Some(field),
            operator: None,
            value,
            negated,
        });
    }

    Ok(SearchClause {
        kind: "term".to_string(),
        field: None,
        operator: None,
        value: token,
        negated,
    })
}

fn normalize_field(field: &str) -> String {
    match field.trim().to_ascii_lowercase().as_str() {
        "developer" => "dev".to_string(),
        "released" | "release" | "date" => "released".to_string(),
        "played" | "last_played" => "played".to_string(),
        "play_time" | "playtime" => "playtime".to_string(),
        "metadata" => "meta".to_string(),
        value => value.to_string(),
    }
}

fn field_supported(field: &str) -> bool {
    matches!(
        field,
        "tag"
            | "genre"
            | "dev"
            | "publisher"
            | "brand"
            | "status"
            | "path"
            | "meta"
            | "collection"
            | "age"
    )
}

fn comparison_field_supported(field: &str) -> bool {
    matches!(field, "rating" | "released" | "played" | "playtime")
}

fn collection_scoped_game_ids(
    db: &Database,
    clauses: &[ParsedClause],
) -> DbResult<HashSet<String>> {
    let mut ids = HashSet::new();
    for parsed in clauses
        .iter()
        .filter(|item| item.clause.field.as_deref() == Some("collection") && !item.clause.negated)
    {
        let needle = normalize_text(&parsed.clause.value);
        for collection in db.list_collections()? {
            if normalize_text(&collection.name).contains(&needle) {
                for game in db.list_collection_games(collection.id)? {
                    ids.insert(game.id);
                }
            }
        }
    }
    Ok(ids)
}

fn matches_query(game: &Game, clauses: &[ParsedClause], collection_ids: &HashSet<String>) -> bool {
    let mut result: Option<bool> = None;
    for parsed in clauses {
        let mut matched = matches_clause(game, &parsed.clause, collection_ids);
        if parsed.clause.negated {
            matched = !matched;
        }
        result = Some(match (result, &parsed.logic_before) {
            (None, _) => matched,
            (Some(current), Logic::And) => current && matched,
            (Some(current), Logic::Or) => current || matched,
        });
    }
    result.unwrap_or(true)
}

fn matches_clause(game: &Game, clause: &SearchClause, collection_ids: &HashSet<String>) -> bool {
    match clause.kind.as_str() {
        "comparison" => matches_comparison(game, clause),
        "field" => matches_field(
            game,
            clause.field.as_deref().unwrap_or_default(),
            &clause.value,
            collection_ids,
        ),
        _ => matches_term(game, &clause.value),
    }
}

fn matches_term(game: &Game, term: &str) -> bool {
    let needle = normalize_text(term);
    searchable_text(game)
        .iter()
        .any(|value| normalize_text(value).contains(&needle))
}

fn searchable_text(game: &Game) -> Vec<String> {
    let mut values = vec![
        game.title.clone(),
        game.original_title.clone().unwrap_or_default(),
        game.developer.clone().unwrap_or_default(),
        game.publisher.clone().unwrap_or_default(),
        game.brand.clone().unwrap_or_default(),
        game.description.clone().unwrap_or_default(),
        game.notes.clone().unwrap_or_default(),
        game.install_path.clone(),
        game.executable_path.clone().unwrap_or_default(),
    ];
    values.extend(game.aliases.clone());
    values.extend(game.tags.clone());
    values.extend(game.genres.clone());
    values
}

fn matches_field(game: &Game, field: &str, value: &str, collection_ids: &HashSet<String>) -> bool {
    let needle = normalize_text(value);
    match field {
        "tag" => game
            .tags
            .iter()
            .any(|item| normalize_text(item).contains(&needle)),
        "genre" => game
            .genres
            .iter()
            .any(|item| normalize_text(item).contains(&needle)),
        "dev" => [game.developer.as_deref(), game.brand.as_deref()]
            .into_iter()
            .flatten()
            .any(|item| normalize_text(item).contains(&needle)),
        "publisher" => game
            .publisher
            .as_deref()
            .is_some_and(|item| normalize_text(item).contains(&needle)),
        "brand" => game
            .brand
            .as_deref()
            .is_some_and(|item| normalize_text(item).contains(&needle)),
        "status" => normalize_text(&game.play_status) == needle,
        "path" => {
            normalize_text(&game.path_status) == needle
                || normalize_text(&game.install_path).contains(&needle)
                || game
                    .executable_path
                    .as_deref()
                    .is_some_and(|item| normalize_text(item).contains(&needle))
        }
        "meta" => matches_metadata_status(game, &needle),
        "collection" => collection_ids.contains(&game.id),
        "age" => game
            .age_rating
            .as_deref()
            .is_some_and(|item| normalize_text(item).contains(&needle)),
        _ => false,
    }
}

fn matches_metadata_status(game: &Game, status: &str) -> bool {
    match metadata_status_key(status).as_str() {
        "complete" => has_metadata(game),
        "needsmetadata" | "missing" => !has_metadata(game),
        "missingdescription" => !has_text(&game.description),
        "missingcover" => !has_text(&game.cover_image),
        "missingbanner" => !has_text(&game.banner_image),
        "missingbackground" => !has_text(&game.background_image),
        "missingartwork" => {
            !has_text(&game.cover_image)
                || !has_text(&game.banner_image)
                || !has_text(&game.background_image)
        }
        "missingdescriptionimage" => {
            has_provider_id(game) && !has_description_image(&game.description)
        }
        "missingexternalid" => external_id_count(game) == 0,
        _ => false,
    }
}

fn metadata_status_key(value: &str) -> String {
    value.to_lowercase().replace([' ', '　', '-', '_'], "")
}

fn has_metadata(game: &Game) -> bool {
    has_text(&game.description)
        && has_text(&game.release_date)
        && (has_text(&game.developer) || has_text(&game.brand))
        && has_text(&game.cover_image)
        && external_id_count(game) > 0
}

fn has_provider_id(game: &Game) -> bool {
    has_text(&game.dlsite_id) || has_text(&game.fanza_id)
}

fn has_description_image(value: &Option<String>) -> bool {
    let Some(value) = value.as_deref() else {
        return false;
    };
    let lower = value.to_lowercase();
    lower.contains("![")
        || lower.contains("<img")
        || lower.contains("[img]")
        || [".jpg", ".jpeg", ".png", ".webp", ".gif"]
            .iter()
            .any(|extension| lower.contains(extension))
}

fn has_text(value: &Option<String>) -> bool {
    value
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
}

fn external_id_count(game: &Game) -> usize {
    [
        game.vndb_id.as_deref(),
        game.bangumi_id.as_deref(),
        game.dlsite_id.as_deref(),
        game.fanza_id.as_deref(),
        game.ymgal_id.as_deref(),
    ]
    .into_iter()
    .flatten()
    .filter(|value| !value.trim().is_empty())
    .count()
}

fn matches_comparison(game: &Game, clause: &SearchClause) -> bool {
    let field = clause.field.as_deref().unwrap_or_default();
    let op = clause.operator.as_deref().unwrap_or("=");
    let value = clause.value.trim();
    match field {
        "rating" => compare_i64(game.rating, parse_i64(value), op),
        "playtime" => compare_i64(
            Some(game.total_play_seconds),
            parse_duration_seconds(value),
            op,
        ),
        "released" => compare_date(game.release_date.as_deref(), value, op),
        "played" => compare_date(game.last_played_at.as_deref(), value, op),
        _ => false,
    }
}

fn compare_i64(left: Option<i64>, right: Option<i64>, op: &str) -> bool {
    let (Some(left), Some(right)) = (left, right) else {
        return false;
    };
    match op {
        ">=" => left >= right,
        "<=" => left <= right,
        ">" => left > right,
        "<" => left < right,
        _ => left == right,
    }
}

fn parse_i64(value: &str) -> Option<i64> {
    value.trim().parse().ok()
}

fn parse_duration_seconds(value: &str) -> Option<i64> {
    let trimmed = value.trim().to_ascii_lowercase();
    if let Some(hours) = trimmed.strip_suffix('h') {
        return hours
            .trim()
            .parse::<f64>()
            .ok()
            .map(|value| (value * 3600.0).round() as i64);
    }
    if let Some(minutes) = trimmed.strip_suffix('m') {
        return minutes
            .trim()
            .parse::<f64>()
            .ok()
            .map(|value| (value * 60.0).round() as i64);
    }
    trimmed.parse::<i64>().ok()
}

fn compare_date(left: Option<&str>, right: &str, op: &str) -> bool {
    let Some(left) = left.and_then(parse_date_sort_key) else {
        return false;
    };
    let Some(right) = parse_date_sort_key(right) else {
        return false;
    };
    match op {
        ">=" => left >= right,
        "<=" => left <= right,
        ">" => left > right,
        "<" => left < right,
        _ => left == right,
    }
}

fn parse_date_sort_key(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(value) = DateTime::parse_from_rfc3339(trimmed) {
        return Some(
            value
                .with_timezone(&Utc)
                .format("%Y-%m-%dT%H:%M:%S")
                .to_string(),
        );
    }
    Some(trimmed.to_string())
}

fn sort_games(games: &mut [Game], sort_by: Option<&str>, sort_direction: Option<&str>) {
    let sort_by = sort_by.unwrap_or("updated_at");
    games.sort_by_key(|game| sort_key(game, sort_by));
    if sort_direction.unwrap_or("desc") != "asc" {
        games.reverse();
    }
}

fn sort_key(game: &Game, sort_by: &str) -> String {
    match sort_by {
        "title" => game.title.clone(),
        "created_at" => game.created_at.clone(),
        "last_played_at" => game.last_played_at.clone().unwrap_or_default(),
        "release_date" => game.release_date.clone().unwrap_or_default(),
        "rating" => format!("{:03}", game.rating.unwrap_or(-1)),
        _ => game.updated_at.clone(),
    }
}

fn normalize_text(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .replace([' ', '　', '-', '_'], "")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::{AddGameInput, CollectionInput};
    use uuid::Uuid;

    #[test]
    fn validates_terms_fields_and_comparisons() {
        let result = validate_query(r#"星 tag:纯爱 -status:archived rating>=80 playtime>=10h"#);
        assert!(result.valid);
        assert_eq!(result.clauses.len(), 5);
        assert!(result.clauses.iter().any(
            |clause| clause.kind == "comparison" && clause.field.as_deref() == Some("playtime")
        ));
    }

    #[test]
    fn rejects_unknown_field() {
        let result = validate_query("foo:bar");
        assert!(!result.valid);
        assert!(result.errors[0].contains("unsupported"));
    }

    #[test]
    fn advanced_search_prefilter_uses_only_safe_required_clauses() {
        let parsed = parse_query("status:playing meta:missing_artwork rating>=80");
        let filter = advanced_search_prefilter(
            &AdvancedSearchInput {
                query: parsed.cleaned_query.clone(),
                sort_by: Some("rating".to_string()),
                sort_direction: Some("desc".to_string()),
                limit: Some(200),
            },
            &parsed.clauses,
        );

        assert_eq!(filter.status.as_deref(), Some("playing"));
        assert_eq!(filter.metadata_status.as_deref(), Some("missing_artwork"));
        assert_eq!(filter.sort_by.as_deref(), Some("rating"));
        assert_eq!(filter.sort_direction.as_deref(), Some("desc"));
        assert_eq!(filter.limit, None);
    }

    #[test]
    fn advanced_search_prefilter_preserves_or_and_fuzzy_field_semantics() {
        let parsed = parse_query("status:playing OR status:planned tag:love dev:Key 星");
        let filter = advanced_search_prefilter(
            &AdvancedSearchInput {
                query: parsed.cleaned_query.clone(),
                sort_by: Some("title".to_string()),
                sort_direction: Some("asc".to_string()),
                limit: None,
            },
            &parsed.clauses,
        );

        assert_eq!(filter.status, None);
        assert_eq!(filter.metadata_status, None);
        assert_eq!(filter.query, None);
        assert_eq!(filter.tag, None);
        assert_eq!(filter.developer, None);
        assert_eq!(filter.sort_by.as_deref(), Some("title"));
        assert_eq!(filter.sort_direction.as_deref(), Some("asc"));
    }

    #[test]
    fn search_games_applies_boolean_fields_collections_and_comparisons() {
        let db = test_db("advanced-search");
        let collection = db
            .create_collection(CollectionInput {
                name: "Favorites".to_string(),
                description: None,
                color: None,
            })
            .unwrap();
        let first = db
            .add_game(AddGameInput {
                title: "Stella Pure".to_string(),
                aliases: Some(vec!["終のステラ".to_string()]),
                developer: Some("Key".to_string()),
                release_date: Some("2022-09-30".to_string()),
                tags: Some(vec!["pure love".to_string()]),
                genres: Some(vec!["Visual Novel".to_string()]),
                rating: Some(92),
                install_path: "D:\\Games\\Stella Pure".to_string(),
                ..add_game_input("Stella Pure", "D:\\Games\\Stella Pure")
            })
            .unwrap();
        let second = db
            .add_game(AddGameInput {
                title: "Archived Drama".to_string(),
                developer: Some("Other".to_string()),
                release_date: Some("2018-01-01".to_string()),
                tags: Some(vec!["drama".to_string()]),
                rating: Some(70),
                play_status: Some("archived".to_string()),
                install_path: "D:\\Games\\Archived Drama".to_string(),
                ..add_game_input("Archived Drama", "D:\\Games\\Archived Drama")
            })
            .unwrap();
        let third = db
            .add_game(AddGameInput {
                title: "Bright Moe".to_string(),
                developer: Some("Palette".to_string()),
                release_date: Some("2024-04-01".to_string()),
                tags: Some(vec!["moege".to_string()]),
                rating: Some(86),
                install_path: "D:\\Games\\Bright Moe".to_string(),
                ..add_game_input("Bright Moe", "D:\\Games\\Bright Moe")
            })
            .unwrap();
        let provider_gap = db
            .add_game(AddGameInput {
                title: "Provider Gap".to_string(),
                description: Some("DLsite detail without image tokens".to_string()),
                dlsite_id: Some("RJ123456".to_string()),
                install_path: "D:\\Games\\Provider Gap".to_string(),
                ..add_game_input("Provider Gap", "D:\\Games\\Provider Gap")
            })
            .unwrap();
        db.add_game_to_collection(collection.id.clone(), first.id.clone())
            .unwrap();
        db.add_game_to_collection(collection.id, second.id.clone())
            .unwrap();
        add_finished_session(&db, &first.id, 11 * 3600);
        add_finished_session(&db, &second.id, 12 * 3600);
        add_finished_session(&db, &third.id, 3 * 3600);

        let result = search_games(
            &db,
            AdvancedSearchInput {
                query: r#"tag:love OR dev:Palette -status:archived rating>=80 released>=2020-01-01 playtime>=10h"#.to_string(),
                sort_by: Some("rating".to_string()),
                sort_direction: Some("desc".to_string()),
                limit: None,
            },
        )
        .unwrap();
        assert_eq!(result.total, 1);
        assert_eq!(result.games[0].id, first.id);

        let collection_result = search_games(
            &db,
            AdvancedSearchInput {
                query: "collection:Favorites -status:archived".to_string(),
                sort_by: Some("title".to_string()),
                sort_direction: Some("asc".to_string()),
                limit: Some(1),
            },
        )
        .unwrap();
        assert_eq!(collection_result.total, 1);
        assert_eq!(collection_result.games.len(), 1);
        assert_eq!(collection_result.games[0].title, "Stella Pure");

        let missing_artwork = search_games(
            &db,
            AdvancedSearchInput {
                query: "meta:missing_artwork".to_string(),
                sort_by: Some("title".to_string()),
                sort_direction: Some("asc".to_string()),
                limit: None,
            },
        )
        .unwrap();
        assert!(missing_artwork
            .games
            .iter()
            .any(|game| game.id == provider_gap.id));

        let missing_description_images = search_games(
            &db,
            AdvancedSearchInput {
                query: "meta:missing_description_image".to_string(),
                sort_by: Some("title".to_string()),
                sort_direction: Some("asc".to_string()),
                limit: None,
            },
        )
        .unwrap();
        assert_eq!(missing_description_images.total, 1);
        assert_eq!(missing_description_images.games[0].id, provider_gap.id);

        let invalid = search_games(
            &db,
            AdvancedSearchInput {
                query: "unknown:field".to_string(),
                sort_by: None,
                sort_direction: None,
                limit: None,
            },
        )
        .unwrap();
        assert_eq!(invalid.total, 0);
        assert!(!invalid.errors.is_empty());
    }

    fn test_db(name: &str) -> Database {
        let path =
            std::env::temp_dir().join(format!("mikavn-search-test-{name}-{}.db", Uuid::new_v4()));
        Database::new_from_path(path).unwrap()
    }

    fn add_game_input(title: &str, install_path: &str) -> AddGameInput {
        AddGameInput {
            title: title.to_string(),
            original_title: None,
            aliases: None,
            developer: None,
            publisher: None,
            brand: None,
            release_date: None,
            description: None,
            notes: None,
            tags: None,
            genres: None,
            rating: None,
            age_rating: None,
            play_status: None,
            favorite: None,
            hidden: None,
            install_path: install_path.to_string(),
            executable_path: None,
            working_directory: None,
            launch_args: None,
            cover_image: None,
            banner_image: None,
            background_image: None,
            vndb_id: None,
            bangumi_id: None,
            dlsite_id: None,
            fanza_id: None,
            ymgal_id: None,
        }
    }

    fn add_finished_session(db: &Database, game_id: &str, duration_seconds: i64) {
        let started = "2026-01-01T00:00:00Z";
        let ended = "2026-01-01T03:00:00Z";
        db.conn.execute(
            "INSERT INTO play_sessions (id, game_id, started_at, ended_at, duration_seconds, exit_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![Uuid::new_v4().to_string(), game_id, started, ended, duration_seconds, "0"],
        ).unwrap();
        db.conn.execute(
            "UPDATE games SET total_play_seconds = total_play_seconds + ?2, last_played_at = ?3 WHERE id = ?1",
            rusqlite::params![game_id, duration_seconds, ended],
        ).unwrap();
    }
}
