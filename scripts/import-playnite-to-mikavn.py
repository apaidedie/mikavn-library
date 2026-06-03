#!/usr/bin/env python3
"""Import Playnite LiteDB JSONL exports into a MikaVN SQLite database.

The script expects Playnite collections to be exported as JSONL first. It does
not delete or move game files; it only inserts or updates MikaVN records.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PLAYNITE_ID_PROVIDER = "playnite"


def main() -> int:
    args = parse_args()
    jsonl_dir = Path(args.jsonl_dir)
    db_path = Path(args.mikavn_db)
    playnite_files = Path(args.playnite_files) if args.playnite_files else None
    asset_cache_dir = Path(args.asset_cache_dir) if args.asset_cache_dir else None

    if not jsonl_dir.is_dir():
        raise SystemExit(f"JSONL directory not found: {jsonl_dir}")
    if not db_path.is_file():
        raise SystemExit(f"MikaVN database not found: {db_path}")

    data = load_playnite_data(jsonl_dir)
    games = list(load_jsonl(jsonl_dir / "games.jsonl"))
    converted = [
        convert_game_with_asset_cache(game, data, playnite_files, asset_cache_dir)
        for game in games
        if clean_text(game.get("Name"))
    ]

    print(f"Playnite games found: {len(games)}")
    print(f"MikaVN records prepared: {len(converted)}")
    print(f"Assets referenced: {sum(1 for item in converted if item['cover_image'] or item['background_image'])}")
    print(f"Launch profiles prepared: {sum(1 for item in converted if item['launch_profile'])}")

    if args.dry_run:
        print("Dry run only; database was not changed.")
        return 0

    backup_path = make_backup(db_path, Path(args.backup_dir) if args.backup_dir else db_path.parent)
    print(f"Database backup: {backup_path}")

    with sqlite3.connect(db_path) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        import_games(conn, converted)
        conn.commit()

    with sqlite3.connect(db_path) as conn:
        counts = {
            table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in ("games", "game_assets", "tags", "game_tags", "external_ids", "launch_profiles", "collections")
        }
    print("Import complete.")
    for table, count in counts.items():
        print(f"{table}: {count}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import Playnite metadata into MikaVN.")
    parser.add_argument("--jsonl-dir", required=True, help="Directory containing exported Playnite JSONL files.")
    parser.add_argument("--mikavn-db", required=True, help="Path to MikaVN mikavn.db.")
    parser.add_argument("--playnite-files", help="Path to Playnite library files directory for image references.")
    parser.add_argument("--asset-cache-dir", help="Copy Playnite images into this MikaVN image cache directory.")
    parser.add_argument("--backup-dir", help="Directory for timestamped MikaVN database backup.")
    parser.add_argument("--dry-run", action="store_true", help="Prepare records and print counts without writing.")
    return parser.parse_args()


def load_playnite_data(jsonl_dir: Path) -> dict[str, dict[str, str]]:
    return {
        "companies": load_lookup(jsonl_dir / "companies.jsonl"),
        "tags": load_lookup(jsonl_dir / "tags.jsonl"),
        "genres": load_lookup(jsonl_dir / "genres.jsonl"),
        "features": load_lookup(jsonl_dir / "features.jsonl"),
        "series": load_lookup(jsonl_dir / "series.jsonl"),
        "age_ratings": load_lookup(jsonl_dir / "ageratings.jsonl"),
        "sources": load_lookup(jsonl_dir / "sources.jsonl"),
        "completion_statuses": load_lookup(jsonl_dir / "completionstatuses.jsonl"),
    }


def load_lookup(path: Path) -> dict[str, str]:
    lookup: dict[str, str] = {}
    if not path.exists():
        return lookup
    for item in load_jsonl(path):
        item_id = clean_text(item.get("_id"))
        name = clean_text(item.get("Name"))
        if item_id and name:
            lookup[item_id] = name
    return lookup


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(unwrap_extended_json(json.loads(line)))
    return rows


def unwrap_extended_json(value: Any) -> Any:
    if isinstance(value, dict):
        if "$guid" in value:
            return value["$guid"]
        if "$date" in value:
            return value["$date"]
        if "$numberLong" in value:
            return int(value["$numberLong"])
        return {key: unwrap_extended_json(item) for key, item in value.items()}
    if isinstance(value, list):
        return [unwrap_extended_json(item) for item in value]
    return value


def convert_game(game: dict[str, Any], data: dict[str, dict[str, str]], playnite_files: Path | None) -> dict[str, Any]:
    return convert_game_with_asset_cache(game, data, playnite_files, None)


def convert_game_with_asset_cache(
    game: dict[str, Any],
    data: dict[str, dict[str, str]],
    playnite_files: Path | None,
    asset_cache_dir: Path | None,
) -> dict[str, Any]:
    playnite_id = clean_text(game.get("_id"))
    now = now_iso()
    added = to_iso(game.get("Added")) or now
    modified = to_iso(game.get("Modified")) or now
    developer = first_lookup(game.get("DeveloperIds"), data["companies"])
    publisher = first_lookup(game.get("PublisherIds"), data["companies"])
    source = data["sources"].get(clean_text(game.get("SourceId")) or "")

    tags = names_from_ids(game.get("TagIds"), data["tags"])
    tags.extend(names_from_ids(game.get("FeatureIds"), data["features"]))
    if source:
        tags.append(source)

    genres = names_from_ids(game.get("GenreIds"), data["genres"])
    age_rating = first_lookup(game.get("AgeRatingIds"), data["age_ratings"])
    cover = asset_path(
        game.get("CoverImage") or game.get("Icon"),
        playnite_files,
        asset_cache_dir,
        playnite_id,
        "cover",
    )
    background = asset_path(
        game.get("BackgroundImage"),
        playnite_files,
        asset_cache_dir,
        playnite_id,
        "background",
    )
    icon = asset_path(game.get("Icon"), playnite_files, asset_cache_dir, playnite_id, "icon")
    launch_profile = default_launch_profile(game, playnite_id)
    series_names = names_from_ids(game.get("SeriesIds"), data["series"])

    return {
        "id": playnite_id,
        "title": clean_text(game.get("Name")),
        "original_title": clean_text(game.get("SortingName")),
        "aliases": [],
        "developer": developer,
        "publisher": publisher,
        "brand": developer,
        "release_date": normalize_release_date(game.get("ReleaseDate")),
        "description": html_to_text(clean_text(game.get("Description"))),
        "notes": build_notes(game, data),
        "tags": unique(tags),
        "genres": unique(genres),
        "rating": normalize_rating(game.get("UserScore") or game.get("CommunityScore")),
        "age_rating": age_rating,
        "play_status": play_status(game, data["completion_statuses"]),
        "favorite": bool(game.get("Favorite")),
        "hidden": bool(game.get("Hidden")),
        "install_path": clean_text(game.get("InstallDirectory")) or f"playnite://{playnite_id}",
        "executable_path": launch_profile["executable_path"] if launch_profile else None,
        "working_directory": launch_profile["working_directory"] if launch_profile else clean_text(game.get("InstallDirectory")),
        "launch_args": launch_profile["arguments"] if launch_profile else None,
        "path_status": "unknown",
        "last_path_checked_at": None,
        "cover_image": cover,
        "banner_image": background,
        "background_image": background,
        "vndb_id": None,
        "bangumi_id": None,
        "dlsite_id": extract_external_id(game, "dlsite"),
        "fanza_id": extract_external_id(game, "fanza"),
        "ymgal_id": None,
        "total_play_seconds": playtime_to_seconds(game.get("Playtime")),
        "last_played_at": to_iso(game.get("LastActivity")),
        "created_at": added,
        "updated_at": modified,
        "assets": build_assets(cover, background, icon),
        "launch_profile": launch_profile,
        "series": series_names,
    }


def default_launch_profile(game: dict[str, Any], game_id: str) -> dict[str, Any] | None:
    for action in game.get("GameActions") or []:
        if not action.get("IsPlayAction"):
            continue
        path = replace_install_dir(clean_text(action.get("Path")), game)
        if not path:
            continue
        return {
            "id": stable_uuid(f"launch:{game_id}:{path}"),
            "game_id": game_id,
            "name": clean_text(action.get("Name")) or "Play",
            "executable_path": path,
            "working_directory": replace_install_dir(clean_text(action.get("WorkingDir")), game) or clean_text(game.get("InstallDirectory")),
            "arguments": clean_text(action.get("Arguments")),
            "environment_variables": None,
            "runner_type": "direct",
            "locale_emulator_path": None,
            "pre_launch_command": None,
            "post_launch_command": None,
            "run_as_admin": False,
            "is_default": True,
            "compatibility_notes": "Imported from Playnite.",
        }
    return None


def replace_install_dir(value: str | None, game: dict[str, Any]) -> str | None:
    if not value:
        return None
    install_dir = clean_text(game.get("InstallDirectory")) or ""
    return value.replace("{InstallDir}", install_dir).replace("{InstallDirNoEscape}", install_dir)


def build_notes(game: dict[str, Any], data: dict[str, dict[str, str]]) -> str | None:
    parts: list[str] = []
    game_id = clean_text(game.get("GameId"))
    if game_id:
        parts.append(f"Playnite GameId: {game_id}")
    play_count = game.get("PlayCount")
    if play_count:
        parts.append(f"Playnite PlayCount: {play_count}")
    install_size = game.get("InstallSize")
    if install_size:
        parts.append(f"Playnite InstallSize: {install_size}")
    source = data["sources"].get(clean_text(game.get("SourceId")) or "")
    if source:
        parts.append(f"Playnite Source: {source}")
    return "\n".join(parts) if parts else None


def build_assets(cover: str | None, background: str | None, icon: str | None) -> list[dict[str, str]]:
    assets: list[dict[str, str]] = []
    if cover:
        assets.append({"asset_type": "cover", "uri": cover})
    if background:
        assets.append({"asset_type": "background", "uri": background})
        assets.append({"asset_type": "banner", "uri": background})
    if icon and icon not in {cover, background}:
        assets.append({"asset_type": "screenshot", "uri": icon})
    return assets


def names_from_ids(values: Any, lookup: dict[str, str]) -> list[str]:
    result: list[str] = []
    for item_id in values or []:
        name = lookup.get(clean_text(item_id) or "")
        if name:
            result.append(name)
    return result


def first_lookup(values: Any, lookup: dict[str, str]) -> str | None:
    names = names_from_ids(values, lookup)
    return names[0] if names else None


def asset_path(
    value: Any,
    playnite_files: Path | None,
    asset_cache_dir: Path | None = None,
    game_id: str | None = None,
    role: str | None = None,
) -> str | None:
    raw = clean_text(value)
    if not raw:
        return None
    if re.match(r"^[a-z]+://", raw, re.IGNORECASE) or Path(raw).is_absolute():
        source = Path(raw) if Path(raw).is_absolute() else None
        return copy_asset(source, asset_cache_dir, game_id, role) or raw
    candidate = playnite_files / raw if playnite_files else Path(raw)
    return copy_asset(candidate, asset_cache_dir, game_id, role) or str(candidate)


def copy_asset(source: Path | None, asset_cache_dir: Path | None, game_id: str | None, role: str | None) -> str | None:
    if not source or not asset_cache_dir or not game_id or not role or not source.is_file():
        return None
    extension = source.suffix.lower() or ".jpg"
    target_dir = asset_cache_dir / "playnite-import" / game_id
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{role}{extension}"
    if not target.exists() or target.stat().st_size != source.stat().st_size:
        shutil.copy2(source, target)
    return str(target)


def play_status(game: dict[str, Any], statuses: dict[str, str]) -> str:
    status_name = statuses.get(clean_text(game.get("CompletionStatusId")) or "", "")
    if "通关" in status_name or "completed" in status_name.lower():
        return "completed"
    if "正在" in status_name or "playing" in status_name.lower():
        return "playing"
    if playtime_to_seconds(game.get("Playtime")) > 0:
        return "playing"
    return "planned"


def playtime_to_seconds(value: Any) -> int:
    try:
        # Playnite stores playtime in seconds in this library snapshot.
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def normalize_release_date(value: Any) -> str | None:
    text = clean_text(value)
    if not text:
        return None
    match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", text)
    if match:
        year, month, day = match.groups()
        return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
    match = re.match(r"^(\d{4})-(\d{1,2})$", text)
    if match:
        year, month = match.groups()
        return f"{int(year):04d}-{int(month):02d}"
    return text


def normalize_rating(value: Any) -> int | None:
    if value is None:
        return None
    try:
        rating = int(round(float(value)))
    except (TypeError, ValueError):
        return None
    return max(0, min(100, rating))


def to_iso(value: Any) -> str | None:
    text = clean_text(value)
    if not text:
        return None
    try:
        if text.endswith("Z"):
            return datetime.fromisoformat(text[:-1] + "+00:00").astimezone(timezone.utc).isoformat()
        return datetime.fromisoformat(text).astimezone(timezone.utc).isoformat()
    except ValueError:
        return text


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def html_to_text(value: str | None) -> str | None:
    if not value:
        return None
    text = re.sub(r"(?i)<br\s*/?>", "\n", value)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() or None


def extract_external_id(game: dict[str, Any], provider: str) -> str | None:
    for link in game.get("Links") or []:
        name = (clean_text(link.get("Name")) or "").lower()
        url = clean_text(link.get("Url")) or ""
        lower_url = url.lower()
        if provider == "fanza" and ("fanza" in name or "dmm.co.jp" in lower_url):
            match = re.search(r"/detail/([^/?#]+)/?", lower_url)
            return match.group(1) if match else url
        if provider == "dlsite" and ("dlsite" in name or "dlsite.com" in lower_url):
            match = re.search(r"(RJ\d+|VJ\d+|BJ\d+)", url, re.IGNORECASE)
            return match.group(1).upper() if match else url
    return None


def unique(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        key = value.casefold()
        if key not in seen:
            seen.add(key)
            result.append(value)
    return result


def stable_uuid(seed: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"mikavn-playnite-import:{seed}"))


def make_backup(db_path: Path, backup_dir: Path) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = backup_dir / f"{db_path.stem}.before-playnite-import-{timestamp}{db_path.suffix}"
    with sqlite3.connect(db_path) as source:
        with sqlite3.connect(backup_path) as target:
            source.backup(target)
    return backup_path


def import_games(conn: sqlite3.Connection, games: list[dict[str, Any]]) -> None:
    now = now_iso()
    for game in games:
        conn.execute(
            """
            INSERT INTO games (
              id, title, original_title, aliases, developer, publisher, brand, release_date, description,
              notes, tags, genres, rating, age_rating, play_status, favorite, hidden, install_path, executable_path,
              working_directory, launch_args, path_status, last_path_checked_at, cover_image, banner_image, background_image,
              vndb_id, bangumi_id, dlsite_id, fanza_id, ymgal_id, total_play_seconds, last_played_at, created_at, updated_at
            ) VALUES (
              :id, :title, :original_title, :aliases, :developer, :publisher, :brand, :release_date, :description,
              :notes, :tags, :genres, :rating, :age_rating, :play_status, :favorite, :hidden, :install_path, :executable_path,
              :working_directory, :launch_args, :path_status, :last_path_checked_at, :cover_image, :banner_image, :background_image,
              :vndb_id, :bangumi_id, :dlsite_id, :fanza_id, :ymgal_id, :total_play_seconds, :last_played_at, :created_at, :updated_at
            )
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              original_title = excluded.original_title,
              aliases = excluded.aliases,
              developer = excluded.developer,
              publisher = excluded.publisher,
              brand = excluded.brand,
              release_date = excluded.release_date,
              description = excluded.description,
              notes = excluded.notes,
              tags = excluded.tags,
              genres = excluded.genres,
              rating = excluded.rating,
              age_rating = excluded.age_rating,
              play_status = excluded.play_status,
              favorite = excluded.favorite,
              hidden = excluded.hidden,
              install_path = excluded.install_path,
              executable_path = excluded.executable_path,
              working_directory = excluded.working_directory,
              launch_args = excluded.launch_args,
              path_status = excluded.path_status,
              last_path_checked_at = excluded.last_path_checked_at,
              cover_image = excluded.cover_image,
              banner_image = excluded.banner_image,
              background_image = excluded.background_image,
              dlsite_id = excluded.dlsite_id,
              fanza_id = excluded.fanza_id,
              total_play_seconds = excluded.total_play_seconds,
              last_played_at = excluded.last_played_at,
              updated_at = excluded.updated_at
            """,
            {
                **game,
                "aliases": json.dumps(game["aliases"], ensure_ascii=False),
                "tags": json.dumps(game["tags"], ensure_ascii=False),
                "genres": json.dumps(game["genres"], ensure_ascii=False),
                "favorite": 1 if game["favorite"] else 0,
                "hidden": 1 if game["hidden"] else 0,
            },
        )
        upsert_external_id(conn, game["id"], PLAYNITE_ID_PROVIDER, game["id"], "playnite-import", 1.0, now)
        for provider in ("dlsite", "fanza"):
            value = game.get(f"{provider}_id")
            if value:
                upsert_external_id(conn, game["id"], provider, value, "playnite-import", None, now)
        sync_assets(conn, game, now)
        sync_tags(conn, game, now)
        sync_launch_profile(conn, game, now)
        sync_series_collections(conn, game, now)


def upsert_external_id(
    conn: sqlite3.Connection,
    game_id: str,
    provider: str,
    external_id: str,
    source: str,
    confidence: float | None,
    now: str,
) -> None:
    conn.execute(
        """
        INSERT INTO external_ids (id, game_id, provider, external_id, source, confidence, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(game_id, provider) DO UPDATE SET
          external_id = excluded.external_id,
          source = excluded.source,
          confidence = excluded.confidence,
          updated_at = excluded.updated_at
        """,
        (str(uuid.uuid4()), game_id, provider, external_id, source, confidence, now, now),
    )


def sync_assets(conn: sqlite3.Connection, game: dict[str, Any], now: str) -> None:
    conn.execute(
        "DELETE FROM game_assets WHERE game_id = ? AND source = 'playnite-import'",
        (game["id"],),
    )
    for asset in game["assets"]:
        conn.execute(
            """
            INSERT INTO game_assets (id, game_id, asset_type, uri, source, is_primary, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'playnite-import', 1, ?, ?)
            ON CONFLICT(game_id, asset_type, uri) DO UPDATE SET
              source = excluded.source,
              is_primary = excluded.is_primary,
              updated_at = excluded.updated_at
            """,
            (str(uuid.uuid4()), game["id"], asset["asset_type"], asset["uri"], now, now),
        )


def sync_tags(conn: sqlite3.Connection, game: dict[str, Any], now: str) -> None:
    conn.execute("DELETE FROM game_tags WHERE game_id = ?", (game["id"],))
    for kind, values in (("tag", game["tags"]), ("genre", game["genres"])):
        for name in values:
            tag_id = upsert_tag(conn, name, kind, now)
            conn.execute(
                "INSERT OR IGNORE INTO game_tags (game_id, tag_id, created_at) VALUES (?, ?, ?)",
                (game["id"], tag_id, now),
            )


def upsert_tag(conn: sqlite3.Connection, name: str, kind: str, now: str) -> str:
    conn.execute(
        """
        INSERT INTO tags (id, name, kind, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(name, kind) DO UPDATE SET updated_at = excluded.updated_at
        """,
        (str(uuid.uuid4()), name, kind, now, now),
    )
    return conn.execute("SELECT id FROM tags WHERE name = ? AND kind = ?", (name, kind)).fetchone()[0]


def sync_launch_profile(conn: sqlite3.Connection, game: dict[str, Any], now: str) -> None:
    profile = game["launch_profile"]
    if not profile:
        return
    conn.execute(
        """
        INSERT INTO launch_profiles (
          id, game_id, name, executable_path, working_directory, arguments, environment_variables,
          runner_type, locale_emulator_path, pre_launch_command, post_launch_command, run_as_admin,
          is_default, compatibility_notes, created_at, updated_at
        ) VALUES (
          :id, :game_id, :name, :executable_path, :working_directory, :arguments, :environment_variables,
          :runner_type, :locale_emulator_path, :pre_launch_command, :post_launch_command, :run_as_admin,
          :is_default, :compatibility_notes, :created_at, :updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          executable_path = excluded.executable_path,
          working_directory = excluded.working_directory,
          arguments = excluded.arguments,
          updated_at = excluded.updated_at
        """,
        {
            **profile,
            "run_as_admin": 1 if profile["run_as_admin"] else 0,
            "is_default": 1 if profile["is_default"] else 0,
            "created_at": now,
            "updated_at": now,
        },
    )


def sync_series_collections(conn: sqlite3.Connection, game: dict[str, Any], now: str) -> None:
    for series in game["series"]:
        collection_name = f"Series: {series}"
        conn.execute(
            """
            INSERT INTO collections (id, name, description, color, created_at, updated_at)
            VALUES (?, ?, 'Imported from Playnite series metadata.', NULL, ?, ?)
            ON CONFLICT(name) DO UPDATE SET updated_at = excluded.updated_at
            """,
            (str(uuid.uuid4()), collection_name, now, now),
        )
        collection_id = conn.execute("SELECT id FROM collections WHERE name = ?", (collection_name,)).fetchone()[0]
        conn.execute(
            "INSERT OR REPLACE INTO collection_games (collection_id, game_id, added_at) VALUES (?, ?, ?)",
            (collection_id, game["id"], now),
        )


if __name__ == "__main__":
    raise SystemExit(main())
