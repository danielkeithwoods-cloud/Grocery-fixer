import base64
import os
import time
from typing import Optional
import httpx

KROGER_BASE = "https://api.kroger.com/v1"
KROGER_TOKEN_URL = f"{KROGER_BASE}/connect/oauth2/token"

_token_cache: dict = {"token": None, "expires_at": 0}

DEMO_STORES = [
    {"id": "01400943", "name": "Kroger #943", "address": "123 Main St", "city": "Columbus", "state": "OH", "zip": "43215", "chain": "Kroger"},
    {"id": "01400271", "name": "Kroger #271", "address": "456 Broad St", "city": "Columbus", "state": "OH", "zip": "43220", "chain": "Kroger"},
    {"id": "70100001", "name": "Fred Meyer #001", "address": "789 Powell Blvd", "city": "Portland", "state": "OR", "zip": "97202", "chain": "Fred Meyer"},
]

DEMO_DEALS = [
    {"product_id": "0001111060903", "name": "Boneless Skinless Chicken Breasts", "brand": "Kroger", "category": "Meat & Seafood", "size": "per lb", "regular_price": 5.99, "sale_price": 2.99, "savings": 3.00, "on_sale": True, "image_url": None},
    {"product_id": "0001111060904", "name": "Ground Beef 80/20", "brand": "Kroger", "category": "Meat & Seafood", "size": "per lb", "regular_price": 6.49, "sale_price": 3.99, "savings": 2.50, "on_sale": True, "image_url": None},
    {"product_id": "0001111089076", "name": "Atlantic Salmon Fillet", "brand": "Kroger", "category": "Meat & Seafood", "size": "per lb", "regular_price": 9.99, "sale_price": 6.99, "savings": 3.00, "on_sale": True, "image_url": None},
    {"product_id": "0001111087312", "name": "Large Eggs", "brand": "Kroger", "category": "Dairy & Eggs", "size": "1 dozen", "regular_price": 4.99, "sale_price": 2.99, "savings": 2.00, "on_sale": True, "image_url": None},
    {"product_id": "0001111060532", "name": "Whole Milk", "brand": "Kroger", "category": "Dairy & Eggs", "size": "1 gallon", "regular_price": 4.49, "sale_price": 3.29, "savings": 1.20, "on_sale": True, "image_url": None},
    {"product_id": "0001111087654", "name": "Shredded Cheddar Cheese", "brand": "Kroger", "category": "Dairy & Eggs", "size": "8 oz", "regular_price": 3.49, "sale_price": 1.99, "savings": 1.50, "on_sale": True, "image_url": None},
    {"product_id": "0001111087100", "name": "Russet Potatoes", "brand": "Kroger", "category": "Produce", "size": "5 lb bag", "regular_price": 4.99, "sale_price": 2.49, "savings": 2.50, "on_sale": True, "image_url": None},
    {"product_id": "0001111087200", "name": "Broccoli Crowns", "brand": "", "category": "Produce", "size": "per lb", "regular_price": 1.99, "sale_price": 0.99, "savings": 1.00, "on_sale": True, "image_url": None},
    {"product_id": "0001111087300", "name": "Baby Spinach", "brand": "Kroger", "category": "Produce", "size": "5 oz", "regular_price": 3.99, "sale_price": 2.49, "savings": 1.50, "on_sale": True, "image_url": None},
    {"product_id": "0001111087400", "name": "Roma Tomatoes", "brand": "", "category": "Produce", "size": "per lb", "regular_price": 1.49, "sale_price": 0.79, "savings": 0.70, "on_sale": True, "image_url": None},
    {"product_id": "0001111087500", "name": "Yellow Onions", "brand": "", "category": "Produce", "size": "3 lb bag", "regular_price": 2.99, "sale_price": 1.49, "savings": 1.50, "on_sale": True, "image_url": None},
    {"product_id": "0001111087600", "name": "Garlic Bulbs", "brand": "", "category": "Produce", "size": "3 count", "regular_price": 1.49, "sale_price": 0.89, "savings": 0.60, "on_sale": True, "image_url": None},
    {"product_id": "0001111060100", "name": "Long Grain White Rice", "brand": "Kroger", "category": "Grains & Pasta", "size": "5 lb", "regular_price": 4.99, "sale_price": 2.99, "savings": 2.00, "on_sale": True, "image_url": None},
    {"product_id": "0001111060200", "name": "Penne Pasta", "brand": "Kroger", "category": "Grains & Pasta", "size": "16 oz", "regular_price": 1.99, "sale_price": 0.99, "savings": 1.00, "on_sale": True, "image_url": None},
    {"product_id": "0001111060300", "name": "Rolled Oats", "brand": "Kroger", "category": "Grains & Pasta", "size": "42 oz", "regular_price": 4.49, "sale_price": 2.99, "savings": 1.50, "on_sale": True, "image_url": None},
    {"product_id": "0001111060400", "name": "Black Beans (canned)", "brand": "Kroger", "category": "Canned Goods", "size": "15.5 oz", "regular_price": 1.29, "sale_price": 0.75, "savings": 0.54, "on_sale": True, "image_url": None},
    {"product_id": "0001111060500", "name": "Diced Tomatoes (canned)", "brand": "Kroger", "category": "Canned Goods", "size": "14.5 oz", "regular_price": 1.19, "sale_price": 0.69, "savings": 0.50, "on_sale": True, "image_url": None},
    {"product_id": "0001111060600", "name": "Chicken Broth", "brand": "Kroger", "category": "Canned Goods", "size": "32 oz", "regular_price": 2.99, "sale_price": 1.79, "savings": 1.20, "on_sale": True, "image_url": None},
    {"product_id": "0001111060700", "name": "Olive Oil", "brand": "Kroger", "category": "Oils & Condiments", "size": "16.9 fl oz", "regular_price": 6.99, "sale_price": 4.49, "savings": 2.50, "on_sale": True, "image_url": None},
    {"product_id": "0001111060800", "name": "Greek Yogurt Plain", "brand": "Kroger", "category": "Dairy & Eggs", "size": "32 oz", "regular_price": 5.49, "sale_price": 3.49, "savings": 2.00, "on_sale": True, "image_url": None},
]


