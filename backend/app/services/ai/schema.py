"""Pydantic schemas for AI extraction output."""

from pydantic import BaseModel, Field


class ExtractedOption(BaseModel):
    name: str = Field(description="Option name (e.g., 'Large', 'Extra Cheese')")
    unit_amount: int = Field(default=0, description="Price delta for this option in cents")
    currency: str = Field(default="USD", description="ISO currency code")
    decimal_places: int = Field(default=2, description="Currency decimal places")
    min_option_choice_quantity: int = Field(default=0, description="Minimum quantity per option")
    max_option_choice_quantity: int = Field(default=1, description="Maximum quantity per option")
    default_quantity: int = Field(default=0, description="Default selected quantity for this option")
    is_default: bool = Field(default=False, description="Whether this option is selected by default")
    sort_order: int = Field(default=0, description="Display order for this option")


class ExtractedOptionList(BaseModel):
    name: str = Field(description="Name of the option list (e.g., 'Size', 'Toppings')")
    selection_node: str = Field(default="multi_select", description="Selection behavior: single_select, multi_select, aggregate_quantity")
    min_num_options: int = Field(default=0, description="Minimum options that must be selected")
    max_num_options: int = Field(default=1, description="Maximum options that can be selected")
    min_aggregate_options_quantity: int = Field(default=0, description="Minimum total quantity selected across options")
    max_aggregate_options_quantity: int = Field(default=0, description="Maximum total quantity selected across options")
    is_optional: bool = Field(default=True, description="Whether selecting from this option list is optional")
    sort_order: int = Field(default=0, description="Display order for this option list")
    options: list[ExtractedOption] = Field(default_factory=list)


class ExtractedMenuItem(BaseModel):
    category_name: str = Field(description="Category this item belongs to")
    item_name: str = Field(description="Name of the menu item")
    description: str | None = Field(default=None, description="Item description if available")
    unit_amount: int | None = Field(default=None, description="Base item price in cents")
    currency: str = Field(default="USD", description="ISO currency code")
    decimal_places: int = Field(default=2, description="Currency decimal places")
    option_lists: list[ExtractedOptionList] = Field(default_factory=list, description="Available customizations")
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
