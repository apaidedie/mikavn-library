#!/usr/bin/env python3
"""Repair lost inline description images for MikaVN metadata records.

The Playnite migration imported many shop descriptions after HTML tags had
already been stripped, leaving big blank gaps where DLsite/FANZA introduction
images used to be. This script keeps the existing text, fetches the provider
page with the companion Playwright helper, downloads valid images into the
portable MikaVN app-data image folder, and inserts local Markdown image links.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


IMAGE_TOKEN_RE = re.compile(
    r"!\[[^\]]*\]\([^)]*\)|<img\b|\[img\]|https?://\S+\.(?:png|jpe?g|webp|gif)",
    re.IGNORECASE,
)
VALID_DLSITE_RE = re.compile(r"^(?:RJ|VJ)\d{5,}$", re.IGNORECASE)
VALID_FANZA_RE = re.compile(r"^[a-z0-9][a-z0-9_]{2,}$", re.IGNORECASE)
IMAGE_EXT_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
DEFAULT_APP_DATA_DIR_NAME = "dev.mikavn.library"


@dataclass(frozen=True)
class Candidate:
    provider: str
    provider_id: str
    game_ids: tuple[str, ...]
    titles: tuple[str, ...]


def main() -> int:
    args = parse_args()
    db_path = Path(args.mikavn_db)
    image_root = Path(args.image_root)
    helper = Path(args.helper)
    state_log = Path(args.state_log)
    if not db_path.is_file():
        raise SystemExit(f"MikaVN database not found: {db_path}")
    if not helper.is_file():
        raise SystemExit(f"Playwright helper not found: {helper}")

    candidates = load_candidates(db_path, args.provider)
    attempts = load_attempt_state(state_log)
    if attempts and not args.retry_failed:
        candidates = [item for item in candidates if (item.provider, item.provider_id) not in attempts]
    if args.ids:
        wanted = {value.strip().lower() for value in args.ids.split(",") if value.strip()}
        candidates = [item for item in candidates if item.provider_id.lower() in wanted]
    if args.limit:
        candidates = candidates[: args.limit]

    print(f"Candidates: {len(candidates)}")
    if candidates:
        for item in candidates[: min(8, len(candidates))]:
            print(f"  {item.provider}:{item.provider_id} -> {len(item.game_ids)} record(s): {item.titles[0][:80]}")
    if args.dry_run or not candidates:
        print("Dry run only; database was not changed." if args.dry_run else "No work to do.")
        return 0

    backup_path = make_backup(db_path, Path(args.backup_dir) if args.backup_dir else db_path.parent)
    print(f"Database backup: {backup_path}")

    updated = 0
    fetched = 0
    skipped_no_images = 0
    failed = 0

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        for batch_start in range(0, len(candidates), args.batch_size):
            batch = candidates[batch_start : batch_start + args.batch_size]
            print(f"Fetching batch {batch_start + 1}-{batch_start + len(batch)} / {len(candidates)}")
            results = extract_images(helper, batch, args.max_images, args.timeout_ms, args.concurrency)
            by_key = {(result.get("provider"), normalize_provider_id(result.get("provider"), result.get("id"))): result for result in results}

            for candidate in batch:
                result = by_key.get((candidate.provider, candidate.provider_id))
                if not result or not result.get("ok"):
                    failed += 1
                    message = result.get("error") if result else "no result"
                    append_state(state_log, candidate, "failed", error=message)
                    print(f"  FAIL {candidate.provider}:{candidate.provider_id} {message}")
                    continue
                fetched += 1
                images = result.get("images") or []
                if not images:
                    skipped_no_images += 1
                    append_state(state_log, candidate, "no_images", title=result.get("title"), url=result.get("url"))
                    print(f"  SKIP {candidate.provider}:{candidate.provider_id} no valid provider images")
                    continue

                local_images = download_images(candidate, images, image_root)
                if not local_images:
                    skipped_no_images += 1
                    append_state(state_log, candidate, "download_failed", title=result.get("title"), url=result.get("url"))
                    print(f"  SKIP {candidate.provider}:{candidate.provider_id} no downloadable images")
                    continue

                for game_id in candidate.game_ids:
                    row = conn.execute("SELECT description FROM games WHERE id=?", (game_id,)).fetchone()
                    if not row:
                        continue
                    description = row["description"] or ""
                    if IMAGE_TOKEN_RE.search(description):
                        continue
                    patched = insert_image_links(description, local_images)
                    conn.execute(
                        "UPDATE games SET description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                        (patched, game_id),
                    )
                    updated += 1
                conn.commit()
                append_state(
                    state_log,
                    candidate,
                    "updated",
                    title=result.get("title"),
                    url=result.get("url"),
                    images=[item["path"] for item in local_images],
                    updated_records=len(candidate.game_ids),
                )
                print(f"  OK {candidate.provider}:{candidate.provider_id} images={len(local_images)} records={len(candidate.game_ids)}")

    print("Repair complete.")
    print(f"Fetched provider pages: {fetched}")
    print(f"Updated game records: {updated}")
    print(f"Skipped without images: {skipped_no_images}")
    print(f"Failed provider requests: {failed}")
    return 0


def parse_args() -> argparse.Namespace:
    default_root = default_app_data_root()
    parser = argparse.ArgumentParser(description="Repair MikaVN description image links from DLsite/FANZA pages.")
    parser.add_argument("--app-data-root", default=str(default_root), help="MikaVN app-data root. Defaults to MIKAVN_APP_DATA_DIR or %%APPDATA%%\\dev.mikavn.library.")
    parser.add_argument("--mikavn-db", help="Path to mikavn.db. Defaults to <app-data-root>\\mikavn.db.")
    parser.add_argument("--image-root", help="Where downloaded description images are stored. Defaults to <app-data-root>\\images\\metadata.")
    parser.add_argument("--helper", default=str(Path(__file__).with_name("extract-description-images.cjs")), help="Node helper that extracts provider image URLs.")
    parser.add_argument("--state-log", help="JSONL log of attempted provider IDs. Defaults to <app-data-root>\\metadata-repair\\description-images.jsonl.")
    parser.add_argument("--backup-dir", help="Directory for timestamped database backup. Defaults to <app-data-root>\\database-backups\\metadata-repair.")
    parser.add_argument("--provider", choices=["all", "dlsite", "fanza"], default="all", help="Provider to repair.")
    parser.add_argument("--ids", help="Comma-separated provider IDs to repair first, e.g. RJ01409751,VJ01001172.")
    parser.add_argument("--limit", type=int, default=0, help="Maximum unique provider IDs to process.")
    parser.add_argument("--batch-size", type=int, default=4, help="Unique provider IDs per Playwright helper run.")
    parser.add_argument("--concurrency", type=int, default=2, help="Concurrent browser pages used by the Node helper.")
    parser.add_argument("--max-images", type=int, default=3, help="Maximum images to insert per provider item.")
    parser.add_argument("--timeout-ms", type=int, default=45000, help="Navigation timeout for each provider URL.")
    parser.add_argument("--retry-failed", action="store_true", help="Retry provider IDs already recorded as failed or skipped in the state log.")
    parser.add_argument("--dry-run", action="store_true", help="Print candidates without changing the database.")
    args = parser.parse_args()
    app_data_root = Path(args.app_data_root).expanduser()
    args.mikavn_db = args.mikavn_db or str(app_data_root / "mikavn.db")
    args.image_root = args.image_root or str(app_data_root / "images" / "metadata")
    args.state_log = args.state_log or str(app_data_root / "metadata-repair" / "description-images.jsonl")
    args.backup_dir = args.backup_dir or str(app_data_root / "database-backups" / "metadata-repair")
    return args


def default_app_data_root() -> Path:
    override = os.environ.get("MIKAVN_APP_DATA_DIR")
    if override and override.strip():
        return Path(override.strip()).expanduser()
    appdata = os.environ.get("APPDATA")
    if appdata and appdata.strip():
        return Path(appdata.strip()) / DEFAULT_APP_DATA_DIR_NAME
    return Path.home() / ".local" / "share" / DEFAULT_APP_DATA_DIR_NAME


def load_candidates(db_path: Path, provider_filter: str) -> list[Candidate]:
    grouped: dict[tuple[str, str], dict[str, list[str]]] = {}
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT id,title,dlsite_id,fanza_id,description
            FROM games
            WHERE coalesce(dlsite_id,'')<>'' OR coalesce(fanza_id,'')<>''
            ORDER BY title COLLATE NOCASE, id
            """
        ).fetchall()

    for row in rows:
        description = row["description"] or ""
        if not description.strip() or IMAGE_TOKEN_RE.search(description):
            continue
        provider, provider_id = choose_provider(row, provider_filter)
        if not provider or not provider_id:
            continue
        key = (provider, provider_id)
        bucket = grouped.setdefault(key, {"game_ids": [], "titles": []})
        bucket["game_ids"].append(row["id"])
        bucket["titles"].append(row["title"] or row["id"])

    return [
        Candidate(provider=provider, provider_id=provider_id, game_ids=tuple(data["game_ids"]), titles=tuple(data["titles"]))
        for (provider, provider_id), data in grouped.items()
    ]


