"""Pydantic schemas for AI extraction output."""

from pydantic import BaseModel, Field


class ExtractedModifier(BaseModel):
    name: str = Field(description="Modifier option name (e.g., 'Large', 'Extra Cheese')")
    price_adjustment: float = Field(
        default=0.0, description="Price change when this modifier is selected"
    )
    is_default: bool = Field(default=False, description="Whether this option is selected by default")
    sort_order: int = Field(default=0, description="Display order for this option")


class ExtractedModifierGroup(BaseModel):
    group_name: str = Field(description="Name of the modifier group (e.g., 'Size', 'Toppings')")
    min_selections: int = Field(default=0, description="Minimum options that must be selected")
    max_selections: int = Field(default=1, description="Maximum options that can be selected")
    is_required: bool = Field(default=False, description="Whether selecting from this group is required")
    sort_order: int = Field(default=0, description="Display order for this modifier group")
    options: list[ExtractedModifier] = Field(default_factory=list)


class ExtractedMenuItem(BaseModel):
    category_name: str = Field(description="Category this item belongs to")
    item_name: str = Field(description="Name of the menu item")
    description: str | None = Field(default=None, description="Item description if available")
    price: float | None = Field(default=None, description="Base price in dollars")
    modifier_groups: list[ExtractedModifierGroup] = Field(
        default_factory=list, description="Available customizations"
    )
    dietary_tags: list[str] = Field(
        default_factory=list,
        description="Dietary labels: vegan, vegetarian, gluten-free, dairy-free, nut-free, halal, kosher",
    )
    allergens: list[str] = Field(
        default_factory=list,
        description="Known allergens: milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soy",
    )
    confidence: float = Field(
        default=0.8,
        description="Confidence score 0-1 for the overall extraction quality of this item",
    )


class MenuExtractionResult(BaseModel):
    """Complete structured extraction from a menu document."""

    categories: list[str] = Field(description="All category names found")
    items: list[ExtractedMenuItem] = Field(description="All extracted menu items")
