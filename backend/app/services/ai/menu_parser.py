"""
AI Menu Parser — Uses Google Gemini to extract structured menu data from documents.
Supports PDF, images, CSV, and XLSX files.
"""

import json
import csv
import io
from importlib import import_module
from dataclasses import dataclass

from app.config import get_settings
from app.models.menu_import import FileType
from app.services.ai.schema import MenuExtractionResult, ExtractedMenuItem, ExtractedOptionList, ExtractedOption
from app.services.ai.prompts import (
    MENU_EXTRACTION_SYSTEM_PROMPT,
    MENU_EXTRACTION_USER_PROMPT,
    MENU_EXTRACTION_PROMPT_VERSION,
)
from app.services.ai.validators import validate_extraction
from app.services.storage import download_file


@dataclass
class ParseResult:
    """Result of menu file parsing."""
    raw_data: dict
    parsed_data: dict
    items: list


async def _parse_with_gemini(file_content: bytes, file_type: FileType) -> MenuExtractionResult:
    """Send file to Gemini and get structured menu extraction."""
    settings = get_settings()
    genai = import_module("google.genai")
    types = import_module("google.genai.types")
    client = genai.Client(api_key=settings.gemini_api_key)

    # Determine MIME type
    mime_map = {
        FileType.pdf: "application/pdf",
        FileType.image: "image/jpeg",  # Default; Gemini handles auto-detection
    }
    mime_type = mime_map.get(file_type, "application/octet-stream")

    # Build the content parts
    parts = [
        types.Part.from_bytes(data=file_content, mime_type=mime_type),
        types.Part.from_text(text=MENU_EXTRACTION_USER_PROMPT),
    ]

    # Call Gemini with structured output
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=parts,
        config=types.GenerateContentConfig(
            system_instruction=MENU_EXTRACTION_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=MenuExtractionResult,
            temperature=0.1,  # Low temperature for factual extraction
        ),
    )

    # Parse the response
    result = MenuExtractionResult.model_validate_json(response.text)
    return result


async def _parse_csv(file_content: bytes) -> MenuExtractionResult:
    """Parse a CSV file into menu items. Expected columns: category, name, description, price."""
    text = file_content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    items: list[ExtractedMenuItem] = []
    categories: set[str] = set()

    for row in reader:
        category = row.get("category", row.get("Category", "Other")).strip()
        name = row.get("name", row.get("Name", row.get("item", ""))).strip()
        description = row.get("description", row.get("Description", "")).strip() or None
        price_str = row.get("price", row.get("Price", "0"))

        try:
            price = float(price_str.replace("$", "").replace(",", "").strip())
            unit_amount = round(price * 100)
        except (ValueError, AttributeError):
            unit_amount = None

        if not name:
            continue

        categories.add(category)
        items.append(
            ExtractedMenuItem(
                category_name=category,
                item_name=name,
                description=description,
                unit_amount=unit_amount,
                confidence=0.95 if unit_amount is not None else 0.7,
            )
        )

    return MenuExtractionResult(categories=list(categories), items=items)


async def _parse_xlsx(file_content: bytes) -> MenuExtractionResult:
    """Parse an Excel file into menu items."""
    load_workbook = import_module("openpyxl").load_workbook

    wb = load_workbook(io.BytesIO(file_content), read_only=True)
    ws = wb.active
    if ws is None:
        return MenuExtractionResult(categories=[], items=[])

    items: list[ExtractedMenuItem] = []
    categories: set[str] = set()

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return MenuExtractionResult(categories=[], items=[])

    # Use first row as headers
    headers = [str(h).lower().strip() if h else "" for h in rows[0]]

    def col_idx(names: list[str]) -> int | None:
        for name in names:
            if name in headers:
                return headers.index(name)
        return None

    cat_idx = col_idx(["category", "cat", "section"])
    name_idx = col_idx(["name", "item", "item name", "product"])
    desc_idx = col_idx(["description", "desc", "details"])
    price_idx = col_idx(["price", "cost", "amount"])

    for row in rows[1:]:
        category = str(row[cat_idx]).strip() if cat_idx is not None and row[cat_idx] else "Other"
        name = str(row[name_idx]).strip() if name_idx is not None and row[name_idx] else ""
        description = str(row[desc_idx]).strip() if desc_idx is not None and row[desc_idx] else None
        unit_amount = None
        if price_idx is not None and row[price_idx]:
            try:
                price = float(str(row[price_idx]).replace("$", "").replace(",", "").strip())
                unit_amount = round(price * 100)
            except ValueError:
                pass

        if not name or name == "None":
            continue

        categories.add(category)
        items.append(
            ExtractedMenuItem(
                category_name=category,
                item_name=name,
                description=description if description != "None" else None,
                unit_amount=unit_amount,
                confidence=0.95 if unit_amount is not None else 0.7,
            )
        )

    return MenuExtractionResult(categories=list(categories), items=items)


async def parse_menu_file(file_url: str, file_type: FileType) -> ParseResult:
    """
    Main entry point: parse a menu file (from S3) and return validated structured data.
    """
    settings = get_settings()

    # Download file from S3
    file_content = await download_file(file_url)

    # Parse based on file type
    if file_type == FileType.csv:
        result = await _parse_csv(file_content)
    elif file_type == FileType.xlsx:
        result = await _parse_xlsx(file_content)
    elif file_type in (FileType.pdf, FileType.image):
        result = await _parse_with_gemini(file_content, file_type)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")

    # Validate and clean up
    validated = validate_extraction(result)

    # Build parse result items for DB storage
    parsed_items = []
    for item in validated.items:
        option_lists = []
        for group_index, ol in enumerate(item.option_lists):
            options = []
            for option_index, option in enumerate(ol.options):
                options.append({
                    "name": option.name,
                    "unitAmount": option.unit_amount,
                    "currency": option.currency,
                    "decimalPlaces": option.decimal_places,
                    "minOptionChoiceQuantity": option.min_option_choice_quantity,
                    "maxOptionChoiceQuantity": option.max_option_choice_quantity,
                    "defaultQuantity": option.default_quantity,
                    "isDefault": option.is_default,
                    "sortOrder": option.sort_order if option.sort_order is not None else option_index,
                })

            option_lists.append({
                "name": ol.name,
                "selectionNode": ol.selection_node,
                "minNumOptions": ol.min_num_options,
                "maxNumOptions": ol.max_num_options,
                "minAggregateOptionsQuantity": ol.min_aggregate_options_quantity,
                "maxAggregateOptionsQuantity": ol.max_aggregate_options_quantity,
                "isOptional": ol.is_optional,
                "sortOrder": ol.sort_order if ol.sort_order is not None else group_index,
                "options": options,
            })

        option_lists_payload = {"optionLists": option_lists} if option_lists else None

        parsed_items.append(
            type("ParsedItem", (), {
                "category_name": item.category_name,
                "item_name": item.item_name,
                "description": item.description,
                "unit_amount": item.unit_amount,
                "option_lists": option_lists_payload,
                "dietary_tags": item.dietary_tags,
                "allergens": item.allergens,
                "confidence": item.confidence,
            })()
        )

    parser_name = "gemini" if file_type in (FileType.pdf, FileType.image) else file_type.value
    return ParseResult(
        raw_data=validated.model_dump(),
        parsed_data={
            "items_count": len(parsed_items),
            "categories": validated.categories,
            "ingestion_meta": {
                "parser": parser_name,
                "model": settings.gemini_model if parser_name == "gemini" else None,
                "prompt_version": MENU_EXTRACTION_PROMPT_VERSION if parser_name == "gemini" else None,
            },
        },
        items=parsed_items,
    )
