import os
from dotenv import load_dotenv

load_dotenv()

import anthropic
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from services.kroger import (
    search_stores, get_deals, get_snack_deals, get_auth_url, exchange_code_for_token,
    store_user_token, get_user_session, clear_user_session,
)
from services.recipe import generate_recipe_plan, generate_snack_cart, swap_meal

app = FastAPI(title="Grocery Recipe Optimizer", version="2.1.0")


def frontend_url() -> str:
    """Where the browser app is served from. Set FRONTEND_URL when deploying."""
    return (os.getenv("FRONTEND_URL") or "http://localhost:5173").strip().rstrip("/")


def _allowed_origins() -> list[str]:
    # FRONTEND_URL may be a comma-separated list (e.g. a LAN IP plus a hosted URL).
    configured = [o.strip().rstrip("/") for o in (os.getenv("FRONTEND_URL") or "").split(",") if o.strip()]
    defaults = ["http://localhost:5173", "http://localhost:3000"]
    return list(dict.fromkeys(configured + defaults))


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX") or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _friendly_error(e: Exception) -> str:
    """Turn SDK and parsing failures into something a user can act on."""
    if isinstance(e, anthropic.AuthenticationError):
        return ("The ANTHROPIC_API_KEY in backend/.env is invalid or expired. "
                "Check it at console.anthropic.com, then restart the backend.")
    if isinstance(e, anthropic.PermissionDeniedError):
        return "This API key doesn't have access to the configured model."
    if isinstance(e, anthropic.NotFoundError):
        return (f"Model '{os.getenv('ANTHROPIC_MODEL') or 'claude-opus-5-5'}' was not found. "
                "Check ANTHROPIC_MODEL in backend/.env.")
    if isinstance(e, anthropic.RateLimitError):
        return "Rate limited by the Anthropic API. Wait a few seconds and try again."
    if isinstance(e, anthropic.BadRequestError):
        msg = str(e)
        if "credit balance" in msg.lower() or "billing" in msg.lower():
            return ("Your Anthropic account is out of credits. Add credits at "
                    "console.anthropic.com → Plans & Billing, then try again.")
        return f"The API rejected the request: {getattr(e, 'message', msg)}"
    if isinstance(e, anthropic.APIConnectionError):
        return "Couldn't reach the Anthropic API. Check your internet connection."
    if isinstance(e, anthropic.APIStatusError):
        if e.status_code >= 500:
            return "The Anthropic API is temporarily unavailable. Try again in a moment."
        return f"API error: {getattr(e, 'message', str(e))}"
    if isinstance(e, ValueError):  # includes json.JSONDecodeError
        return "The AI returned a malformed response. Try generating again."
    return str(e)


class StoreSearchRequest(BaseModel):
    zip_code: str
    radius_miles: int = Field(default=10, ge=1, le=50)


class DealsRequest(BaseModel):
    store_id: str
    limit: int = Field(default=120, ge=10, le=250)
    session_id: str | None = None


class HouseholdMember(BaseModel):
    name: str = Field(default="Person", max_length=40)
    calories_per_day: int = Field(default=2000, ge=800, le=6000)
    notes: str = Field(default="", max_length=200)


class DietaryPrefs(BaseModel):
    restrictions: list[str] = Field(default_factory=list)
    dislikes: list[str] = Field(default_factory=list)
    pantry_items: list[str] = Field(default_factory=list)
    household: list[HouseholdMember] = Field(default_factory=list, max_length=20)

    def household_dicts(self) -> list[dict]:
        return [m.model_dump() for m in self.household]

    def people_count(self, fallback: int) -> int:
        """The household list is authoritative when present."""
        return len(self.household) or fallback


class RecipePlanRequest(DietaryPrefs):
    store_id: str
    num_people: int = Field(default=4, ge=1, le=20)
    num_days: int = Field(default=7, ge=1, le=14)
    macro_profile: str = Field(default="balanced")
    meat_preference: str = Field(default="any")
    budget_per_person_per_day: float = Field(default=8.0, ge=1.0, le=50.0)
    meals_per_day: int = Field(default=3, ge=1, le=3)
    session_id: str | None = None


class SwapMealRequest(DietaryPrefs):
    store_id: str
    meal_type: str = Field(default="dinner")
    day: int = Field(default=1, ge=1, le=14)
    num_people: int = Field(default=4, ge=1, le=20)
    macro_profile: str = Field(default="balanced")
    meat_preference: str = Field(default="any")
    budget_per_meal: float = Field(default=12.0, ge=1.0, le=200.0)
    meals_per_day: int = Field(default=3, ge=1, le=3)
    previous_meal_name: str = ""
    avoid_names: list[str] = Field(default_factory=list)
    session_id: str | None = None


class CustomMacroTargets(BaseModel):
    protein_g: float | None = None
    max_carbs_g: float | None = None
    max_calories: float | None = None
    max_fat_g: float | None = None
    max_sugar_g: float | None = None


