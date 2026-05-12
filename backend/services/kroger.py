import base64
import os
import time
import httpx

KROGER_BASE = "https://api.kroger.com/v1"
KROGER_TOKEN_URL = f"{KROGER_BASE}/connect/oauth2/token"
KROGER_AUTH_URL = f"{KROGER_BASE}/connect/oauth2/authorize"
REDIRECT_URI = "http://localhost:8000/api/kroger/callback"

# App-level client credentials token cache
_app_token_cache: dict = {"token": None, "expires_at": 0}

# Per-session user tokens: {session_id: {"token": ..., "expires_at": ..., "profile": ...}}
_user_tokens: dict = {}

DEMO_STORES = [
    {"id": "01400943", "name": "Kroger #943", "address": "123 Main St", "city": "Columbus", "state": "OH", "zip": "43215", "chain": "Kroger"},
    {"id": "01400271", "name": "Kroger #271", "address": "456 Broad St", "city": "Columbus", "state": "OH", "zip": "43220", "chain": "Kroger"},
    {"id": "70100001", "name": "Fred Meyer #001", "address": "789 Powell Blvd", "city": "Portland", "state": "OR", "zip": "97202", "chain": "Fred Meyer"},
]

DEMO_DEALS = [
    {"product_id": "0001111060903", "name": "Boneless Skinless Chicken Breasts", "brand": "Kroger", "category": "Meat & Seafood", "size": "per lb", "regular_price": 5.99, "sale_price": 2.99, "coupon_price": None, "savings": 3.00, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111060904", "name": "Ground Beef 80/20", "brand": "Kroger", "category": "Meat & Seafood", "size": "per lb", "regular_price": 6.49, "sale_price": 3.99, "coupon_price": None, "savings": 2.50, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111089076", "name": "Atlantic Salmon Fillet", "brand": "Kroger", "category": "Meat & Seafood", "size": "per lb", "regular_price": 9.99, "sale_price": 6.99, "coupon_price": None, "savings": 3.00, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111087312", "name": "Large Eggs", "brand": "Kroger", "category": "Dairy & Eggs", "size": "1 dozen", "regular_price": 4.99, "sale_price": 2.99, "coupon_price": None, "savings": 2.00, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111060532", "name": "Whole Milk", "brand": "Kroger", "category": "Dairy & Eggs", "size": "1 gallon", "regular_price": 4.49, "sale_price": 3.29, "coupon_price": None, "savings": 1.20, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111087654", "name": "Shredded Cheddar Cheese", "brand": "Kroger", "category": "Dairy & Eggs", "size": "8 oz", "regular_price": 3.49, "sale_price": 1.99, "coupon_price": None, "savings": 1.50, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111087100", "name": "Russet Potatoes", "brand": "Kroger", "category": "Produce", "size": "5 lb bag", "regular_price": 4.99, "sale_price": 2.49, "coupon_price": None, "savings": 2.50, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111087200", "name": "Broccoli Crowns", "brand": "", "category": "Produce", "size": "per lb", "regular_price": 1.99, "sale_price": 0.99, "coupon_price": None, "savings": 1.00, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111087300", "name": "Baby Spinach", "brand": "Kroger", "category": "Produce", "size": "5 oz", "regular_price": 3.99, "sale_price": 2.49, "coupon_price": None, "savings": 1.50, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111087400", "name": "Roma Tomatoes", "brand": "", "category": "Produce", "size": "per lb", "regular_price": 1.49, "sale_price": 0.79, "coupon_price": None, "savings": 0.70, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111087500", "name": "Yellow Onions", "brand": "", "category": "Produce", "size": "3 lb bag", "regular_price": 2.99, "sale_price": 1.49, "coupon_price": None, "savings": 1.50, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111087600", "name": "Garlic Bulbs", "brand": "", "category": "Produce", "size": "3 count", "regular_price": 1.49, "sale_price": 0.89, "coupon_price": None, "savings": 0.60, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111060100", "name": "Long Grain White Rice", "brand": "Kroger", "category": "Grains & Pasta", "size": "5 lb", "regular_price": 4.99, "sale_price": 2.99, "coupon_price": None, "savings": 2.00, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111060200", "name": "Penne Pasta", "brand": "Kroger", "category": "Grains & Pasta", "size": "16 oz", "regular_price": 1.99, "sale_price": 0.99, "coupon_price": None, "savings": 1.00, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111060300", "name": "Rolled Oats", "brand": "Kroger", "category": "Grains & Pasta", "size": "42 oz", "regular_price": 4.49, "sale_price": 2.99, "coupon_price": None, "savings": 1.50, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111060400", "name": "Black Beans (canned)", "brand": "Kroger", "category": "Canned Goods", "size": "15.5 oz", "regular_price": 1.29, "sale_price": 0.75, "coupon_price": None, "savings": 0.54, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111060500", "name": "Diced Tomatoes (canned)", "brand": "Kroger", "category": "Canned Goods", "size": "14.5 oz", "regular_price": 1.19, "sale_price": 0.69, "coupon_price": None, "savings": 0.50, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111060600", "name": "Chicken Broth", "brand": "Kroger", "category": "Canned Goods", "size": "32 oz", "regular_price": 2.99, "sale_price": 1.79, "coupon_price": None, "savings": 1.20, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111060700", "name": "Olive Oil", "brand": "Kroger", "category": "Oils & Condiments", "size": "16.9 fl oz", "regular_price": 6.99, "sale_price": 4.49, "coupon_price": None, "savings": 2.50, "on_sale": True, "has_coupon": False, "image_url": None},
    {"product_id": "0001111060800", "name": "Greek Yogurt Plain", "brand": "Kroger", "category": "Dairy & Eggs", "size": "32 oz", "regular_price": 5.49, "sale_price": 3.49, "coupon_price": None, "savings": 2.00, "on_sale": True, "has_coupon": False, "image_url": None},
]

