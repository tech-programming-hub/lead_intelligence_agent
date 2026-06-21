"""
Lead Intelligence Agent
=======================
Scans Hacker News, Dev.to, IndieHackers (RSS), and ProductHunt (RSS)
every 6 hours for people ready to pay for AI work.

Categories tracked:
  - AI agency / automation
  - White-label AI products
  - Chatbots / voice agents
  - MCP / LLM integrations
  - SaaS builds
  - Resume / HR AI tools
  - Content pipelines

Runs every 6 hours. Logs warm leads to leads.xlsx.

Usage:
  python3 agent.py          # run once immediately
  python3 agent.py --loop   # run every 6 hours continuously
"""

import os
import time
import json
import logging
import argparse
import datetime
import requests
import xml.etree.ElementTree as ET
from pathlib import Path
from dotenv import load_dotenv

from groq import Groq
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
EXCEL_PATH   = Path("leads.xlsx")
RUN_INTERVAL_HOURS = 6

# Groq client — created once, reused across all calls
_groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

HN_KEYWORDS = [
    "looking for", "need developer", "hiring", "pay for", "will pay",
    "AI agent", "LLM", "chatbot", "automation", "white label", "freelance",
    "contract", "budget", "agency",
]

DEVTO_TAGS = ["ai", "machinelearning", "llm", "python", "automation", "chatbot"]

PAYMENT_SIGNALS = [
    "will pay", "ready to pay", "budget", "$", "£", "€", "monthly",
    "per month", "contract", "hire", "paying", "salary", "rate",
    "upwork", "freelance", "fee", "revenue share", "commission",
]


# ---------------------------------------------------------------------------
# Source 1 — Hacker News (Ask HN + Jobs)
# ---------------------------------------------------------------------------

def fetch_hacker_news(limit: int = 25) -> list[dict]:
    """Fetch recent Ask HN and job posts, filter by AI/freelance keywords."""
    results = []
    for story_type in ["askstories", "jobstories"]:
        try:
            ids = requests.get(
                f"https://hacker-news.firebaseio.com/v0/{story_type}.json", timeout=10
            ).json()[:60]
            for sid in ids:
                item = requests.get(
                    f"https://hacker-news.firebaseio.com/v0/item/{sid}.json", timeout=8
                ).json() or {}
                text = f"{item.get('title','')} {item.get('text','')}".lower()
                if any(kw.lower() in text for kw in HN_KEYWORDS):
                    results.append({
                        "source": "Hacker News",
                        "title": item.get("title", ""),
                        "url": item.get("url") or f"https://news.ycombinator.com/item?id={sid}",
                        "body": (item.get("text") or "")[:600],
                        "author": item.get("by", ""),
                        "upvotes": item.get("score", 0),
                        "created": datetime.datetime.fromtimestamp(
                            item.get("time", 0)
                        ).strftime("%Y-%m-%d %H:%M"),
                    })
                if len(results) >= limit:
                    return results
        except Exception as e:
            log.warning(f"HN fetch failed [{story_type}]: {e}")
    return results


# ---------------------------------------------------------------------------
# Source 2 — Dev.to (public API, no key needed)
# ---------------------------------------------------------------------------

def fetch_devto(limit: int = 15) -> list[dict]:
    """Fetch recent Dev.to articles tagged with AI/automation topics."""
    results = []
    for tag in DEVTO_TAGS:
        try:
            resp = requests.get(
                "https://dev.to/api/articles",
                params={"tag": tag, "per_page": 10, "state": "rising"},
                headers={"User-Agent": "LeadIntelAgent/2.0"},
                timeout=10,
            )
            resp.raise_for_status()
            for a in resp.json():
                text = f"{a.get('title','')} {a.get('description','')}".lower()
                if any(sig in text for sig in ["hire", "looking for", "need", "budget", "freelance", "paid", "help wanted"]):
                    results.append({
                        "source": "Dev.to",
                        "title": a.get("title", ""),
                        "url": a.get("url", ""),
                        "body": a.get("description", "")[:600],
                        "author": a.get("user", {}).get("username", ""),
                        "upvotes": a.get("positive_reactions_count", 0),
                        "created": (a.get("published_at") or "")[:16].replace("T", " "),
                    })
            if len(results) >= limit:
                break
            time.sleep(0.5)
        except Exception as e:
            log.warning(f"Dev.to fetch failed [{tag}]: {e}")
    return results[:limit]


