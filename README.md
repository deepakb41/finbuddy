# FinBuddy — AI-Powered Personal Finance Tracker

FinBuddy is a mobile-first personal finance app for Indian users. It uses Groq LLM to automatically parse and categorize bank SMS messages and UPI notifications, giving you a clear picture of your spending without manual data entry.

**Live:** [finbuddy-nine.vercel.app](https://finbuddy-nine.vercel.app)

---

## Features

### Core
- **Passwordless auth** — OTP via email, 90-day JWT session
- **Transaction tracking** — add expenses and income manually with category, merchant, notes
- **Voice logging** — speak a transaction ("paid 340 on Swiggy") and it's parsed by AI into a structured entry
- **Recurring transactions** — set any expense to repeat for 3, 6, 12, or N custom months
- **Multi-currency** — INR, USD, GBP, EUR with per-user currency preference

### Dashboard
- Monthly summary: total spend, income, savings rate, daily average vs last month
- Category donut chart with month/year/all-time selector
- Top merchants by spend
- Budget tracking with progress bars per category
- 12-month spending trend chart (filterable by category)
- Financial health score (0–100) with AI-generated tips per sub-score
- 6-month spending forecast with trend analysis

### AI Insights
- Smart insight cards: Biggest Opportunity, Anomaly Alert, Goal Progress
- Each card has an inline "Ask me more" chat powered by Groq
- AI-generated monthly narrative summary (cached per month)
- Savings rate target — set your goal and track progress

### Bank Import (Beta)
- **Bank tab** — review AI-categorized transaction suggestions by month
- Suggestions parsed by Groq LLM: extracts merchant, amount, category, date from raw text
- Setu Account Aggregator integration placeholder (coming soon — one-time consent, auto-fetch)
- Accept or skip each suggestion; accepted entries go straight to History

### Settings
- Currency selector
- Savings rate target slider (5–50%)
- Budget management per category
- Dark / light mode toggle

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 3, TanStack Query v5, Recharts |
| Backend | FastAPI, SQLite, SQLAlchemy 2, Python 3.11 |
| AI / LLM | Groq API (`llama-3.3-70b-versatile`) — transaction parsing, insights, health tips, forecasting |
| Auth | OTP via email (SMTP), JWT (python-jose) |
| Deployment | Vercel (frontend) + Render.com Docker (backend) |

---

## Project Structure

```
finbuddy/
├── api/                    # FastAPI application
│   ├── main.py             # App entrypoint, CORS, router registration
│   ├── deps.py             # JWT auth dependencies
│   └── routers/
│       ├── auth.py         # OTP request + verify, JWT issue
│       ├── transactions.py # CRUD for transactions
│       ├── insights.py     # Summary, categories, forecast, health score, AI summary
│       ├── suggestions.py  # Bank SMS parsing, suggestion queue, ingest-bank
│       ├── voice.py        # Voice parse + Whisper transcription
│       └── budgets.py      # Budget CRUD
├── src/
│   ├── data/
│   │   ├── db.py           # SQLAlchemy engine + session
│   │   └── models.py       # Transaction, User, Budget, TransactionSuggestion, OTPRequest
│   ├── llm/
│   │   └── client.py       # Groq chat wrapper
│   └── config.py           # Settings from env vars
├── frontend/
│   ├── src/
│   │   ├── pages/          # Home, AddTransaction, History, Bank, Insights, Settings
│   │   ├── components/     # Dashboard cards, charts, layout, UI primitives
│   │   ├── hooks/          # useAuth, useVoiceInput
│   │   └── api/client.ts   # Typed API client
│   └── vercel.json         # SPA rewrite rule
├── Dockerfile              # python:3.11-slim, uvicorn
├── render.yaml             # Render.com deploy config (Docker, free tier, 1GB disk)
└── requirements.txt
```

---

## AI Parsing Flow

All bank data — whether pasted SMS or structured Setu bank data — flows through the same Groq pipeline:

```
Raw text / Setu narration
        ↓
  _parse_raw(text)          ← Groq llama-3.3-70b-versatile
        ↓
{ merchant, amount, currency, date, tx_type, category }
        ↓
  TransactionSuggestion (status=pending)
        ↓
  User reviews in Bank tab → Accept → Transaction
```

Categories recognized: Food & Dining, Groceries, Transport, Shopping, Entertainment, Travel, Rent, Utilities & Bills, Telecom, Healthcare, Fitness, Finance & EMI, Investments, Personal Care, Education, Other.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/request-otp` | Send OTP to email |
| POST | `/api/auth/verify-otp` | Verify OTP, get JWT |
| GET | `/api/transactions` | List transactions (filter by month/category/search) |
| POST | `/api/transactions` | Create transaction |
| PATCH | `/api/transactions/:id` | Update category/notes |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/api/insights/summary` | Monthly summary + projection |
| GET | `/api/insights/categories` | Category breakdown |
| GET | `/api/insights/monthly-trend` | N-month trend by category |
| GET | `/api/insights/forecast` | 6-month AI forecast |
| GET | `/api/insights/health-score` | Financial health score with AI tips |
| GET | `/api/insights/ai-summary` | AI narrative summary (cached) |
| POST | `/api/insights/ask` | Ask AI a finance question |
| GET | `/api/suggestions/pending` | Pending suggestion cards (filter `?month=YYYY-MM`) |
| POST | `/api/suggestions/ingest` | Parse raw SMS text → suggestion |
| POST | `/api/suggestions/ingest-bank` | Parse Setu structured data → suggestion |
| PATCH | `/api/suggestions/:id/accept` | Accept suggestion → create transaction |
| PATCH | `/api/suggestions/:id/reject` | Dismiss suggestion |
| POST | `/api/voice/parse` | Parse text to transaction fields |
| POST | `/api/voice/transcribe` | Transcribe audio → parse |
| GET/POST/DELETE | `/api/budgets` | Budget management |

---

## Local Development

### Backend
```bash
cp .env.example .env          # fill in GROQ_API_KEY, JWT_SECRET
pip install -r requirements.txt
uvicorn api.main:app --reload
# API at http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
# create frontend/.env.local with: VITE_API_URL=http://localhost:8000/api
npm run dev
# App at http://localhost:5173
```

---

## Deployment

| Service | Platform | Config |
|---------|----------|--------|
| Frontend | Vercel | Root dir: `frontend`, env: `VITE_API_URL` |
| Backend | Render.com | Docker runtime, 1GB persistent disk at `/data` |

Required env vars on Render: `GROQ_API_KEY`, `JWT_SECRET`, `DATABASE_URL=sqlite:////data/finance.db`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

Push to `main` → both services auto-deploy.

---

## Roadmap

- [ ] Setu Account Aggregator integration (auto-fetch bank transactions)
- [ ] WhatsApp / Telegram bot for quick voice/text logging
- [ ] PDF bank statement import
- [ ] Multi-user support with shared budgets
- [ ] Export to CSV / Google Sheets
