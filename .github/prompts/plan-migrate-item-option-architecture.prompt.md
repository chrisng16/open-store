## Plan: Hard Rebuild to ItemHeader/OptionLists + Cents

Rebuild to match the target JSON contract language and behavior: `itemHeader`, `optionLists`, `options`, `selectionNode`, and cents-based pricing (`unitAmount`). This is a hard cutover with DB reset, so no legacy compatibility layer is included.

**Steps**

1. Phase 1 (Backend): define canonical contract using JSON-style field naming semantics.
2. Replace product option entities with JSON-aligned terminology in backend domain model: `ModifierGroup` -> `OptionList`, `Modifier` -> `Option`, `modifier_groups` -> `option_lists`, `modifiers` -> `options`.
3. Rename selection constraint fields to JSON equivalents: `min_selections` -> `minNumOptions`, `max_selections` -> `maxNumOptions`, `is_required` -> `isOptional` (inverted semantics), and add `selectionNode`, `minAggregateOptionsQuantity`, `maxAggregateOptionsQuantity`, `minOptionChoiceQuantity`, `maxOptionChoiceQuantity`, `defaultQuantity`.
4. Standardize all pricing on integer cents: `base_price` -> `unitAmount`-style cents fields (for item header and options), and keep `currency` + `decimalPlaces` explicit, defaulted to USD and 2 decimal places. For now we don't expect any currency other than USD, but having explicit fields allows for future expansion and avoids hardcoded assumptions.
5. Convert order and checkout storage/math to cents-only fields (integer arithmetic everywhere, no decimal float math in business logic).
6. Update menu import persistence and publish mapping so parsed option payloads are stored and published using `optionLists/options` wording and cents fields.
7. Update API schemas and handlers to expose only the new contract wording and types (no legacy `modifier*` or dollar-decimal fields).
8. Update AI extraction schema/prompt/validator/parser to emit JSON-style keys and constraints (`selectionNode`, `minNumOptions`, aggregate quantity fields, option choice bounds, `unitAmount`).
9. Recreate migration baseline and reset DB from scratch with the new naming/pricing model.
10. Phase 2 (Frontend): switch all UI types, selection logic, and cart/order payloads to JSON-style wording.
11. Rename storefront and dashboard types from modifier wording to `optionLists/options` wording and align product payload to `itemHeader` semantics.
12. Refactor selection UI logic to operate directly on `selectionNode` modes: `single_select`, `multi_select`, `aggregate_quantity`.
13. Implement validation and interaction rules using `minNumOptions`, `maxNumOptions`, `minAggregateOptionsQuantity`, `maxAggregateOptionsQuantity`, `minOptionChoiceQuantity`, and `maxOptionChoiceQuantity`.
14. Convert all frontend pricing calculations to cents (`unitAmount`) and format to currency only at render boundaries.
15. Update cart serialization, edit-cart rehydration, and checkout payloads to use option wording + cents contract end-to-end.

**Relevant files**

- `/Users/mac/Code/open-store/backend/app/models/product.py` — rename domain entities and fields to option-list semantics.
- `/Users/mac/Code/open-store/backend/app/models/order.py` — migrate order money and item-option references to cents + option wording.
- `/Users/mac/Code/open-store/backend/app/models/menu_import.py` — store import item price in cents and option-list shaped payloads.
- `/Users/mac/Code/open-store/backend/app/models/__init__.py` — export renamed symbols.
- `/Users/mac/Code/open-store/backend/app/schemas/product.py` — expose `optionLists/options`-style schema and cents fields.
- `/Users/mac/Code/open-store/backend/app/schemas/order.py` — cents-only order payload schema.
- `/Users/mac/Code/open-store/backend/app/schemas/menu_import.py` — JSON-style option payload naming.
- `/Users/mac/Code/open-store/backend/app/schemas/__init__.py` — update schema exports.
- `/Users/mac/Code/open-store/backend/app/api/v1/products.py` — CRUD mapped to renamed entities/fields.
- `/Users/mac/Code/open-store/backend/app/api/v1/menu_imports.py` — publish flow mapped to `optionLists/options` and cents.
- `/Users/mac/Code/open-store/backend/app/api/v1/orders.py` — cents math and option payload ingestion.
- `/Users/mac/Code/open-store/backend/app/services/ai/schema.py` — extraction schema keys aligned to JSON example wording.
- `/Users/mac/Code/open-store/backend/app/services/ai/prompts.py` — extraction prompt asks for `itemHeader` + `optionLists` semantics.
- `/Users/mac/Code/open-store/backend/app/services/ai/validators.py` — validate selection and quantity constraints using JSON field meanings.
- `/Users/mac/Code/open-store/backend/app/services/ai/menu_parser.py` — parser output transformed to option-list + cents payload.
- `/Users/mac/Code/open-store/backend/alembic/versions/` — new baseline migration for renamed fields and cents columns.
- `/Users/mac/Code/open-store/frontend/components/store/menu-browser.tsx` — payload typing, add-to-cart mapping, and cents display.
- `/Users/mac/Code/open-store/frontend/components/store/product-dialog.tsx` — selectionNode-driven option list UI and validation.
- `/Users/mac/Code/open-store/frontend/components/store/product-detail.tsx` — detail page option flow and cents totals.
- `/Users/mac/Code/open-store/frontend/lib/cart-store.ts` — option payload and cents-safe cart totals.
- `/Users/mac/Code/open-store/frontend/components/dashboard/products/product-options-sheet.tsx` — admin authoring with JSON-style option fields.
- `/Users/mac/Code/open-store/frontend/components/dashboard/products/product-editor-types.ts` — renamed form model for option lists.
- `/Users/mac/Code/open-store/frontend/components/dashboard/ai-import/types.ts` — import review types aligned with JSON wording.
- `/Users/mac/Code/open-store/frontend/components/dashboard/ai-import/utils.ts` — converters aligned with `optionLists/options` and cents.

**Verification**

1. Fresh migration boot: run from empty DB and confirm backend starts with renamed symbols and new schema.
2. Product API contract: create/read/update using `optionLists/options` naming and cents pricing fields only.
3. Menu import publish: verify approved import items create option lists and options with correct constraint fields and `unitAmount` values.
4. Order pricing integrity: checkout computes and stores totals using integer cents only.
5. Storefront flow: browse, configure options, add/edit cart, and checkout all function with new wording/fields.
6. Dashboard flow: create/edit products with selection modes and quantity constraints round-trip correctly.
7. Repo hygiene: run type/lint/tests and confirm no stale `modifier*` or decimal-dollar references remain.

**Decisions**

- Hard cutover only: no backward compatibility or legacy alias fields.
- Canonical wording follows JSON example semantics (`optionLists`, `options`, `selectionNode`, `isOptional`, `unitAmount`).
- Pricing is whole-number cents end-to-end, with explicit `currency` and `decimalPlaces`.
- Included scope: backend, frontend, import pipeline, and order pipeline.
- Excluded scope: preserving old tables/data/field names.

**Further Considerations**

1. Decide whether API keys should remain camelCase (to mirror external JSON exactly) while DB columns stay snake_case internally.
2. Decide if `displayString` should be persisted or derived in frontend from `unitAmount` + currency formatting.
3. Enforce an enum/check-constraint for `selectionNode` values to prevent malformed data at storage level.