class SnackCartRequest(BaseModel):
    store_id: str
    macro_focus: str = Field(default="high_protein")
    budget: float = Field(default=20.0, ge=2.0, le=200.0)
    snacks_per_day: int = Field(default=2, ge=1, le=6)
    num_days: int = Field(default=7, ge=1, le=30)
    custom_targets: CustomMacroTargets | None = None
    restrictions: list[str] = Field(default_factory=list)
    dislikes: list[str] = Field(default_factory=list)
    session_id: str | None = None


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": os.getenv("ANTHROPIC_MODEL") or "claude-opus-5-5",
        "anthropic_configured": bool(os.getenv("ANTHROPIC_API_KEY")),
        "kroger_configured": bool(os.getenv("KROGER_CLIENT_ID")),
    }


@app.get("/api/test-kroger")
async def test_kroger():
    import base64, httpx
    client_id = os.getenv("KROGER_CLIENT_ID", "").strip()
    client_secret = os.getenv("KROGER_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        return {"status": "no_credentials"}
    credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.kroger.com/v1/connect/oauth2/token",
            headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/x-www-form-urlencoded"},
            data={"grant_type": "client_credentials", "scope": "product.compact"},
        )
    return {
        "status": "ok" if resp.status_code == 200 else "error",
        "http_status": resp.status_code,
        "kroger_response": resp.json() if "json" in resp.headers.get("content-type", "") else resp.text,
    }


# --- Kroger OAuth ---

@app.get("/api/kroger/login")
async def kroger_login(session_id: str = Query(...)):
    if not os.getenv("KROGER_CLIENT_ID"):
        raise HTTPException(status_code=503, detail="Kroger credentials not configured")
    return {"auth_url": get_auth_url(session_id)}


@app.get("/api/kroger/callback")
async def kroger_callback(code: str = Query(None), state: str = Query(None), error: str = Query(None)):
    app_url = frontend_url().split(",")[0]
    if error:
        return RedirectResponse(url=f"{app_url}?kroger_error={error}")
    if not code or not state:
        return RedirectResponse(url=f"{app_url}?kroger_error=missing_params")
    try:
        token_data = await exchange_code_for_token(code)
        store_user_token(state, token_data)
        return RedirectResponse(url=f"{app_url}?kroger_connected=true&session_id={state}")
    except Exception:
        return RedirectResponse(url=f"{app_url}?kroger_error=token_exchange_failed")


@app.get("/api/kroger/status")
async def kroger_status(session_id: str = Query(...)):
    return {"connected": get_user_session(session_id) is not None}


@app.post("/api/kroger/logout")
async def kroger_logout(session_id: str = Query(...)):
    clear_user_session(session_id)
    return {"status": "logged_out"}


# --- Main endpoints ---

@app.post("/api/stores")
async def find_stores(req: StoreSearchRequest):
    try:
        stores = await search_stores(req.zip_code, req.radius_miles)
        return {"stores": stores, "demo_mode": not bool(os.getenv("KROGER_CLIENT_ID"))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/deals")
async def fetch_deals(req: DealsRequest):
    try:
        deals = await get_deals(req.store_id, req.limit, session_id=req.session_id)
        return {
            "deals": deals,
            "total": len(deals),
            "on_sale_count": sum(1 for d in deals if d.get("on_sale")),
            "coupon_count": sum(1 for d in deals if d.get("has_coupon")),
            "demo_mode": not bool(os.getenv("KROGER_CLIENT_ID")),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-plan")
async def generate_plan(req: RecipePlanRequest):
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not set in backend/.env.")

    deals = await get_deals(req.store_id, limit=120, session_id=req.session_id)
    try:
        return await generate_recipe_plan(
            deals=deals,
            num_people=req.people_count(req.num_people),
            num_days=req.num_days,
            macro_profile=req.macro_profile,
            meat_preference=req.meat_preference,
            budget_per_person_per_day=req.budget_per_person_per_day,
            meals_per_day=req.meals_per_day,
            restrictions=req.restrictions,
            dislikes=req.dislikes,
            pantry_items=req.pantry_items,
            household=req.household_dicts(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=_friendly_error(e))


@app.post("/api/swap-meal")
async def swap_one_meal(req: SwapMealRequest):
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not set in backend/.env.")

    deals = await get_deals(req.store_id, limit=120, session_id=req.session_id)
    try:
        return await swap_meal(
            deals=deals,
            meal_type=req.meal_type,
            day=req.day,
            num_people=req.people_count(req.num_people),
            macro_profile=req.macro_profile,
            meat_preference=req.meat_preference,
            budget_per_meal=req.budget_per_meal,
            previous_meal_name=req.previous_meal_name,
            avoid_names=req.avoid_names,
            restrictions=req.restrictions,
            dislikes=req.dislikes,
            pantry_items=req.pantry_items,
            household=req.household_dicts(),
            meals_per_day=req.meals_per_day,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=_friendly_error(e))


@app.post("/api/snack-cart")
async def build_snack_cart(req: SnackCartRequest):
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not set in backend/.env.")

    deals = await get_snack_deals(req.store_id, session_id=req.session_id)
    custom = None
    if req.macro_focus == "custom" and req.custom_targets:
        custom = req.custom_targets.model_dump(exclude_none=True)

    try:
        return await generate_snack_cart(
            deals=deals,
            macro_focus=req.macro_focus,
            budget=req.budget,
            snacks_per_day=req.snacks_per_day,
            num_days=req.num_days,
            custom_targets=custom,
            restrictions=req.restrictions,
            dislikes=req.dislikes,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=_friendly_error(e))
