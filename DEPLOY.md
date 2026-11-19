# Deploying (Option B)

The result: one public HTTPS URL that serves both the app and its API, protected
by an access code, installable on your phone's home screen, and usable in a store.

The whole app ships as a **single Docker image** — the React app is built and then
served by FastAPI from the same origin. That means one service to deploy, one URL,
no CORS setup, and no separate frontend host.

---

## Before you start

You'll need:

- The repo pushed to GitHub (it already is)
- An Anthropic API key with credits — https://console.anthropic.com
- *(Optional)* Kroger API credentials for live prices — https://developer.kroger.com
- A Render account (free) — https://render.com

---

## Step 1 — Create the service

1. In Render: **New → Blueprint**
2. Connect the GitHub repo `danielkeithwoods-cloud/Grocery-fixer`
3. Select branch `claude/grocery-recipe-optimizer-XtmjR`
4. Render reads [`render.yaml`](./render.yaml) and prompts for the secrets it
   marks as `sync: false`:

   | Variable | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your key from console.anthropic.com |
   | `KROGER_CLIENT_ID` | your Kroger client id (leave blank for demo data) |
   | `KROGER_CLIENT_SECRET` | your Kroger secret (leave blank for demo data) |
   | `BACKEND_URL` | leave blank for now — you'll fill it in at Step 2 |

5. Click **Apply**. The first build takes ~3–5 minutes.

`APP_ACCESS_CODE` is generated automatically — you'll read it in Step 3.

## Step 2 — Point the app at its own URL

Once deployed, Render gives you a URL like `https://grocery-fixer.onrender.com`.

1. Open the service → **Environment**
2. Set `BACKEND_URL` to that exact URL (no trailing slash)
3. Save — Render redeploys automatically

This is only needed so the Kroger sign-in knows where to send you back. Skip it
if you aren't using Kroger sign-in.

## Step 3 — Get your access code

Service → **Environment** → copy the generated `APP_ACCESS_CODE`.

You'll enter it once on each device; it's then remembered in that browser.

To pick your own instead, just overwrite the value and save.

## Step 4 — Kroger redirect URI (only if using Kroger sign-in)

On your Kroger developer application, add this Redirect URI exactly:

```
https://YOUR-SERVICE.onrender.com/api/kroger/callback
```

## Step 5 — Install it on your phone

1. Open your Render URL in the phone browser
2. Enter the access code
3. **iOS (Safari):** Share → *Add to Home Screen*
   **Android (Chrome):** ⋮ → *Install app*

It gets its own icon and opens full-screen, with no browser chrome.

---

## Verify it worked

```
https://YOUR-SERVICE.onrender.com/health
```

```json
{
  "status": "ok",
  "model": "claude-sonnet-5-5",
  "anthropic_configured": true,
  "kroger_configured": true,
  "access_protected": true,
  "serving_frontend": true
}
```

All four booleans `true` means everything is wired up. `/health` is intentionally
unauthenticated so Render can health-check the service.

---

## What this costs

| | Free tier | Paid |
|---|---|---|
| Render | $0 | $7/mo (Starter) |
| Anthropic | pay per use — a few cents per meal plan | — |

**The free tier spins down after ~15 minutes of inactivity**, and the next request
then takes 30–60 seconds to wake the service. That is genuinely annoying when
you're standing in an aisle. If you use this regularly in a store, the $7/mo
Starter plan keeps it always-on and is the single biggest quality-of-life
difference. Everything else works identically on free.

### Model cost

The blueprint deploys with `ANTHROPIC_MODEL=claude-sonnet-5-5`, which is **half the
price of Opus 5.5** on both input and output:

| Model | Input / 1M | Output / 1M |
|---|---|---|
| `claude-sonnet-5-5` *(deployed default)* | $2.00 | $10.00 |
| `claude-opus-5-5` | $4.00 | $20.00 |

Sonnet handles meal planning well. If you find plans aren't as sharp as you'd like,
switch `ANTHROPIC_MODEL` to `claude-opus-5-5` in Render → Environment and save — it
redeploys automatically, no code change needed.

Prompt caching applies either way: the deals list is cached between the meal plan,
each meal swap, and regenerations for the same store, so repeat calls cost far less
than the first.

---

## Security notes

- The Anthropic key lives only on the server, never in the browser.
- `APP_ACCESS_CODE` gates every `/api` route except `/health` and the Kroger
  OAuth callback (which can't send a custom header).
- `AI_RATE_LIMIT_PER_HOUR` (default 30) caps billable calls per client per hour,
  so a leaked code can't run up a large bill. Set it to `0` to disable.
- Treat the access code like a password. To rotate it, change the env var in
  Render; every device will be asked for the new one.

## Known limitations

- **Kroger sign-in resets when the service restarts.** Tokens are kept in memory,
  so a redeploy or a free-tier spin-down means signing in to Kroger again. Your
  meal plans and shopping list are unaffected — those live in your browser.
- **The deal cache (10 min) is also in memory** and warms up again after a restart.
- Both would need a small datastore (Redis, Postgres) to survive restarts. Not
  worth it for single-household use.

---

## Running the image locally

Useful for checking a change before you push it.

```bash
docker build -t grocery-fixer .
docker run --rm -p 8000:8000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e APP_ACCESS_CODE=letmein \
  grocery-fixer
```

Then open http://localhost:8000 — one origin, no separate frontend server.

Leave `APP_ACCESS_CODE` unset and the gate is skipped entirely, which is how the
normal local dev setup (`uvicorn` + `npm run dev`) continues to behave.

## Other hosts

The same Dockerfile works anywhere that runs containers:

- **Railway** — New Project → Deploy from GitHub; it detects the Dockerfile. Set
  the same env vars.
- **Fly.io** — `fly launch` (it detects the Dockerfile), then `fly secrets set
  ANTHROPIC_API_KEY=... APP_ACCESS_CODE=...`
- **Google Cloud Run** — `gcloud run deploy --source .`

All of them inject `$PORT`, which the image already honors.