def choose_provider(row: sqlite3.Row, provider_filter: str) -> tuple[str | None, str | None]:
    dlsite_id = normalize_provider_id("dlsite", row["dlsite_id"])
    fanza_id = normalize_provider_id("fanza", row["fanza_id"])
    if provider_filter in ("all", "dlsite") and dlsite_id and VALID_DLSITE_RE.match(dlsite_id):
        return "dlsite", dlsite_id
    if provider_filter in ("all", "fanza") and fanza_id and VALID_FANZA_RE.match(fanza_id) and fanza_id != "none":
        return "fanza", fanza_id
    return None, None


def normalize_provider_id(provider: Any, value: Any) -> str:
    provider_text = str(provider or "").lower()
    clean = str(value or "").strip()
    if provider_text == "dlsite":
        return clean.upper()
    return clean.lower()


def make_backup(db_path: Path, backup_dir: Path) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = backup_dir / f"mikavn.before-description-image-batch-{stamp}.db"
    shutil.copy2(db_path, backup_path)
    return backup_path


def load_attempt_state(state_log: Path) -> set[tuple[str, str]]:
    attempts: set[tuple[str, str]] = set()
    if not state_log.is_file():
        return attempts
    with state_log.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            provider = str(item.get("provider") or "").lower()
            provider_id = normalize_provider_id(provider, item.get("provider_id"))
            if provider and provider_id:
                attempts.add((provider, provider_id))
    return attempts


