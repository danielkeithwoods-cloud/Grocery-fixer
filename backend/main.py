import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.kroger import search_stores, get_deals
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


class RecipePlanRequest(BaseModel):
    store_id: str
    num_people: int = Field(default=4, ge=1, le=20)
    num_days: int = Field(default=7, ge=1, le=14)
    macro_profile: str = Field(default="balanced")
    meat_preference: str = Field(default="any")
    budget_per_person_per_day: float = Field(default=8.0, ge=1.0, le=50.0)
    meals_per_day: int = Field(default=3, ge=1, le=3)


@app.get("/health")
async def health():
    return {"status": "ok"}


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
        deals = await get_deals(req.store_id, req.limit)
        on_sale_count = sum(1 for d in deals if d.get("on_sale"))
        return {
            "deals": deals,
            "total": len(deals),
            "on_sale_count": on_sale_count,
            "demo_mode": not bool(os.getenv("KROGER_CLIENT_ID")),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-plan")
async def generate_plan(req: RecipePlanRequest):
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY not configured. Add it to backend/.env to enable recipe generation.",
        )

    deals = await get_deals(req.store_id, limit=50)

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
