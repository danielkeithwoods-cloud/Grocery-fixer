import json
import os
import re
import anthropic

DEFAULT_MODEL = "claude-opus-5-5"

MACRO_PROFILES = {
    "balanced": "roughly balanced macros: ~30% protein, ~40% carbs, ~30% fat",
    "high_protein": "high protein focus: ~40% protein, ~30% carbs, ~30% fat — prioritize lean protein sources",
    "low_carb": "low carb: ~35% protein, ~15% carbs, ~50% fat — minimize bread, pasta, rice, and sugary items",
    "high_carb": "higher carbs for energy: ~20% protein, ~55% carbs, ~25% fat",
    "keto": "ketogenic: ~20% protein, ~5% carbs, ~75% fat — avoid all grains, legumes, starchy vegetables",
}

MEAT_LABELS = {
    "any": "any meat",
    "chicken": "chicken (prefer chicken breasts, thighs, or ground chicken)",
    "beef": "beef (prefer ground beef, steak, or stew meat)",
    "pork": "pork (prefer pork chops, tenderloin, or ground pork)",
    "fish": "fish and seafood (prefer salmon, tilapia, shrimp, or tuna)",
    "vegetarian": "no meat — vegetarian only, using eggs, dairy, and plant proteins",
    "vegan": "no animal products — vegan only, using tofu, legumes, and plant proteins",
}

SNACK_FOCUS_PROFILES = {
    "high_protein": "HIGH PROTEIN — prioritize snacks with the most protein per serving and per dollar (jerky, nuts, Greek yogurt, cheese, protein bars, tuna, cottage cheese, edamame). Aim for at least 10g protein per serving.",
    "low_carb": "LOW CARB — minimize carbohydrates per serving (under ~10g). Favor nuts, cheese, jerky, eggs, seeds; avoid crackers, pretzels, rice cakes, fruit snacks, cookies.",
    "low_sugar": "LOW SUGAR — minimize added sugar. Avoid candy, cookies, fruit snacks, sweetened yogurt; favor nuts, cheese, jerky, plain yogurt, veggies, hummus.",
    "low_calorie": "LOW CALORIE — keep each serving under ~150 calories while still satisfying. Favor popcorn, rice cakes, fruit, veggies with hummus, light yogurt, edamame.",
    "high_energy": "HIGH ENERGY / HIGH CARB — carb-forward snacks for active days and endurance (trail mix, granola bars, dried fruit, crackers, banana, oats-based snacks).",
    "balanced": "BALANCED — a sensible mix of protein, carbs, and healthy fats from mostly whole-food snacks (nuts, fruit, yogurt, cheese, whole-grain crackers, hummus).",
}

# Shared across the meal plan and single-meal swap so both reuse the same cached
# prefix (cache key is tools -> system -> messages; see prompt caching docs).
MEAL_SYSTEM = """You are a professional nutritionist and meal planner. You create practical,
delicious meal plans from grocery store deals that minimize cost while meeting nutritional goals.

You respect dietary restrictions absolutely: a listed restriction is an allergy or medical
requirement, so you never include that ingredient, anything that normally contains it, or it as
a substitution.

Always respond with valid JSON only — no markdown fences, no prose outside the JSON."""

SNACK_SYSTEM = """You are a sports nutritionist building budget snack carts from grocery store
deals. You know typical macronutrient values for common packaged and whole foods and estimate
them realistically per serving.

You respect dietary restrictions absolutely: a listed restriction is an allergy or medical
requirement, so you never include that ingredient or anything that normally contains it.

Always respond with valid JSON only — no markdown fences, no prose outside the JSON."""

MEAL_SCHEMA_HINT = """{
  "meal_type": "breakfast",
  "name": "Recipe Name",
  "description": "One-line description",
  "servings": 4,
  "ingredients": [
    {"item": "Chicken Breasts", "amount": "2 lbs", "estimated_cost": 5.98, "on_sale": true}
  ],
  "instructions": ["Step 1", "Step 2"],
  "macros_per_serving": {"calories": 450, "protein_g": 35, "carbs_g": 40, "fat_g": 15},
  "per_person_portions": [{"name": "Alex", "servings": 1.3, "calories": 585}],
  "prep_time_minutes": 20,
  "cook_time_minutes": 25,
  "estimated_meal_cost": 8.50
}"""


