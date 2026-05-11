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
