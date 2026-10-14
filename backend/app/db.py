"""Tiny SQLite layer. One connection per call so background threads stay safe."""
import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from .config import DB_PATH

SCHEMA = """
create table if not exists properties (
  id text primary key,
  tenant_name text,
  address text not null,
  city text not null,
  rent integer default 0,
  deposit integer default 0,
  landlord_name text,
  landlord_phone text,
  created_at text
);
create table if not exists inspections (
  id text primary key,
  property_id text references properties(id) on delete cascade,
  type text check (type in ('move_in','move_out')),
  locked_at text,
  lock_type text,
  created_at text
);
create table if not exists rooms (
  id text primary key,
  inspection_id text references inspections(id) on delete cascade,
  name text not null,
  video_path text,
  video_sha256 text,
  video_bytes integer,
  duration real default 0,
  status text default 'queued',
  step text,
  error text,
  ai_mode text,
  transcript text,
  frames text,
  capture_source text default 'file',
  created_at text
);
create table if not exists issues (
  id text primary key,
  room_id text references rooms(id) on delete cascade,
  item text,
  issue_type text,
  severity text,
  description text,
  frame_ts real default 0,
  frame_path text,
  source text,
  voice_quote text,
  confidence real default 0.5,
  user_edited integer default 0,
  created_at text
);
create table if not exists signoffs (
  id text primary key,
  inspection_id text references inspections(id) on delete cascade,
  token text unique not null,
  signer_name text,
  decision text,
  note text,
  ip text,
  user_agent text,
  signed_at text,
  created_at text
);
create table if not exists comparisons (
  id text primary key,
  property_id text references properties(id) on delete cascade,
  move_in_id text,
  move_out_id text,
  status text default 'queued',
  error text,
  ai_mode text,
  fair_min integer default 0,
  fair_max integer default 0,
  created_at text
);
create table if not exists comparison_items (
  id text primary key,
  comparison_id text references comparisons(id) on delete cascade,
  room_name text,
  verdict text,
  move_in_issue_id text,
  move_out_issue_id text,
  reason text,
  cost_min integer default 0,
  cost_max integer default 0
);
create index if not exists idx_insp_prop on inspections(property_id);
create index if not exists idx_rooms_insp on rooms(inspection_id);
create index if not exists idx_issues_room on issues(room_id);
create index if not exists idx_rooms_sha on rooms(video_sha256);
create index if not exists idx_cmp_items on comparison_items(comparison_id);
"""


# Columns added after the first release. The deployed database already has rows, so
# "create table if not exists" never sees them: add them here instead.
MIGRATIONS = [("rooms", "capture_source", "text default 'file'")]


def migrate(c) -> None:
    for table, col, decl in MIGRATIONS:
        have = {r["name"] for r in c.execute(f"pragma table_info({table})")}
        if col not in have:
            c.execute(f"alter table {table} add column {col} {decl}")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id() -> str:
    return uuid.uuid4().hex[:10]


@contextmanager
def conn():
    c = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    c.row_factory = sqlite3.Row
    c.execute("pragma foreign_keys = on")
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init_db() -> None:
    with conn() as c:
        c.execute("pragma journal_mode = wal")
        c.executescript(SCHEMA)
        migrate(c)
        # Anything left mid-processing from a previous run can be retried from the UI.
        c.execute(
            "update rooms set status='failed', error='Server restarted while processing. Tap retry.' "
            "where status in ('queued','processing')"
        )
        c.execute(
            "update comparisons set status='failed', error='Server restarted while comparing. Run it again.' "
            "where status in ('queued','processing')"
        )


def row(r: sqlite3.Row | None) -> dict | None:
    return dict(r) if r else None


def rows(rs) -> list[dict]:
    return [dict(r) for r in rs]


def one(sql: str, *args) -> dict | None:
    with conn() as c:
        return row(c.execute(sql, args).fetchone())


def many(sql: str, *args) -> list[dict]:
    with conn() as c:
        return rows(c.execute(sql, args).fetchall())


def run(sql: str, *args) -> None:
    with conn() as c:
        c.execute(sql, args)


def insert(table: str, data: dict) -> dict:
    cols = ", ".join(data)
    marks = ", ".join("?" for _ in data)
    with conn() as c:
        c.execute(f"insert into {table} ({cols}) values ({marks})", tuple(data.values()))
    return data


def update(table: str, id_: str, data: dict) -> None:
    sets = ", ".join(f"{k} = ?" for k in data)
    with conn() as c:
        c.execute(f"update {table} set {sets} where id = ?", (*data.values(), id_))


def dumps(v) -> str:
    return json.dumps(v, ensure_ascii=False)


def loads(v, default=None):
    if not v:
        return default
    try:
        return json.loads(v)
    except (TypeError, ValueError):
        return default