def _household_block(household: list[dict] | None, meals_per_day: int) -> str:
    """Per-person calorie targets. Everyone eats the same dishes; portions differ."""
    if not household:
        return ""
    lines = []
    total = 0
    for p in household:
        name = (p.get("name") or "Person").strip()
        cals = int(p.get("calories_per_day") or 0)
        total += cals
        note = (p.get("notes") or "").strip()
        lines.append(f"- {name} — {cals:,} cal/day" + (f" (note: {note})" if note else ""))

    per_meal = round(total / max(1, meals_per_day) / max(1, len(household)))
    return (
        "HOUSEHOLD — size each person's portion to hit their own daily calorie target:\n"
        + "\n".join(lines)
        + f"\nHousehold total: {total:,} cal/day across {len(household)} "
        + f"{'person' if len(household) == 1 else 'people'}"
        + f" (~{per_meal:,} cal per person per meal at {meals_per_day} meals/day).\n\n"
        "PORTIONING RULES:\n"
        "- Everyone eats the SAME dishes — vary the portion size per person, never the recipe\n"
        "- Cook enough total food to cover every person's portion\n"
        "- In each meal, 'per_person_portions' gives each person's share as a multiple of one\n"
        "  standard serving (e.g. 1.3 servings) plus the calories that portion delivers\n"
        "- Each person's portions across the day should land within ~10% of their target\n\n"
    )


def _model() -> str:
    return (os.getenv("ANTHROPIC_MODEL") or "").strip() or DEFAULT_MODEL


def _client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def _text_of(message) -> str:
    """Join text blocks only.

    Current models run adaptive thinking by default, so content[0] can be a
    thinking block — indexing it blindly would return the wrong block.
    """
    return "".join(b.text for b in message.content if b.type == "text").strip()


def _check_stop(message) -> None:
    if message.stop_reason == "max_tokens":
        raise RuntimeError(
            "The response was cut off before it finished. Try fewer days or fewer meals per day."
        )
    if message.stop_reason == "refusal":
        raise RuntimeError("The request was declined. Try adjusting your preferences and retry.")


def _extract_json(raw: str) -> dict:
    """Parse the model's JSON, tolerating stray fences or surrounding prose."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end > start:
            return json.loads(raw[start : end + 1])
        raise


def _constraints_block(
    restrictions: list[str] | None,
    dislikes: list[str] | None,
    pantry_items: list[str] | None,
) -> str:
    parts = []
    if restrictions:
        parts.append(
            "STRICT DIETARY RESTRICTIONS (allergies / medical — never include these, anything\n"
            "that normally contains them, or them as a substitution):\n"
            + "\n".join(f"- {r}" for r in restrictions)
        )
    if dislikes:
        parts.append(
            "DISLIKED INGREDIENTS (avoid; substitute something comparable):\n"
            + "\n".join(f"- {d}" for d in dislikes)
        )
    if pantry_items:
        parts.append(
            "ALREADY IN THE PANTRY (assume on hand at no cost — cook with them freely, but do\n"
            "NOT add them to the grocery list and do NOT count their cost in any total):\n"
            + "\n".join(f"- {p}" for p in pantry_items)
        )
    return ("\n\n".join(parts) + "\n\n") if parts else ""


def _deals_content_block(deals: list[dict]) -> dict:
    """The deals list is identical across requests for a store, so cache it."""
    return {
        "type": "text",
        "text": "AVAILABLE GROCERY DEALS AT THIS STORE:\n" + _format_deals_for_prompt(deals),
        "cache_control": {"type": "ephemeral"},
    }


async def generate_recipe_plan(
    deals: list[dict],
    num_people: int,
    num_days: int,
    macro_profile: str,
    meat_preference: str,
    budget_per_person_per_day: float,
    meals_per_day: int,
    restrictions: list[str] | None = None,
    dislikes: list[str] | None = None,
    pantry_items: list[str] | None = None,
    household: list[dict] | None = None,
) -> dict:
    client = _client()

    macro_desc = MACRO_PROFILES.get(macro_profile, MACRO_PROFILES["balanced"])
    meat_desc = MEAT_LABELS.get(meat_preference, MEAT_LABELS["any"])
    total_budget = num_people * num_days * budget_per_person_per_day

    task = f"""Create a {num_days}-day meal plan for {num_people} people using the deals above.

