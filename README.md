# Grocery Recipe Optimizer

Scan live grocery store deals and let Claude AI build an optimized weekly meal plan and shopping list.

## Features

- **Store & deal scanning** — searches nearby Kroger-family stores (Kroger, Fred Meyer, Ralphs, etc.) and fetches current sale prices via the Kroger API
- **Smart recipe generation** — Claude AI builds day-by-day meal plans that maximize use of sale items to keep costs low
- **User preferences** — set number of people, days, meals per day, macro profile (balanced, high-protein, low-carb, keto), and meat preference (chicken, beef, pork, fish, vegetarian, vegan)
- **Budget control** — specify a budget per person per day; Claude targets recipes within it
- **Interactive grocery list** — consolidated shopping list grouped by category, with check-off and download-to-text support
- **Demo mode** — runs with realistic sample data if no API keys are configured

## Setup

### 1. API Keys

Copy the example env file and fill in your keys:

```bash
cp backend/.env.example backend/.env
```

| Variable | Required | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (for recipe generation) | console.anthropic.com |
| `KROGER_CLIENT_ID` | No (demo data used without it) | developer.kroger.com |
| `KROGER_CLIENT_SECRET` | No (demo data used without it) | developer.kroger.com |

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs on http://localhost:8000.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173 and proxies `/api` requests to the backend.

## How It Works

1. **Enter a zip code** to find nearby Kroger stores
2. **Select a store** — the app immediately scans current deals and sale prices
3. **Configure preferences** — people count, days, meal count, macros, meat type, budget
4. **Generate Plan** — Claude analyzes the deals and builds recipes optimized for cost and your macros
5. **Review & shop** — browse the day-by-day recipe plan, check off grocery items, or download the list

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide icons
- **Backend**: Python FastAPI, Uvicorn
- **AI**: Anthropic Claude API (`claude-sonnet-4-6`) for recipe and meal plan generation
- **Grocery Data**: Kroger Developer API (OAuth 2.0 client credentials) with demo data fallback

## Project Structure

```
Grocery-fixer/
├── backend/
│   ├── main.py                 # FastAPI routes
│   ├── requirements.txt
│   ├── .env.example
│   └── services/
│       ├── kroger.py           # Kroger API integration + demo data
│       └── recipe.py           # Claude API recipe generation
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx             # Main app with step flow
        ├── services/api.js     # Backend API client
        └── components/
            ├── StoreSelector.jsx
            ├── PreferencesForm.jsx
            ├── DealsPanel.jsx
            ├── RecipePlan.jsx
            └── GroceryList.jsx
```
