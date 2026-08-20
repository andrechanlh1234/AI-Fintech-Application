"""Local backups of the SQLite database.

Runs entirely inside the app process (a background asyncio task) — no
system cron/launchd entry needed, so it works the same on any machine
this backend runs on. A backup is a real safety net against accidental
deletion, a bad migration, or disk corruption; without one, losing
cukai.db means losing every account's data with no way back.
"""

import asyncio
import shutil
from datetime import datetime, timezone
from pathlib import Path

from backend.db import DB_PATH

BACKUP_DIR = Path(__file__).parent / "backups"
KEEP_LAST = 14  # ~2 weeks of hourly-or-slower backups before rotating out
INTERVAL_SECONDS = 6 * 60 * 60  # every 6 hours


def backup_now() -> Path | None:
    """Copy the live DB to a timestamped file and prune old backups. Returns
    the new backup's path, or None if there's no database yet to back up."""
    if not DB_PATH.exists():
        return None
    BACKUP_DIR.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dest = BACKUP_DIR / f"cukai-{stamp}.db"
    shutil.copy2(DB_PATH, dest)

    backups = sorted(BACKUP_DIR.glob("cukai-*.db"))
    for stale in backups[:-KEEP_LAST]:
        stale.unlink()
    return dest


async def backup_loop() -> None:
    while True:
        await asyncio.sleep(INTERVAL_SECONDS)
        backup_now()
