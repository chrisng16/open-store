"""Post-AI validation for extracted menu items."""

from app.services.ai.schema import MenuExtractionResult, ExtractedMenuItem

VALID_DIETARY_TAGS = {
    "vegan",
    "vegetarian",
    "gluten-free",
    "dairy-free",
    "nut-free",
    "halal",
    "kosher",
}

VALID_ALLERGENS = {
    "milk",
    "eggs",
    "fish",
    "shellfish",
    "tree nuts",
    "peanuts",
    "wheat",
    "soy",
}


def validate_extraction(result: MenuExtractionResult) -> MenuExtractionResult:
    """Validate and clean up AI extraction results. Adjusts confidence scores for issues found."""
    validated_items: list[ExtractedMenuItem] = []

    for item in result.items:
        confidence = item.confidence

        # Validate price
        if item.price is not None:
            if item.price < 0:
                item.price = abs(item.price)
                confidence *= 0.7
            elif item.price == 0:
                confidence *= 0.5  # Suspicious — might be a free item or extraction error
            elif item.price > 500:
                confidence *= 0.6  # Unusual price — might be in cents
        else:
            confidence *= 0.4  # Missing price is a significant issue

        # Validate item name
        if not item.item_name or len(item.item_name.strip()) == 0:
            continue  # Skip items with no name
        item.item_name = item.item_name.strip()

        # Validate and filter dietary tags
        item.dietary_tags = [
            tag.lower().strip()
            for tag in item.dietary_tags
            if tag.lower().strip() in VALID_DIETARY_TAGS
        ]

        # Validate and filter allergens
        item.allergens = [
            a.lower().strip()
            for a in item.allergens
            if a.lower().strip() in VALID_ALLERGENS
        ]

        # Validate modifier groups
        for group_index, mg in enumerate(item.modifier_groups):
            mg.group_name = mg.group_name.strip()
            mg.min_selections = max(0, mg.min_selections)
            mg.max_selections = max(mg.min_selections, mg.max_selections)
            mg.sort_order = max(0, mg.sort_order if mg.sort_order is not None else group_index)

            for option_index, mod in enumerate(mg.options):
                mod.name = mod.name.strip()
                mod.sort_order = max(0, mod.sort_order if mod.sort_order is not None else option_index)

        # Validate category
        if not item.category_name or len(item.category_name.strip()) == 0:
            item.category_name = "Other"
            confidence *= 0.8

        item.confidence = round(min(max(confidence, 0.0), 1.0), 2)
        validated_items.append(item)

    result.items = validated_items

    # Deduplicate categories
    result.categories = list(dict.fromkeys(
        item.category_name for item in validated_items
    ))

    return result