CONSTRAINTS:
- Total budget: ${total_budget:.2f} (${budget_per_person_per_day:.2f} per person per day)
- Meals per day: {meals_per_day}
- Macro profile: {macro_desc}
- Meat/protein preference: {meat_desc}
- Maximize use of sale items to minimize cost

{_household_block(household, meals_per_day)}{_constraints_block(restrictions, dislikes, pantry_items)}INSTRUCTIONS:
1. Build {num_days} days of meals, each with {meals_per_day} meals (breakfast, lunch, dinner if 3)
2. Keep each recipe practical, with fewer than 8 ingredients
3. Heavily favor the sale items listed above
4. Basic seasonings (salt, pepper, common spices) may be assumed at negligible cost
5. Calculate realistic per-serving costs from the sale prices given
6. Produce a consolidated grocery list with ingredients deduplicated across recipes

Return ONLY this JSON structure:
{{
  "meal_plan": [
    {{
      "day": 1,
      "meals": [{MEAL_SCHEMA_HINT}],
      "day_total_cost": 18.50
    }}
  ],
  "grocery_list": [
    {{
      "item": "Boneless Skinless Chicken Breasts",
      "amount": "4 lbs",
      "estimated_cost": 11.96,
      "category": "Meat & Seafood",
      "on_sale": true,
      "sale_price": 2.99,
      "unit": "per lb"
    }}
  ],
  "summary": {{
    "total_estimated_cost": 85.00,
    "cost_per_person_per_day": 4.25,
    "average_daily_calories_per_person": 2000,
    "total_savings_from_deals": 35.00,
    "per_person_daily": [
      {{"name": "Alex", "target_calories": 2400, "planned_calories": 2380}}
    ],
    "shopping_tips": ["Tip 1", "Tip 2"]
  }}
}}"""

    # Streamed: a 14-day x 3-meal plan is a long generation and would risk an
    # HTTP timeout as a single blocking request.
    async with client.messages.stream(
        model=_model(),
        max_tokens=32000,
        output_config={"effort": "medium"},
        system=MEAL_SYSTEM,
        messages=[{"role": "user", "content": [_deals_content_block(deals), {"type": "text", "text": task}]}],
    ) as stream:
        message = await stream.get_final_message()

    _check_stop(message)
    return _extract_json(_text_of(message))


async def swap_meal(
    deals: list[dict],
    meal_type: str,
    day: int,
    num_people: int,
    macro_profile: str,
    meat_preference: str,
    budget_per_meal: float,
    previous_meal_name: str = "",
    avoid_names: list[str] | None = None,
    restrictions: list[str] | None = None,
    dislikes: list[str] | None = None,
    pantry_items: list[str] | None = None,
    household: list[dict] | None = None,
    meals_per_day: int = 3,
) -> dict:
    """Regenerate a single meal without rebuilding the whole plan."""
    client = _client()

    macro_desc = MACRO_PROFILES.get(macro_profile, MACRO_PROFILES["balanced"])
    meat_desc = MEAT_LABELS.get(meat_preference, MEAT_LABELS["any"])
    avoid = [n for n in (avoid_names or []) if n]

    task = f"""Replace a single meal in an existing meal plan.

SLOT TO FILL: {meal_type} on day {day}, for {num_people} people
REPLACING: {previous_meal_name or "(unspecified)"} — the user wants something different

CONSTRAINTS:
- Target cost for this meal: about ${budget_per_meal:.2f} total
- Macro profile: {macro_desc}
- Meat/protein preference: {meat_desc}
- Favor the sale items listed above
- Must be a genuinely different dish from the one being replaced