# ---------------------------------------------------------------------------
# Source 3 — GitHub Jobs / Discussions via public search API
# ---------------------------------------------------------------------------

def fetch_github_discussions(limit: int = 20) -> list[dict]:
    """Search GitHub Discussions for AI freelance / hiring posts."""
    queries = [
        "AI agent freelance hire",
        "LLM developer needed budget",
        "chatbot automation hire",
        "MCP integration developer",
    ]
    results = []
    headers = {"User-Agent": "LeadIntelAgent/2.0", "Accept": "application/vnd.github+json"}
    for q in queries:
        try:
            resp = requests.get(
                "https://api.github.com/search/repositories",
                params={"q": q, "sort": "updated", "per_page": 5},
                headers=headers,
                timeout=10,
            )
            if resp.status_code == 403:
                log.warning("GitHub rate limit hit, skipping")
                break
            resp.raise_for_status()
            for item in resp.json().get("items", []):
                text = f"{item.get('name','')} {item.get('description','')}".lower()
                if any(kw in text for kw in ["hire", "freelance", "pay", "budget", "wanted", "looking"]):
                    results.append({
                        "source": "GitHub",
                        "title": item.get("full_name", ""),
                        "url": item.get("html_url", ""),
                        "body": item.get("description", "")[:600],
                        "author": item.get("owner", {}).get("login", ""),
                        "upvotes": item.get("stargazers_count", 0),
                        "created": (item.get("updated_at") or "")[:16].replace("T", " "),
                    })
            if len(results) >= limit:
                break
            time.sleep(1)
        except Exception as e:
            log.warning(f"GitHub search failed [{q}]: {e}")
    return results[:limit]


# ---------------------------------------------------------------------------
# Source 4 — RemoteOK (public JSON API, no auth needed)
# ---------------------------------------------------------------------------

def fetch_remoteok(limit: int = 20) -> list[dict]:
    """Fetch AI/ML/automation jobs from RemoteOK public API."""
    tags = ["ai", "llm", "machine-learning", "python", "automation", "chatbot"]
    results = []
    try:
        resp = requests.get(
            "https://remoteok.com/api",
            headers={"User-Agent": "LeadIntelAgent/2.0"},
            timeout=12,
        )
        resp.raise_for_status()
        jobs = resp.json()
        if isinstance(jobs, list) and jobs and isinstance(jobs[0], dict) and "legal" in jobs[0]:
            jobs = jobs[1:]   # skip the first disclaimer object
        for job in jobs:
            if not isinstance(job, dict):
                continue
            job_tags = [t.lower() for t in (job.get("tags") or [])]
            if not any(t in job_tags for t in tags):
                continue
            title    = job.get("position", "")
            company  = job.get("company", "")
            desc     = job.get("description", "")[:600]
            url      = job.get("url", "") or f"https://remoteok.com/remote-jobs/{job.get('id','')}"
            salary   = job.get("salary", "") or ""
            results.append({
                "source": "RemoteOK",
                "title": f"{title} @ {company}",
                "url": url,
                "body": f"Salary: {salary}\n\n{desc}",
                "author": company,
                "upvotes": job.get("views", 0),
                "created": (job.get("date") or "")[:16].replace("T", " "),
            })
            if len(results) >= limit:
                break
    except Exception as e:
        log.warning(f"RemoteOK fetch failed: {e}")
    return results


# ---------------------------------------------------------------------------
# Lead qualification via Groq LLM
# ---------------------------------------------------------------------------