SEARCH_TERMS = ["chicken", "beef", "pork", "salmon", "eggs", "milk", "cheese",
                "broccoli", "potato", "spinach", "tomato", "onion",
                "rice", "pasta", "bread", "oats", "beans", "yogurt", "olive oil"]


def _has_kroger_credentials() -> bool:
    return bool(os.getenv("KROGER_CLIENT_ID") and os.getenv("KROGER_CLIENT_SECRET"))


def _get_basic_auth() -> str:
    client_id = os.getenv("KROGER_CLIENT_ID", "").strip()
    client_secret = os.getenv("KROGER_CLIENT_SECRET", "").strip()
    return base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()


async def _get_app_token() -> str:
    now = time.time()
    if _app_token_cache["token"] and now < _app_token_cache["expires_at"] - 60:
        return _app_token_cache["token"]

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            KROGER_TOKEN_URL,
            headers={"Authorization": f"Basic {_get_basic_auth()}", "Content-Type": "application/x-www-form-urlencoded"},
            data={"grant_type": "client_credentials", "scope": "product.compact"},
        )
        resp.raise_for_status()
        data = resp.json()
        _app_token_cache["token"] = data["access_token"]
        _app_token_cache["expires_at"] = now + data.get("expires_in", 1800)
        return _app_token_cache["token"]


def get_auth_url(session_id: str) -> str:
    from urllib.parse import urlencode
    params = urlencode({
        "client_id": os.getenv("KROGER_CLIENT_ID", "").strip(),
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "product.compact profile.compact",
        "state": session_id,
    })
    return f"{KROGER_AUTH_URL}?{params}"


async def exchange_code_for_token(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            KROGER_TOKEN_URL,
            headers={"Authorization": f"Basic {_get_basic_auth()}", "Content-Type": "application/x-www-form-urlencoded"},
            data={"grant_type": "authorization_code", "code": code, "redirect_uri": REDIRECT_URI},
        )
        resp.raise_for_status()
        return resp.json()


