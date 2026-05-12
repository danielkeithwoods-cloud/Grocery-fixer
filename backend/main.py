import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from services.kroger import (
    search_stores, get_deals, get_auth_url, exchange_code_for_token,
    store_user_token, get_user_session, clear_user_session, _get_app_token,
)
from services.recipe import generate_recipe_plan

app = FastAPI(title="Grocery Recipe Optimizer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StoreSearchRequest(BaseModel):
    zip_code: str
    radius_miles: int = Field(default=10, ge=1, le=50)


class DealsRequest(BaseModel):
    store_id: str
    limit: int = Field(default=50, ge=10, le=100)
    session_id: str | None = None


class RecipePlanRequest(BaseModel):
    store_id: str
    num_people: int = Field(default=4, ge=1, le=20)
    num_days: int = Field(default=7, ge=1, le=14)
    macro_profile: str = Field(default="balanced")
    meat_preference: str = Field(default="any")
    budget_per_person_per_day: float = Field(default=8.0, ge=1.0, le=50.0)
    meals_per_day: int = Field(default=3, ge=1, le=3)
    session_id: str | None = None


@app.get("/health")
async def health():
    return {"status": "ok"}


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
            data={"grant_type": "client_credentials"},
        )
    return {
        "status": "ok" if resp.status_code == 200 else "error",
        "http_status": resp.status_code,
        "kroger_response": resp.json() if "json" in resp.headers.get("content-type", "") else resp.text,
        "client_id_length": len(client_id),
        "secret_length": len(client_secret),
    }


# --- Kroger OAuth endpoints ---

@app.get("/api/kroger/login")
async def kroger_login(session_id: str = Query(...)):
    if not os.getenv("KROGER_CLIENT_ID"):
        raise HTTPException(status_code=503, detail="Kroger credentials not configured")
    return {"auth_url": get_auth_url(session_id)}


@app.get("/api/kroger/callback")
async def kroger_callback(code: str = Query(None), state: str = Query(None), error: str = Query(None)):
    if error:
        return RedirectResponse(url=f"http://localhost:5173?kroger_error={error}")
    if not code or not state:
        return RedirectResponse(url="http://localhost:5173?kroger_error=missing_params")
    try:
        token_data = await exchange_code_for_token(code)
        store_user_token(state, token_data)
        return RedirectResponse(url=f"http://localhost:5173?kroger_connected=true&session_id={state}")
    except Exception as e:
        return RedirectResponse(url=f"http://localhost:5173?kroger_error=token_exchange_failed")


@app.get("/api/kroger/status")
async def kroger_status(session_id: str = Query(...)):
    session = get_user_session(session_id)
    return {"connected": session is not None}


@app.post("/api/kroger/logout")
async def kroger_logout(session_id: str = Query(...)):
    clear_user_session(session_id)
    return {"status": "logged_out"}


# --- Main app endpoints ---

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
        on_sale_count = sum(1 for d in deals if d.get("on_sale"))
        coupon_count = sum(1 for d in deals if d.get("has_coupon"))
        return {
            "deals": deals,
            "total": len(deals),
            "on_sale_count": on_sale_count,
            "coupon_count": coupon_count,
            "demo_mode": not bool(os.getenv("KROGER_CLIENT_ID")),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-plan")
async def generate_plan(req: RecipePlanRequest):
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured.")

    deals = await get_deals(req.store_id, limit=50, session_id=req.session_id)

    try:
        plan = await generate_recipe_plan(
            deals=deals,
            num_people=req.num_people,
            num_days=req.num_days,
            macro_profile=req.macro_profile,
            meat_preference=req.meat_preference,
            budget_per_person_per_day=req.budget_per_person_per_day,
            meals_per_day=req.meals_per_day,
        )
        return plan
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recipe generation failed: {str(e)}")