GROQ_SYSTEM = """You are a lead qualification expert for Anup Verma, an AI/LLM specialist.
His services: AI agents, MCP integrations, chatbots, voice agents, white-label SaaS,
Flask+Python backends, ResumeRole (ATS/HR AI), AgentPulse framework. Rate: $45/hr.

Given a post title and body, respond ONLY in JSON with this exact shape:
{
  "is_lead": true/false,
  "category": "ai-agency|white-label|automation|chatbot|saas|resume-hr|mcp-llm|voice-ai|content-pipeline|other",
  "budget_signal": "$X-$Y or monthly/contract or 'none detected'",
  "ready_to_pay": true/false,
  "connection_intent": "high|medium|low",
  "summary": "One sentence why this is/isn't a good lead.",
  "outreach_hook": "One sentence personalised opener for a cold message."
}
Return ONLY the JSON object, no markdown, no extra text."""


def qualify_lead(title: str, body: str) -> dict | None:
    """Score a post using Groq LLM, fallback to keywords if unavailable."""
    if not _groq_client:
        return _keyword_qualify(title, body)
    prompt = f"POST TITLE: {title}\n\nPOST BODY: {body[:800]}"
    try:
        resp = _groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": GROQ_SYSTEM},
                {"role": "user",   "content": prompt},
            ],
            temperature=0.1,
            max_tokens=300,
        )
        raw = resp.choices[0].message.content.strip()
        # Strip accidental markdown fences
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)
    except Exception as e:
        log.warning(f"Groq qualify failed: {e}")
        return _keyword_qualify(title, body)


def _keyword_qualify(title: str, body: str) -> dict:
    """Keyword fallback scorer when Groq is unavailable."""
    text = f"{title} {body}".lower()
    has_payment = any(sig.lower() in text for sig in PAYMENT_SIGNALS)
    ai_topic    = any(kw in text for kw in ["ai", "llm", "chatbot", "automation", "agent", "gpt"])
    cat = "other"
    for kw, c in [
        ("white label", "white-label"), ("rebrand", "white-label"),
        ("resume", "resume-hr"), ("ats", "resume-hr"),
        ("chatbot", "chatbot"), ("chat bot", "chatbot"),
        ("mcp", "mcp-llm"), ("llm", "mcp-llm"),
        ("voice", "voice-ai"),
        ("automation", "automation"), ("workflow", "automation"),
        ("saas", "saas"), ("startup", "saas"),
        ("content", "content-pipeline"),
    ]:
        if kw in text:
            cat = c
            break
    if cat == "other" and ai_topic:
        cat = "ai-agency"
    return {
        "is_lead": ai_topic and has_payment,
        "category": cat,
        "budget_signal": "detected" if has_payment else "none detected",
        "ready_to_pay": has_payment,
        "connection_intent": "high" if has_payment else ("medium" if ai_topic else "low"),
        "summary": "Keyword: AI topic + payment signal" if (ai_topic and has_payment) else "Low relevance",
        "outreach_hook": f"I saw your post about {title[:60]}… I build exactly this.",
    }


# ---------------------------------------------------------------------------
# Excel logging
# ---------------------------------------------------------------------------

HEADERS = [
    "Date Found", "Source", "Title", "URL", "Author",
    "Category", "Budget Signal", "Ready to Pay", "Connection Intent",
    "Summary", "Outreach Hook", "Upvotes", "Post Time", "Status",
]
HEADER_COLOR = "1A1A2E"
ROW_COLOR_A  = "F8F8FC"
ROW_COLOR_B  = "FFFFFF"


