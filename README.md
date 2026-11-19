# Grocery Recipe Optimizer

Scan live grocery store deals and let Claude AI build an optimized weekly meal plan and shopping list.

## Features

- **Store-wide deal scanning** — searches nearby Kroger-family stores (Kroger, Fred Meyer, Ralphs, etc.) and scans ~80 categories across the whole store (meat, produce, dairy, grains, snacks, frozen, beverages, pantry) via the Kroger API, fetched concurrently and cached
- **Browsable deals view** — filter by category, search by name/brand, sort by savings or price, and toggle "sale only"
- **Smart recipe generation** — Claude AI builds day-by-day meal plans that maximize use of sale items to keep costs low
- **Macro-targeted snack carts** — pick a preset focus (high-protein, low-carb, low-sugar, low-calorie, high-energy, balanced) *or* set custom per-serving targets, and Claude assembles a cost-optimized snack cart from current deals
- **Digital coupons** — connect your Kroger account (OAuth) to fold your clipped digital coupons into deal pricing
- **User preferences** — set number of people, days, meals per day, macro profile, and meat preference (chicken, beef, pork, fish, vegetarian, vegan)
- **Budget control** — specify a budget per person per day for meals, or a total budget for snack carts
- **Household & calorie targets** — name each person and set their own daily calorie target; everyone eats the same dishes and the plan sizes each person's portion to hit their number, then reports delivered vs. target per day
- **Allergies, dislikes & pantry** — mark allergens to avoid entirely, ingredients you dislike, and staples you already own (kept off the shopping list and out of the cost total)
- **Installable on your phone** — add it to your home screen and it opens full-screen like a native app, with the shell cached so it still opens in a store with no signal
- **Swap a single meal** — don't like one dinner? Regenerate just that meal instead of the whole plan
- **Shopping mode** — an in-store view with large tap targets, a running "in cart" vs "still to get" total, and checked items sorted to the bottom of each aisle
- **Nothing is lost on refresh** — plans, snack carts, preferences, check-offs, and recent stores persist locally
- **Interactive lists** — grouped grocery list and snack cart with check-off, copy, download, and print
- **Demo mode** — runs with realistic sample data (including snacks) if no API keys are configured

### Notes on accuracy

Meal plans, macros, and prices are AI-generated estimates. Always check product labels yourself,
especially for allergies. Kroger's product API does not return nutrition data, so per-serving
macros are estimated by the model rather than read from a label.

## Setup

### 1. API Keys

Copy the example env file and fill in your keys:

```bash
cp backend/.env.example backend/.env
```

| Variable | Required | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (for recipe generation) | console.anthropic.com |
| `ANTHROPIC_MODEL` | No — defaults to `claude-opus-5-5` | Set to `claude-sonnet-5-5` for roughly half the cost per plan |
| `KROGER_CLIENT_ID` | No (demo data used without it) | developer.kroger.com |
| `KROGER_CLIENT_SECRET` | No (demo data used without it) | developer.kroger.com |

To enable digital-coupon pricing, also add `http://localhost:8000/api/kroger/callback`
as a Redirect URI on your Kroger developer application.

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

## Installing it on your phone

The app is a PWA, so no app store is involved — you open it in the phone's browser and
add it to the home screen. It then gets its own icon and opens full-screen.

The only real work is making the app reachable from your phone, since by default both
halves run on `localhost` on your PC.

### Option A — same Wi-Fi (free, ~10 minutes)

Good for planning at home. Will **not** work in the store.

1. Find your PC's LAN IP (`ipconfig` on Windows — something like `192.168.1.50`).
2. Bind both servers to all interfaces:
   ```bash
   # backend
   uvicorn main:app --host 0.0.0.0 --port 8000
   # frontend
   npm run dev -- --host
   ```
3. In `backend/.env`, point the app at that IP so CORS and the Kroger redirect match:
   ```
   FRONTEND_URL=http://192.168.1.50:5173
   BACKEND_URL=http://192.168.1.50:8000
   ```
   If you use Kroger sign-in, also add `http://192.168.1.50:8000/api/kroger/callback`
   as a Redirect URI on your Kroger developer app.
4. Allow Node and Python through the Windows firewall when prompted.
5. On your phone, open `http://192.168.1.50:5173`, then **Share → Add to Home Screen**
   (iOS, Safari) or **⋮ → Install app / Add to Home screen** (Android, Chrome).

### Option B — deploy it (free tier, ~15 minutes) — **recommended**

Needed if you want it **in the store**, which is where shopping mode earns its keep.

**→ Full walkthrough: [DEPLOY.md](./DEPLOY.md)**

In short: the repo ships a [`Dockerfile`](./Dockerfile) that builds the React app and
serves it from FastAPI on one origin, plus a [`render.yaml`](./render.yaml) blueprint.
Point Render at the repo, paste in your API keys, and you get a single HTTPS URL
protected by a generated access code. HTTPS also means iOS installs it cleanly as a
PWA, which the LAN option doesn't guarantee.

> **Note on Option A and iOS:** iOS is stricter about installing PWAs over plain
> `http://`. If Add to Home Screen behaves oddly on a LAN IP, use Option B.

### Option C — a real native app

Wrapping this in [Capacitor](https://capacitorjs.com/) produces an actual iOS/Android
binary. It mostly works out of the box since the app is already a web app, but
shipping to an iPhone needs a Mac with Xcode and a $99/year Apple Developer account
to keep it installed beyond 7 days. Not worth it unless you need camera, barcode
scanning, or push notifications — the PWA covers everything this app currently does.

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
