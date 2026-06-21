# Lead Intelligence Agent

Scans Reddit, Hacker News (expandable to Upwork/LinkedIn) every 6 hours.
Finds people who are ready to pay for AI work. Logs warm leads to `leads.xlsx`.

## Setup

```bash
cd lead_intelligence_agent
pip install -r requirements.txt --break-system-packages
cp .env.example .env
# Edit .env and add your GROQ_API_KEY (free at console.groq.com)
```

## Run once

```bash
python3 agent.py
```

## Run every 6 hours (via cron)

```bash
bash setup_scheduler.sh
```

## What gets logged to leads.xlsx

| Column | What it means |
|---|---|
| Date Found | When the agent spotted it |
| Source | Reddit r/X, Hacker News, etc. |
| Title | Post title |
| URL | Direct link to the post |
| Author | Username — reach out directly |
| Category | ai-agency / white-label / chatbot / mcp-llm / saas / etc. |
| Budget Signal | $ amount or "monthly contract" detected in text |
| Ready to Pay | Yes/No (LLM scored) |
| Connection Intent | High / Medium / Low |
| Summary | Why it's a good (or bad) lead |
| Outreach Hook | Pre-written opener for your cold message |
| Status | New → Contacted → Warm → Closed |

## Opportunity categories tracked

- AI agency services (custom AI builds)
- White-label AI products (rebrandable tools)
- Workflow automation (n8n/Zapier replacement)
- Custom chatbots and voice agents
- SaaS builds (non-technical founders with budget)
- Resume / HR AI tools (ATS, screening)
- MCP / LLM integrations (dev teams)
- Voice AI agents (Pipecat-style phone bots)
- AI content pipelines (automated writing)
- AI analytics / natural language dashboards

## Extending the agent

To add more sources, add a function following the pattern of `fetch_reddit()`
or `fetch_hacker_news()` and call it inside `run_agent()`.

Upwork and LinkedIn require OAuth — add them when you have API access.
IndieHackers, ProductHunt, and X can be added via their APIs or RSS feeds.
