# Business Agent

## Project Purpose

Business Agent is an automated India business news aggregator that pulls RSS feeds daily, deduplicates content, and uses AI to summarize stories into a clean, categorized Markdown digest.

## MVP Scope

- Fetches news from 3 key Indian business sources (PIB, RBI, Reuters India Business)
- Deduplicates articles and limits to 12 items max
- AI-powered summarization into one-liners (≤22 words) + 2 bullet points
- Categorizes stories: policy, markets, startups, infra, energy
- Outputs `digest.md` with organized sections
- Runtime: < 2 minutes on laptop
- File-based storage (no database)

## How to Run

### CLI Mode (Original)
1. Copy `.env.example` to `.env` and add your OpenAI API key
2. Install dependencies: `pip install -r requirements.txt`
3. Run: `python app.py`
4. Check output: `digest.md` and `run_YYYY-MM-DD.json`

### Web Application (New!)
1. Complete steps 1-2 above
2. Start web server: `python web_app.py`
3. Open browser: `http://localhost:5001`
4. Features:
   - 📱 Pinterest-style responsive cards
   - 🔄 One-click news refresh
   - 🎨 Category-based color coding
   - 📊 Real-time statistics
   - 🔗 Direct source links

## Output Files

- `digest.md` - Daily business news digest organized by category
- `run_YYYY-MM-DD.json` - Raw data and AI outputs for audit trail

## Requirements

- Python 3.8+
- OpenAI API key
- Internet connection for RSS feeds