async def _get_access_token(client_id: str, client_secret: str) -> str:
    now = time.time()
    if _token_cache["token"] and now < _token_cache["expires_at"] - 60:
        return _token_cache["token"]

    client_id = client_id.strip()
    client_secret = client_secret.strip()
    credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            KROGER_TOKEN_URL,
            headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/x-www-form-urlencoded"},
            data={"grant_type": "client_credentials", "scope": "product.compact"},
        )
        resp.raise_for_status()
        data = resp.json()
        _token_cache["token"] = data["access_token"]
        _token_cache["expires_at"] = now + data.get("expires_in", 1800)
        return _token_cache["token"]


def _has_kroger_credentials() -> bool:
    return bool(os.getenv("KROGER_CLIENT_ID") and os.getenv("KROGER_CLIENT_SECRET"))


async def search_stores(zip_code: str, radius_miles: int = 10) -> list[dict]:
    if not _has_kroger_credentials():
        return DEMO_STORES

    client_id = os.getenv("KROGER_CLIENT_ID")
    client_secret = os.getenv("KROGER_CLIENT_SECRET")
    try:
        token = await _get_access_token(client_id, client_secret)
    except Exception:
        return DEMO_STORES

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{KROGER_BASE}/locations",
            headers={"Authorization": f"Bearer {token}"},
            params={"filter.zipCode.near": zip_code, "filter.radiusInMiles": radius_miles, "filter.limit": 10},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

    stores = []
    for loc in data.get("data", []):
        addr = loc.get("address", {})
        stores.append({
            "id": loc.get("locationId"),
            "name": loc.get("name"),
            "address": addr.get("addressLine1", ""),
            "city": addr.get("city", ""),
            "state": addr.get("state", ""),
            "zip": addr.get("zipCode", ""),
            "chain": loc.get("chain", "Kroger"),
        })
    return stores


async def get_deals(store_id: str, limit: int = 50) -> list[dict]:
    if not _has_kroger_credentials():
        return DEMO_DEALS

    client_id = os.getenv("KROGER_CLIENT_ID")
    client_secret = os.getenv("KROGER_CLIENT_SECRET")
    try:
        token = await _get_access_token(client_id, client_secret)
    except Exception:
        return DEMO_DEALS

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{KROGER_BASE}/products",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "filter.locationId": store_id,
                "filter.limit": limit,
                "filter.start": 1,
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()

    deals = []
    for product in data.get("data", []):
        items = product.get("items", [{}])
        item = items[0] if items else {}
        price_info = item.get("price", {})
        promo = item.get("fulfillment", {})

        regular = price_info.get("regular", 0)
        promo_price = price_info.get("promo", None)
        on_sale = promo_price is not None and promo_price < regular

        images = product.get("images", [])
        image_url = None
        for img in images:
            if img.get("perspective") == "front":
                sizes = img.get("sizes", [])
                for sz in sizes:
                    if sz.get("size") == "medium":
                        image_url = sz.get("url")
                        break

        deals.append({
            "product_id": product.get("productId"),
            "name": product.get("description", "Unknown Product"),
            "brand": product.get("brand", ""),
            "category": product.get("categories", ["Unknown"])[0] if product.get("categories") else "Unknown",
            "size": item.get("size", ""),
            "regular_price": regular,
            "sale_price": promo_price if on_sale else regular,
            "savings": round(regular - promo_price, 2) if on_sale else 0,
            "on_sale": on_sale,
            "image_url": image_url,
        })

    return deals