{_household_block(household, meals_per_day)}{_constraints_block(restrictions, dislikes, pantry_items)}"""

    if avoid:
        task += (
            "ALREADY IN THE PLAN — do not duplicate any of these:\n"
            + "\n".join(f"- {n}" for n in avoid)
            + "\n\n"
        )

    task += f"""Return ONLY a single meal JSON object in exactly this shape (no wrapper):
{MEAL_SCHEMA_HINT}"""

    message = await client.messages.create(
        model=_model(),
        max_tokens=4000,
        output_config={"effort": "low"},
        system=MEAL_SYSTEM,
        messages=[{"role": "user", "content": [_deals_content_block(deals), {"type": "text", "text": task}]}],
    )

    _check_stop(message)
    meal = _extract_json(_text_of(message))
    meal.setdefault("meal_type", meal_type)
    meal.setdefault("servings", num_people)
    return meal


async def generate_snack_cart(
    deals: list[dict],
    macro_focus: str,
    budget: float,
    snacks_per_day: int,
    num_days: int,
    custom_targets: dict | None = None,
    restrictions: list[str] | None = None,
    dislikes: list[str] | None = None,
) -> dict:
    client = _client()
    total_servings_needed = snacks_per_day * num_days

    if custom_targets:
        target_desc = "CUSTOM PER-SERVING TARGETS:\n"
        if custom_targets.get("protein_g"):
            target_desc += f"- At least {custom_targets['protein_g']}g protein per serving\n"
        if custom_targets.get("max_carbs_g") is not None:
            target_desc += f"- No more than {custom_targets['max_carbs_g']}g carbs per serving\n"
        if custom_targets.get("max_calories") is not None:
            target_desc += f"- No more than {custom_targets['max_calories']} calories per serving\n"
        if custom_targets.get("max_fat_g") is not None:
            target_desc += f"- No more than {custom_targets['max_fat_g']}g fat per serving\n"
        if custom_targets.get("max_sugar_g") is not None:
            target_desc += f"- No more than {custom_targets['max_sugar_g']}g sugar per serving\n"
    else:
        target_desc = SNACK_FOCUS_PROFILES.get(macro_focus, SNACK_FOCUS_PROFILES["balanced"])

    task = f"""Build a snack cart from the deals above covering {total_servings_needed} snack
servings ({snacks_per_day}/day for {num_days} days), within a ${budget:.2f} budget.

MACRO GOAL:
{target_desc}

{_constraints_block(restrictions, dislikes, None)}SELECTION RULES:
1. Choose snack products that best fit the macro goal above
2. Heavily favor items that are ON SALE to minimize cost
3. Pick 4-8 distinct snack products for variety
4. Set a realistic purchase quantity for each so total servings >= {total_servings_needed}
5. Estimate macros per serving from your knowledge of these foods
6. Stay within the ${budget:.2f} budget and report the total

Return ONLY this JSON:
{{
  "snack_cart": [
    {{
      "item": "Roasted Almonds",
      "brand": "Kroger",
      "size": "16 oz",
      "quantity": 1,
      "unit_price": 4.99,
      "total_cost": 4.99,
      "on_sale": true,
      "servings": 16,
      "macros_per_serving": {{"calories": 160, "protein_g": 6, "carbs_g": 6, "fat_g": 14, "sugar_g": 1}},
      "why": "Protein + healthy fat, very low sugar"
    }}
  ],
  "summary": {{
    "macro_focus": "{macro_focus}",
    "total_cost": 22.50,
    "budget": {budget:.2f},
    "total_servings": 48,
    "cost_per_serving": 0.47,
    "avg_macros_per_serving": {{"calories": 165, "protein_g": 12, "carbs_g": 9, "fat_g": 9, "sugar_g": 3}},
    "target_match_notes": "How well this cart hits the goal",
    "tips": ["Tip 1", "Tip 2"]
  }}
}}"""

    message = await client.messages.create(
        model=_model(),
        max_tokens=8000,
        output_config={"effort": "low"},
        system=SNACK_SYSTEM,
        messages=[{"role": "user", "content": [_deals_content_block(deals), {"type": "text", "text": task}]}],
    )

    _check_stop(message)
    return _extract_json(_text_of(message))


def _format_deals_for_prompt(deals: list[dict]) -> str:
    lines = []
    on_sale = [d for d in deals if d.get("on_sale")]
    not_on_sale = [d for d in deals if not d.get("on_sale")]

    if on_sale:
        lines.append("=== ON SALE NOW ===")
        for d in on_sale:
            savings = d.get("savings", 0)
            lines.append(
                f"- {d['name']} ({d.get('size', '')}) | Sale: ${d['sale_price']:.2f} | "
                f"Regular: ${d['regular_price']:.2f} | Save: ${savings:.2f} | Category: {d.get('category', '')}"
            )

    if not_on_sale:
        lines.append("\n=== REGULAR PRICE ===")
        for d in not_on_sale[:15]:
            lines.append(
                f"- {d['name']} ({d.get('size', '')}) | Price: ${d['regular_price']:.2f} | Category: {d.get('category', '')}"
            )

    return "\n".join(lines)
