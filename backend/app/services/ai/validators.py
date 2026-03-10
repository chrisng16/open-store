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

        # Validate price in cents
        if item.unit_amount is not None:
            if item.unit_amount < 0:
                item.unit_amount = abs(item.unit_amount)
                confidence *= 0.7
            elif item.unit_amount == 0:
                confidence *= 0.5  # Suspicious — might be a free item or extraction error
            elif item.unit_amount > 500000:
                confidence *= 0.6  # Unusual price in cents
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

        # Validate option lists
        for group_index, option_list in enumerate(item.option_lists):
            option_list.name = option_list.name.strip()
            option_list.min_num_options = max(0, option_list.min_num_options)
            option_list.max_num_options = max(option_list.min_num_options, option_list.max_num_options)
            option_list.min_aggregate_options_quantity = max(0, option_list.min_aggregate_options_quantity)
            option_list.max_aggregate_options_quantity = max(
                option_list.min_aggregate_options_quantity,
                option_list.max_aggregate_options_quantity,
            )
            option_list.sort_order = max(0, option_list.sort_order if option_list.sort_order is not None else group_index)

            for option_index, option in enumerate(option_list.options):
                option.name = option.name.strip()
                option.unit_amount = max(0, option.unit_amount)
                option.min_option_choice_quantity = max(0, option.min_option_choice_quantity)
                option.max_option_choice_quantity = max(
                    option.min_option_choice_quantity,
                    option.max_option_choice_quantity,
                )
                option.default_quantity = max(0, option.default_quantity)
                option.sort_order = max(0, option.sort_order if option.sort_order is not None else option_index)

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