def _setup_sheet(ws):
    """Format the header row of a new worksheet."""
    for col, header in enumerate(HEADERS, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font      = Font(bold=True, color="FFFFFF", name="Arial", size=11)
        cell.fill      = PatternFill("solid", fgColor=HEADER_COLOR)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border    = Border(bottom=Side(style="medium", color="FFFFFF"))
    ws.row_dimensions[1].height = 32
    for col, w in enumerate([14,18,45,50,18,16,18,12,16,50,60,8,16,14], 1):
        ws.column_dimensions[get_column_letter(col)].width = w
    ws.freeze_panes = "A2"


def load_or_create_workbook():
    """Load existing workbook or create a fresh one."""
    if EXCEL_PATH.exists():
        wb = load_workbook(EXCEL_PATH)
        ws = wb.active
    else:
        wb = Workbook()
        ws = wb.active
        ws.title = "Leads"
        _setup_sheet(ws)
    return wb, ws


def get_existing_urls(ws) -> set:
    """Return set of already-logged URLs (deduplication)."""
    return {row[3] for row in ws.iter_rows(min_row=2, values_only=True) if row[3]}


def append_lead(ws, post: dict, qual: dict):
    """Write one qualified lead as a formatted row."""
    row_num    = ws.max_row + 1
    fill_color = ROW_COLOR_A if row_num % 2 == 0 else ROW_COLOR_B
    values = [
        datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        post.get("source", ""),
        post.get("title", ""),
        post.get("url", ""),
        post.get("author", ""),
        qual.get("category", ""),
        qual.get("budget_signal", ""),
        "Yes" if qual.get("ready_to_pay") else "No",
        qual.get("connection_intent", ""),
        qual.get("summary", ""),
        qual.get("outreach_hook", ""),
        post.get("upvotes", 0),
        post.get("created", ""),
        "New",
    ]
    for col, val in enumerate(values, 1):
        cell           = ws.cell(row=row_num, column=col, value=val)
        cell.fill      = PatternFill("solid", fgColor=fill_color)
        cell.font      = Font(name="Arial", size=10)
        cell.alignment = Alignment(vertical="top", wrap_text=True)
        if col in (4, 11):
            cell.font = Font(name="Arial", size=10, color="185FA5")
        if col == 8 and val == "Yes":
            cell.font = Font(name="Arial", size=10, bold=True, color="3B6D11")
        if col == 9:
            colours = {"high": "993C1D", "medium": "BA7517", "low": "5F5E5A"}
            cell.font = Font(name="Arial", size=10, bold=True,
                             color=colours.get((val or "").lower(), "000000"))


# ---------------------------------------------------------------------------
# Main agent
# ---------------------------------------------------------------------------

def _process_posts(ws, posts: list[dict], existing_urls: set) -> int:
    """Qualify and save a list of posts. Returns count added."""
    added = 0
    for post in posts:
        if not post.get("url") or post["url"] in existing_urls:
            continue
        qual = qualify_lead(post["title"], post["body"])
        if qual and qual.get("is_lead"):
            append_lead(ws, post, qual)
            existing_urls.add(post["url"])
            added += 1
            log.info(f"  ✓ Lead: {post['title'][:65]} [{qual['category']}]")
        time.sleep(0.3)   # gentle rate limiting between Groq calls
    return added


def run_agent():
    """One full scan cycle across all sources."""
    log.info("=" * 60)
    log.info("Lead Intelligence Agent — starting scan")
    log.info("=" * 60)

    wb, ws       = load_or_create_workbook()
    existing     = get_existing_urls(ws)
    total_added  = 0

    sources = [
        ("Hacker News",  fetch_hacker_news),
        ("Dev.to",       fetch_devto),
        ("RemoteOK",     fetch_remoteok),
        ("GitHub",       fetch_github_discussions),
    ]

    for name, fetcher in sources:
        log.info(f"Scanning {name}…")
        try:
            posts = fetcher()
            log.info(f"  Fetched {len(posts)} posts")
            added = _process_posts(ws, posts, existing)
            total_added += added
        except Exception as e:
            log.warning(f"  {name} source failed: {e}")

    wb.save(EXCEL_PATH)
    log.info(f"\n✅ Scan complete — {total_added} new leads added → {EXCEL_PATH}")
    return total_added


def main():
    parser = argparse.ArgumentParser(description="Lead Intelligence Agent")
    parser.add_argument("--loop", action="store_true", help="Run every 6 hours continuously")
    args = parser.parse_args()

    if args.loop:
        while True:
            run_agent()
            next_run = datetime.datetime.now() + datetime.timedelta(hours=RUN_INTERVAL_HOURS)
            log.info(f"Next run at {next_run.strftime('%Y-%m-%d %H:%M')}. Sleeping…")
            time.sleep(RUN_INTERVAL_HOURS * 3600)
    else:
        run_agent()


if __name__ == "__main__":
    main()
