import json
import os
import anthropic

MODEL = "claude-sonnet-4-6"

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


async def generate_recipe_plan(
    deals: list[dict],
    num_people: int,
    num_days: int,
    macro_profile: str,
    meat_preference: str,
    budget_per_person_per_day: float,
    meals_per_day: int,
) -> dict:
    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    deals_text = _format_deals_for_prompt(deals)
    macro_desc = MACRO_PROFILES.get(macro_profile, MACRO_PROFILES["balanced"])
    meat_desc = MEAT_LABELS.get(meat_preference, MEAT_LABELS["any"])
    total_budget = num_people * num_days * budget_per_person_per_day

    system_prompt = """You are a professional nutritionist and meal planner. You create practical,
delicious meal plans based on grocery store deals to minimize cost while meeting nutritional goals.
Always respond with valid JSON only — no markdown, no explanation outside the JSON."""

    user_prompt = f"""Create a {num_days}-day meal plan for {num_people} people using these grocery store deals.

CONSTRAINTS:
- Total budget: ${total_budget:.2f} (${budget_per_person_per_day:.2f} per person per day)
- Meals per day: {meals_per_day}
- Macro profile: {macro_desc}
- Meat/protein preference: {meat_desc}
- Maximize use of sale items to minimize cost

AVAILABLE DEALS (prioritize these):
{deals_text}

INSTRUCTIONS:
1. Build {num_days} days of meals, each day having {meals_per_day} meals (breakfast, lunch, dinner if 3)
2. Each recipe should be practical with <8 ingredients
3. Heavily favor the sale items listed above
4. You may include pantry staples (salt, pepper, basic spices) at minimal/no cost
5. Calculate realistic per-serving costs based on the sale prices provided
6. Generate a consolidated grocery list deduplicating ingredients

Return ONLY this JSON structure:
{{
  "meal_plan": [
    {{
      "day": 1,
      "meals": [
        {{
          "meal_type": "breakfast",
          "name": "Recipe Name",
          "description": "One-line description",
          "servings": {num_people},
          "ingredients": [
            {{"item": "Chicken Breasts", "amount": "2 lbs", "estimated_cost": 5.98, "on_sale": true}}
          ],
          "instructions": ["Step 1", "Step 2"],
          "macros_per_serving": {{"calories": 450, "protein_g": 35, "carbs_g": 40, "fat_g": 15}},
          "prep_time_minutes": 20,
          "cook_time_minutes": 25,
          "estimated_meal_cost": 8.50
        }}
      ],
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
    "shopping_tips": ["Tip 1", "Tip 2"]
  }}
}}"""

    message = await client.messages.create(
        model=MODEL,
        max_tokens=8096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)


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
        for d in not_on_sale[:10]:
            lines.append(
                f"- {d['name']} ({d.get('size', '')}) | Price: ${d['regular_price']:.2f} | Category: {d.get('category', '')}"
            )

    return "\n".join(lines)


async def generate_snack_cart(
    deals: list[dict],
    macro_focus: str,
    budget: float,
    snacks_per_day: int,
    num_days: int,
    custom_targets: dict | None = None,
) -> dict:
    """Build a cost-optimized snack cart from deals targeting a macro profile.

    macro_focus is one of SNACK_FOCUS_PROFILES, or "custom" when custom_targets
    (per-serving goals like {"protein_g": 20, "max_carbs_g": 15, "max_calories": 200})
    are provided.
    """
    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    deals_text = _format_deals_for_prompt(deals)
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

    system_prompt = """You are a sports nutritionist building budget snack carts from grocery
store deals. You know typical macronutrient values for common packaged and whole-food snacks.
Estimate macros realistically per serving. Respond with valid JSON only — no markdown."""

    user_prompt = f"""Build a snack cart from these grocery deals to cover {total_servings_needed}
snack servings ({snacks_per_day}/day for {num_days} days), staying within a ${budget:.2f} budget.

MACRO GOAL:
{target_desc}

SELECTION RULES:
1. Choose snack products that best fit the macro goal above
2. Heavily favor items that are ON SALE to minimize cost
3. Pick 4-8 distinct snack products for variety
4. Set a realistic purchase quantity for each so total servings >= {total_servings_needed}
5. Estimate macros per serving from your knowledge of these foods
6. Stay within the ${budget:.2f} budget; report the total

AVAILABLE SNACK DEALS:
{deals_text}

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
        model=MODEL,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)