async def _refresh_user_token(session_id: str) -> str | None:
    entry = _user_tokens.get(session_id)
    if not entry:
        return None
    now = time.time()
    if now < entry["expires_at"] - 60:
        return entry["token"]
    refresh_token = entry.get("refresh_token")
    if not refresh_token:
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                KROGER_TOKEN_URL,
                headers={"Authorization": f"Basic {_get_basic_auth()}", "Content-Type": "application/x-www-form-urlencoded"},
                data={"grant_type": "refresh_token", "refresh_token": refresh_token},
            )
            resp.raise_for_status()
            data = resp.json()
            _user_tokens[session_id].update({
                "token": data["access_token"],
                "refresh_token": data.get("refresh_token", refresh_token),
                "expires_at": now + data.get("expires_in", 1800),
            })
            return data["access_token"]
    except Exception:
        del _user_tokens[session_id]
        return None


def store_user_token(session_id: str, token_data: dict) -> None:
    _user_tokens[session_id] = {
        "token": token_data["access_token"],
        "refresh_token": token_data.get("refresh_token"),
        "expires_at": time.time() + token_data.get("expires_in", 1800),
    }


def get_user_session(session_id: str) -> dict | None:
    return _user_tokens.get(session_id)


def clear_user_session(session_id: str) -> None:
    _user_tokens.pop(session_id, None)


async def search_stores(zip_code: str, radius_miles: int = 10) -> list[dict]:
    if not _has_kroger_credentials():
        return DEMO_STORES
    try:
        token = await _get_app_token()
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


async def get_deals(store_id: str, limit: int = 50, session_id: str | None = None) -> list[dict]:
    if not _has_kroger_credentials():
        return DEMO_DEALS

    # Use user token if available for personalized coupon pricing, else app token
    token = None
    using_user_token = False
    if session_id:
        token = await _refresh_user_token(session_id)
        if token:
            using_user_token = True

    if not token:
        try:
            token = await _get_app_token()
        except Exception:
            return DEMO_DEALS

    seen_ids: set[str] = set()
    raw_products = []
    per_term = max(5, limit // len(SEARCH_TERMS) + 1)

    async with httpx.AsyncClient() as client:
        for term in SEARCH_TERMS:
            if len(raw_products) >= limit:
                break
            try:
                resp = await client.get(
                    f"{KROGER_BASE}/products",
                    headers={"Authorization": f"Bearer {token}"},
                    params={"filter.term": term, "filter.locationId": store_id, "filter.limit": per_term},
                    timeout=10,
                )
                if resp.status_code == 200:
                    for p in resp.json().get("data", []):
                        pid = p.get("productId")
                        if pid and pid not in seen_ids:
                            seen_ids.add(pid)
                            raw_products.append(p)
            except Exception:
                continue

    if not raw_products:
        return DEMO_DEALS

    deals = []
    for product in raw_products:
        items = product.get("items", [{}])
        item = items[0] if items else {}
        price_info = item.get("price", {})

        regular = price_info.get("regular") or 0
        promo_price = price_info.get("promo")
        # When using a user token, Kroger folds clipped digital coupons into promo price
        on_sale = promo_price is not None and promo_price < regular
        best_price = promo_price if on_sale else regular
        savings = round(regular - best_price, 2) if on_sale else 0

        images = product.get("images", [])
        image_url = None
        for img in images:
            if img.get("perspective") == "front":
                for sz in img.get("sizes", []):
                    if sz.get("size") == "medium":
                        image_url = sz.get("url")
                        break

        deals.append({
            "product_id": product.get("productId"),
            "name": product.get("description", "Unknown Product"),
            "brand": product.get("brand", ""),
            "category": (product.get("categories") or ["Unknown"])[0],
            "size": item.get("size", ""),
            "regular_price": regular,
            "sale_price": best_price,
            "coupon_price": promo_price if (on_sale and using_user_token) else None,
            "savings": savings,
            "on_sale": on_sale,
            "has_coupon": on_sale and using_user_token,
            "image_url": image_url,
        })

    return deals
