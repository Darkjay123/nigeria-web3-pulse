#!/usr/bin/env python3
"""Harvest Nigerian web3 event chatter from X (and optionally Reddit / Exa)
and hand it to the existing scrape-events pipeline as submissions.

Why a separate worker: scrape-events runs on Deno at the edge, and the tools
that can actually read X without a paid API (Agent Reach routing twitter-cli)
are Python binaries that need a cookie jar on disk. So this runs on a schedule
in CI, finds candidate links, and writes them into user_submitted_events.
The edge function then does what it already does well: enrich the page, run the
AI extractor, dedupe, score and post to Telegram. No extraction logic is
duplicated here.

Every lane is optional. A lane with no credentials is skipped, never fatal.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from urllib import error, parse, request

# A candidate needs a web3 word AND a Nigeria word. One alone is too noisy:
# "web3 meetup" pulls the whole planet, "Lagos" pulls every party in the city.
WEB3_TERMS = [
    "web3", "blockchain", "crypto", "defi", "nft", "dao", "onchain", "on-chain",
    "ethereum", "solana", "polygon", "bitcoin", "stablecoin", "token", "wallet",
    "smart contract", "zk", "dapp", "hackathon", "builder", "ambassador",
]
NG_TERMS = [
    "nigeria", "naija", "lagos", "abuja", "ibadan", "benin city", "port harcourt",
    "enugu", "kano", "ilorin", "calabar", "uyo", "abeokuta", "jos", "owerri",
    "awka", "akure", "zaria", "kaduna", "asaba", "warri", "nsukka", "futo",
    "unilag", "lasu", "uniben", "uniabuja", "abu zaria",
]
# Event-shaped language. A tweet about a token price is not an event.
EVENT_TERMS = [
    "event", "meetup", "conference", "summit", "workshop", "bootcamp", "hackathon",
    "webinar", "twitter space", "x space", "register", "rsvp", "tickets", "join us",
    "happening", "we are hosting", "we're hosting", "campus tour", "masterclass",
]

# Links worth submitting. Anything else is chatter we cannot enrich.
LINK_RE = re.compile(
    r"https?://(?:www\.)?(lu\.ma|luma\.com|eventbrite\.[a-z.]+|meetup\.com|"
    r"tickettailor\.com|paystack\.(?:com|shop)|eventbee\.com|hopin\.com|"
    r"airmeet\.com|zeeg\.me|calendly\.com)/\S+",
    re.I,
)

X_QUERIES = [
    "web3 event nigeria",
    "blockchain conference nigeria",
    "crypto meetup lagos",
    "web3 abuja",
    "blockchain campus nigeria",
    "web3 hackathon nigeria",
]
REDDIT_QUERIES = ["nigeria web3 event", "nigeria crypto meetup"]
EXA_QUERIES = [
    "upcoming web3 blockchain event in Nigeria registration page",
    "Nigeria crypto conference 2026 tickets",
]


def log(msg: str) -> None:
    print(f"[harvest] {msg}", flush=True)


def has(text: str, terms: list[str]) -> bool:
    low = text.lower()
    return any(t in low for t in terms)


def looks_like_event(text: str) -> bool:
    return has(text, WEB3_TERMS) and has(text, NG_TERMS) and has(text, EVENT_TERMS)


def run_reach(target: str, query: str, limit: int, timeout: int = 120) -> str | None:
    """Call Agent Reach. Returns raw stdout, or None when the lane is unusable."""
    exe = shutil.which("agent-reach")
    cmd = [exe] if exe else [sys.executable, "-m", "agent_reach.cli"]
    cmd += ["get", target, query, "--json", "--limit", str(limit)]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
        log(f"{target}: unavailable ({exc.__class__.__name__})")
        return None
    if proc.returncode != 0:
        log(f"{target}: exit {proc.returncode} {proc.stderr.strip()[:160]}")
        return None
    return proc.stdout


def texts_from_payload(raw: str) -> list[str]:
    """Agent Reach envelopes differ per channel, so walk whatever came back and
    collect every string field. We only need text plus links, not a schema."""
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return [raw]

    out: list[str] = []

    def walk(node, depth=0):
        if depth > 8:
            return
        if isinstance(node, str):
            if len(node) > 25:
                out.append(node)
        elif isinstance(node, list):
            for item in node:
                walk(item, depth + 1)
        elif isinstance(node, dict):
            parts = [str(node[k]) for k in ("text", "title", "body", "content", "url", "link")
                     if isinstance(node.get(k), str)]
            if parts:
                out.append(" ".join(parts))
            for value in node.values():
                if isinstance(value, (dict, list)):
                    walk(value, depth + 1)

    walk(payload)
    return out


def collect(channel: str, queries: list[str], limit: int) -> list[dict]:
    found: list[dict] = []
    for q in queries:
        raw = run_reach(channel, q, limit)
        if not raw:
            continue
        for text in texts_from_payload(raw):
            if not looks_like_event(text):
                continue
            for match in LINK_RE.finditer(text):
                found.append({
                    "link": match.group(0).rstrip(").,\"'"),
                    "raw_text": text.strip()[:1500],
                    "source": channel,
                })
    log(f"{channel}: {len(found)} candidate links across {len(queries)} queries")
    return found


def dedup_hash(link: str) -> str:
    norm = re.sub(r"[?#].*$", "", link.lower().rstrip("/"))
    return hashlib.sha256(norm.encode()).hexdigest()[:32]


def supabase(method: str, path: str, url: str, key: str, body=None, headers=None):
    req = request.Request(
        f"{url.rstrip('/')}/rest/v1/{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
    )
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with request.urlopen(req, timeout=45) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw.strip() else None)
    except error.HTTPError as exc:
        return exc.code, exc.read().decode()[:400]


def main() -> int:
    ap = argparse.ArgumentParser(description="Harvest NG web3 events from X/Reddit/Exa")
    ap.add_argument("--dry-run", action="store_true", help="find candidates, write nothing")
    ap.add_argument("--limit", type=int, default=25, help="results per query")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not args.dry_run and not (url and key):
        log("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing, nothing can be written")
        return 1

    candidates: list[dict] = []

    if os.environ.get("TWITTER_AUTH_TOKEN") and os.environ.get("TWITTER_CT0"):
        candidates += collect("twitter.search", X_QUERIES, args.limit)
    else:
        log("x lane skipped: no TWITTER_AUTH_TOKEN / TWITTER_CT0")

    if os.environ.get("REDDIT_ENABLED") == "1":
        candidates += collect("reddit.search", REDDIT_QUERIES, args.limit)

    if os.environ.get("EXA_API_KEY"):
        candidates += collect("exa_search", EXA_QUERIES, args.limit)

    # One row per link, keeping the longest text we saw for it.
    best: dict[str, dict] = {}
    for c in candidates:
        h = dedup_hash(c["link"])
        if h not in best or len(c["raw_text"]) > len(best[h]["raw_text"]):
            best[h] = c

    log(f"{len(best)} unique candidates after dedupe")
    for h, c in list(best.items())[:15]:
        log(f"  {c['source']:15} {c['link']}")

    if args.dry_run:
        log("dry run, nothing written")
        return 0
    if not best:
        log("nothing to submit")
        return 0

    # Skip links already sitting in the submissions queue or the events table.
    hashes = list(best.keys())
    status, existing = supabase(
        "GET",
        "user_submitted_events?select=dedup_hash&dedup_hash=in.(" + ",".join(hashes) + ")",
        url, key,
    )
    known = {r["dedup_hash"] for r in existing} if status == 200 and isinstance(existing, list) else set()

    rows = [{
        "link": c["link"],
        "raw_text": c["raw_text"],
        "dedup_hash": h,
        "submitted_by": [f"harvester:{c['source']}"],
        "processed": False,
    } for h, c in best.items() if h not in known]

    if not rows:
        log("all candidates already queued")
        return 0

    status, body = supabase(
        "POST", "user_submitted_events", url, key, rows,
        headers={"Prefer": "return=representation,resolution=ignore-duplicates"},
    )
    if status not in (200, 201):
        log(f"insert failed: {status} {body}")
        return 1

    log(f"queued {len(rows)} submissions at {datetime.now(timezone.utc).isoformat()}")

    # Nudge the pipeline so the new rows get enriched on this run, not in six hours.
    fn = f"{url.rstrip('/')}/functions/v1/scrape-events"
    req = request.Request(fn, method="POST", data=b"{}")
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    try:
        with request.urlopen(req, timeout=300) as resp:
            log(f"pipeline triggered: {resp.status} {resp.read().decode()[:300]}")
    except Exception as exc:  # noqa: BLE001 - the queue is written either way
        log(f"pipeline trigger failed (rows are queued regardless): {exc}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
