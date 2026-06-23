# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A single-file Python agent (`agent.py`) that periodically scans public sources for people actively seeking AI/automation work, qualifies each post using a Groq LLM, and logs warm leads to `leads.xlsx`.

## Commands

```bash
# Install dependencies
pip install -r requirements.txt --break-system-packages

# Run one scan cycle
python3 agent.py

# Run continuously, every 6 hours
python3 agent.py --loop

# Install as a system cron job (runs at 00:00, 06:00, 12:00, 18:00)
bash setup_scheduler.sh
```

There are no tests and no linting config in this project.

## Environment Setup

Copy `.env.example` to `.env` and populate:

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | LLM-based lead qualification (free at console.groq.com). Without it, agent falls back to keyword scoring. |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` / `REDDIT_USERNAME` / `REDDIT_PASSWORD` | Not yet implemented — reserved for a future Reddit fetcher. |

## Architecture

Everything lives in `agent.py`. The flow is:

```
main() → run_agent()
           ├─ load_or_create_workbook()     # open / create leads.xlsx
           ├─ get_existing_urls()            # deduplication set
           └─ for each source fetcher:
                ├─ fetch_hacker_news()       # Ask HN + Job posts via Firebase API
                ├─ fetch_devto()             # Articles via dev.to public REST API
                ├─ fetch_remoteok()          # Jobs via remoteok.com public JSON feed
                └─ fetch_github_discussions() # Repos via GitHub search API (no auth)
                        ↓
                  _process_posts()
                        ↓
                  qualify_lead()             # Groq LLM → structured JSON
                  _keyword_qualify()         # fallback if Groq unavailable
                        ↓
                  append_lead()             # write formatted row to worksheet
```

### Lead Qualification

`qualify_lead()` sends post title + body to Groq (`llama-3.1-8b-instant`). The LLM must return a strict JSON shape defined by the system prompt in `GROQ_SYSTEM`. The result drives what gets written to Excel: category, budget signal, `ready_to_pay` flag, `connection_intent`, summary, and an outreach hook.

`_keyword_qualify()` is the keyword fallback. It checks for payment signals (`PAYMENT_SIGNALS` list) and maps keywords to the same category taxonomy.

Only posts where `is_lead == True` are written to the spreadsheet.

### Excel Output

The workbook schema (column order and widths) is defined by `HEADERS` and `_setup_sheet()`. `append_lead()` applies alternating row colors and conditional font colors (green for "Yes" in Ready to Pay, color-coded connection intent). **Do not reorder `HEADERS` without updating `append_lead()`** — both functions use positional column indices.

Deduplication is URL-based: `get_existing_urls()` reads all existing URLs at startup and `_process_posts()` skips any URL already in the set.

### Adding New Sources

Follow the pattern of existing fetchers — return a `list[dict]` with these keys:
```python
{
    "source": str,    # display name
    "title":  str,
    "url":    str,    # used as dedup key
    "body":   str,    # truncate to ~600 chars
    "author": str,
    "upvotes": int,
    "created": str,   # "YYYY-MM-DD HH:MM"
}
```
Then add a `(name, fetcher)` tuple to the `sources` list in `run_agent()`.

## Important Note on Current State

The latest commit (`7eea2a4`) accidentally replaced `agent.py` with the string `"404: Not Found"`. The full working implementation is preserved in the initial commit (`0add618`) and is what the README and all other project files describe. Any work on this repo should restore `agent.py` from that commit or reimplement from the architecture described above.