def append_state(state_log: Path, candidate: Candidate, status: str, **extra: Any) -> None:
    state_log.parent.mkdir(parents=True, exist_ok=True)
    item = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "provider": candidate.provider,
        "provider_id": candidate.provider_id,
        "status": status,
        "game_ids": list(candidate.game_ids),
        "titles": list(candidate.titles),
    }
    item.update({key: value for key, value in extra.items() if value is not None})
    with state_log.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(item, ensure_ascii=False) + "\n")


def extract_images(helper: Path, candidates: list[Candidate], max_images: int, timeout_ms: int, concurrency: int) -> list[dict[str, Any]]:
    items = [{"provider": item.provider, "id": item.provider_id} for item in candidates]
    process = subprocess.run(
        [
            "node",
            str(helper),
            "--items-json",
            "-",
            "--max-images",
            str(max_images),
            "--timeout-ms",
            str(timeout_ms),
            "--concurrency",
            str(concurrency),
        ],
        input=json.dumps(items, ensure_ascii=False),
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if process.stderr.strip():
        print(process.stderr.strip(), file=sys.stderr)
    if process.returncode != 0:
        raise SystemExit(f"Playwright helper failed with exit code {process.returncode}")
    results: list[dict[str, Any]] = []
    for line in process.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            results.append(json.loads(line))
        except json.JSONDecodeError:
            print(f"Ignoring non-JSON helper output: {line[:200]}", file=sys.stderr)
    return results


def download_images(candidate: Candidate, images: list[dict[str, Any]], image_root: Path) -> list[dict[str, str]]:
    out_dir = image_root / candidate.provider / candidate.provider_id
    out_dir.mkdir(parents=True, exist_ok=True)
    downloaded: list[dict[str, str]] = []

    for index, image in enumerate(images, start=1):
        url = str(image.get("src") or "").strip()
        if not url:
            continue
        ext = suffix_from_url(url) or ".jpg"
        target = out_dir / f"description-{index}{ext}"
        if not valid_image_file(target):
            if not download_one(url, target):
                continue
        heading = sanitize_alt(str(image.get("heading") or ""))
        alt = sanitize_alt(str(image.get("heading") or image.get("alt") or f"简介图片 {index}"))
        downloaded.append({"path": str(target), "alt": alt, "heading": heading})
    return downloaded


def download_one(url: str, target: Path) -> bool:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
            data = response.read()
    except Exception:
        return False
    if content_type and content_type not in IMAGE_EXT_BY_TYPE:
        return False
    if len(data) < 1024:
        return False
    target.write_bytes(data)
    detected_ext = IMAGE_EXT_BY_TYPE.get(content_type)
    if detected_ext and target.suffix.lower() != detected_ext:
        renamed = target.with_suffix(detected_ext)
        target.replace(renamed)
    return True


def valid_image_file(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size < 1024:
        return False
    head = path.read_bytes()[:16]
    return head.startswith(b"\xff\xd8\xff") or head.startswith(b"\x89PNG\r\n\x1a\n") or head.startswith(b"RIFF") or head.startswith(b"GIF")


def suffix_from_url(url: str) -> str:
    clean = url.split("?", 1)[0].lower()
    for suffix in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        if clean.endswith(suffix):
            return ".jpg" if suffix == ".jpeg" else suffix
    return ""


def insert_image_links(description: str, images: list[dict[str, str]]) -> str:
    patched = description.rstrip()
    appended: list[str] = []
    inserted_headings: set[str] = set()
    for item in images:
        link = f"![{item['alt']}]({item['path']})"
        heading = item.get("heading") or ""
        if heading and heading not in inserted_headings and heading in patched:
            patched = patched.replace(heading, f"{heading}\n\n{link}", 1)
            inserted_headings.add(heading)
        else:
            appended.append(link)
    if appended:
        patched = patched.rstrip() + "\n\n" + "\n\n".join(appended)
    return patched


def sanitize_alt(value: str) -> str:
    clean = value.replace("[", " ").replace("]", " ").replace("\r", " ").replace("\n", " ")
    clean = " ".join(clean.split())
    return clean[:80] or "简介图片"


if __name__ == "__main__":
    raise SystemExit(main())
