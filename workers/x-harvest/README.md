# X harvester

Feeds the `scrape-events` pipeline with Nigerian web3 events that are announced
on X (and optionally Reddit and Exa web search) before they ever reach Luma.

It does not extract events itself. It finds registration links, writes them into
`user_submitted_events`, then pings `scrape-events`, which already enriches the
page, runs the AI extractor, dedupes, scores and posts to Telegram.

## Why it runs in CI instead of the edge function

`scrape-events` is Deno on Supabase Edge. Reading X without a paid API means
[Agent Reach](https://github.com/Panniantong/Agent-Reach) routing `twitter-cli`,
which is Python plus a cookie jar on disk. Neither runs at the edge, so this
runs twice a day on a GitHub Actions runner.

## Secrets to add (Settings > Secrets and variables > Actions)

| Secret | Required | What it is |
|---|---|---|
| `SUPABASE_URL` | yes | `https://ttxlwhsgmqxknfhozwmg.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role key, Supabase dashboard > Project settings > API |
| `TWITTER_AUTH_TOKEN` | for the X lane | `auth_token` cookie from x.com, exported with Cookie-Editor |
| `TWITTER_CT0` | for the X lane | `ct0` cookie from the same export |
| `EXA_API_KEY` | optional | Free 1000 searches/month at exa.ai |

Every lane is optional. Missing credentials skip that lane, they never fail the
run. With no secrets at all the workflow still runs and reports zero candidates.

## Running it by hand

```bash
pip install "git+https://github.com/Panniantong/Agent-Reach.git@main"
python workers/x-harvest/harvest.py --dry-run     # find candidates, write nothing
```

## Filtering

A candidate has to carry a web3 word, a Nigeria word, and event-shaped language,
and contain a link to a platform we can enrich (Luma, Eventbrite, Meetup,
Paystack, Tickettailor and friends). Loosen `WEB3_TERMS`, `NG_TERMS` or
`EVENT_TERMS` in `harvest.py` if the yield is too thin; watch `scrape_logs` for
what the pipeline accepted versus rejected.
