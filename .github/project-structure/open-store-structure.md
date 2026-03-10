# Open Store Project Structure Reference

This document summarizes the repository structure, how major modules work together, and what each important file is responsible for.

## 1. System Overview

Open Store is a multi-tenant food ordering platform with:

- A FastAPI backend (`backend/`) for store/team/product/order/payment/upload APIs.
- A Next.js frontend (`frontend/`) for both dashboard/admin and public store ordering pages.
- Redis + ARQ workers for asynchronous menu ingestion and cleanup jobs.
- PostgreSQL for transactional data.
- S3 for file storage.
- Stripe Connect for payments.
- Supabase for authentication and user identity.
- Gemini-based AI extraction for menu import from PDF/image/CSV/XLSX.

## 2. Runtime Architecture

- Frontend calls backend API under `/api/v1` with Supabase bearer tokens.
- Backend enforces per-store authorization with member roles and optional custom store roles.
- Dashboard users upload files to S3 through signed URLs.
- Worker consumes queued menu-import jobs, parses files, and writes reviewable import items.
- Approved import items are published into normalized product/category/option tables.

## 3. Root-Level Files

- `.env.example`: documents env variable split between backend and frontend.
- `.gitignore`: ignored files/folders.
- `docker-compose.yml`: local stack (postgres, redis, backend, worker, frontend).
- `Makefile`: convenience commands for dev, worker, migrations, lint, build.
- `package.json`: root metadata and package manager pin.
- `package.json.bak`: backup package metadata.
- `skills-lock.json`: lockfile for Copilot skill usage.
- `.github/copilot-instructions.md`: workspace Copilot instruction file (currently empty).
- `.github/prompts/*.prompt.md`: planning prompt templates.
- `.vscode/launch.json`: local debug launch configs.
- `.vscode/mcp.json`: MCP tool configuration.
- `.vscode/settings.json`: workspace settings.
- `.agents/skills/frontend-design/SKILL.md`: skill instructions for frontend design.
- `.agents/skills/frontend-design/LICENSE.txt`: skill license text.

## 4. Backend (`backend/`)

### 4.1 Backend Config and Boot Files

- `backend/Dockerfile`: Python image for API/worker containers.
- `backend/alembic.ini`: Alembic config.
- `backend/pyproject.toml`: Python dependencies and tooling config.
- `backend/.gitignore`: backend-specific ignores.
- `backend/.env`: backend environment file (local only).
- `backend/example-item.json`: example menu item payload used for modeling/reference.
- `backend/scripts/smoke_ai_import_flow.py`: smoke test script for AI import flow.

### 4.2 DB Migrations (`backend/alembic/`)

- `backend/alembic/env.py`: migration environment setup.
- `backend/alembic/script.py.mako`: migration template.
- `backend/alembic/versions/.gitkeep`: keeps migration folder tracked.
- `backend/alembic/versions/db6fcfbf9f78_initial.py`: initial schema.
- `backend/alembic/versions/9a31b2f15d7c_add_business_hours_to_stores.py`: business hours.
- `backend/alembic/versions/a1f9257dbd11_add_file_size_to_menu_imports.py`: import file size tracking.
- `backend/alembic/versions/e8b0f34419d2_add_ingested_at_to_menu_imports.py`: ingestion timestamp.
- `backend/alembic/versions/f4d8a6a1c9bb_add_processing_started_at_to_menu_imports.py`: processing start timestamp.
- `backend/alembic/versions/c42f6a4bd910_add_upload_assets_table.py`: upload-asset metadata table.
- `backend/alembic/versions/b21d5f9473aa_add_store_invites_table.py`: invite support.
- `backend/alembic/versions/d2c7a9b3c1f0_add_store_roles_and_member_role_fk.py`: custom role model.

### 4.3 App Core (`backend/app/`)

- `backend/app/main.py`: FastAPI app creation, CORS, route registration.
- `backend/app/config.py`: settings (DB, Redis, Supabase, Stripe, S3, Gemini, URLs).
- `backend/app/database.py`: async SQLAlchemy engine and session maker.
- `backend/app/__init__.py`: package marker.

### 4.4 API Layer (`backend/app/api/`)

- `backend/app/api/__init__.py`: package marker.
- `backend/app/api/deps.py`: auth token validation, current user, store context, role permissions.
- `backend/app/api/v1/__init__.py`: versioned API router package marker.
- `backend/app/api/v1/health.py`: health endpoint.
- `backend/app/api/v1/stores.py`: store CRUD and store-facing retrieval.
- `backend/app/api/v1/products.py`: category/product/option-list/option APIs.
- `backend/app/api/v1/orders.py`: order creation and order state transitions.
- `backend/app/api/v1/menu_imports.py`: upload/process/review/publish menu import workflow.
- `backend/app/api/v1/uploads.py`: upload intent, signed URL handling, upload completion.
- `backend/app/api/v1/payments.py`: Stripe payment intent endpoints.
- `backend/app/api/v1/team.py`: roles, invites, members, invite acceptance.

### 4.5 Middleware (`backend/app/middleware/`)

- `backend/app/middleware/__init__.py`: package marker.
- `backend/app/middleware/tenant.py`: optional tenant header extraction into request state.

### 4.6 ORM Models (`backend/app/models/`)

- `backend/app/models/__init__.py`: model exports/marker.
- `backend/app/models/base.py`: declarative base and timestamp/UUID mixins.
- `backend/app/models/store.py`: stores, members, invites, roles, business hours.
- `backend/app/models/product.py`: categories, products, option lists, options.
- `backend/app/models/order.py`: orders, order items, order item options.
- `backend/app/models/menu_import.py`: menu import jobs and extracted import items.
- `backend/app/models/upload.py`: upload asset life-cycle and metadata.
- `backend/app/models/audit.py`: audit log entity.

### 4.7 Pydantic Schemas (`backend/app/schemas/`)

- `backend/app/schemas/__init__.py`: schema exports/marker.
- `backend/app/schemas/store.py`: store payloads including business hours rules.
- `backend/app/schemas/product.py`: category/product/option schema contracts.
- `backend/app/schemas/order.py`: order request/response contracts.
- `backend/app/schemas/menu_import.py`: import item review/update/publish contracts.
- `backend/app/schemas/team.py`: member/role/invite payloads.
- `backend/app/schemas/upload.py`: upload intent/complete payloads.

### 4.8 Services (`backend/app/services/`)

- `backend/app/services/__init__.py`: package marker.
- `backend/app/services/team.py`: invite token creation, expiry, role bootstrap behavior.
- `backend/app/services/storage.py`: S3 upload/download/head/delete + presigned URLs.
- `backend/app/services/stripe_service.py`: Stripe Connect onboarding and payment logic.
- `backend/app/services/supabase_admin.py`: profile lookup via Supabase admin API.
- `backend/app/services/ai/__init__.py`: AI package marker.
- `backend/app/services/ai/prompts.py`: AI prompt templates.
- `backend/app/services/ai/schema.py`: structured extraction schema models.
- `backend/app/services/ai/validators.py`: extracted-data validation/sanitization.
- `backend/app/services/ai/menu_parser.py`: parser orchestrator for PDF/image/CSV/XLSX.

### 4.9 Workers (`backend/app/workers/`)

- `backend/app/workers/__init__.py`: worker package marker.
- `backend/app/workers/menu_ingestion.py`: ARQ tasks for menu processing and stale upload cleanup.

## 5. Frontend (`frontend/`)

### 5.1 Frontend Config and Build Files

- `frontend/package.json`: app dependencies and scripts.
- `frontend/pnpm-lock.yaml`: dependency lockfile.
- `frontend/pnpm-workspace.yaml`: workspace config.
- `frontend/next.config.ts`: Next.js config.
- `frontend/tsconfig.json`: TypeScript config.
- `frontend/tsconfig.tsbuildinfo`: TS incremental cache artifact.
- `frontend/eslint.config.mjs`: lint config.
- `frontend/postcss.config.mjs`: PostCSS config.
- `frontend/components.json`: shadcn config.
- `frontend/Dockerfile`: frontend container image setup.
- `frontend/.env.local`: frontend env file (local only).
- `frontend/.gitignore`: frontend ignores.
- `frontend/README.md`: frontend-focused README.
- `frontend/skills-lock.json`: frontend skill lock file.
- `frontend/next-env.d.ts`: Next.js TypeScript ambient types.
- `frontend/example-item.json`: sample item payload reference.
- `frontend/public/*.svg`: static icons/assets.
- `frontend/app/favicon.ico`: site icon.

### 5.2 App Router (`frontend/app/`)

- `frontend/app/layout.tsx`: root providers and global shell.
- `frontend/app/globals.css`: global design tokens and styles.
- `frontend/app/page.tsx`: landing page.
- `frontend/app/proxy.ts`: auth/session middleware for protected routes.
- `frontend/app/(auth)/layout.tsx`: auth pages wrapper.
- `frontend/app/(auth)/login/page.tsx`: login UI and auth actions.
- `frontend/app/(auth)/signup/page.tsx`: signup UI and auth actions.
- `frontend/app/api/auth/callback/route.ts`: OAuth callback route.

#### Dashboard Routes

- `frontend/app/dashboard/layout.tsx`: dashboard frame layout.
- `frontend/app/dashboard/page.tsx`: root dashboard entry/store selection.
- `frontend/app/dashboard/page.tsx.bak`: backup copy of dashboard page.
- `frontend/app/dashboard/store/new/page.tsx`: create-store flow page.
- `frontend/app/dashboard/_components/store-card-display.tsx`: store card grid/list UI.
- `frontend/app/dashboard/_components/store-sub-nav.tsx`: dashboard sub-navigation.
- `frontend/app/dashboard/[storeId]/layout.tsx`: store-scoped layout.
- `frontend/app/dashboard/[storeId]/page.tsx`: store overview/settings page.
- `frontend/app/dashboard/[storeId]/orders/page.tsx`: order management page.
- `frontend/app/dashboard/[storeId]/settings/page.tsx`: store settings page.

#### Stock Management

- `frontend/app/dashboard/[storeId]/(stock-management)/layout.tsx`: stock-management wrapper.
- `frontend/app/dashboard/[storeId]/(stock-management)/categories/page.tsx`: category management page.
- `frontend/app/dashboard/[storeId]/(stock-management)/products/page.tsx`: products table/editor page.
- `frontend/app/dashboard/[storeId]/(stock-management)/_components/stock-management-sub-nav.tsx`: categories/products navigation tabs.

#### AI Import

- `frontend/app/dashboard/[storeId]/ai-import/page.tsx`: import listing/upload page.
- `frontend/app/dashboard/[storeId]/ai-import/[importId]/page.tsx`: import review detail page.
- `frontend/app/dashboard/[storeId]/ai-import/_components/import-sub-nav.tsx`: import section sub-nav.

#### Team

- `frontend/app/dashboard/[storeId]/team/page.tsx`: team management shell page.
- `frontend/app/dashboard/[storeId]/team/_components/team-sub-nav.tsx`: team tabs/sub-nav.
- `frontend/app/dashboard/[storeId]/team/_components/team-members-tab.tsx`: members table and role updates.
- `frontend/app/dashboard/[storeId]/team/_components/roles-tab.tsx`: role list/management.
- `frontend/app/dashboard/[storeId]/team/_components/role-editor-sheet.tsx`: create/edit role sheet.
- `frontend/app/dashboard/[storeId]/team/_components/permission-tree.tsx`: permission matrix UI.
- `frontend/app/dashboard/[storeId]/team/_components/invites-tab.tsx`: invite management.
- `frontend/app/dashboard/[storeId]/team/_components/unsaved-changes-dialog.tsx`: pending-change confirmation dialog.

#### Public Store and Customer Flows

- `frontend/app/store/[slug]/layout.tsx`: public store layout wrapper.
- `frontend/app/store/[slug]/page.tsx`: public storefront with categories/products.
- `frontend/app/store/[slug]/item/[id]/page.tsx`: item detail page.
- `frontend/app/store/[slug]/cart/page.tsx`: cart page.
- `frontend/app/store/[slug]/checkout/page.tsx`: checkout page.
- `frontend/app/store/[slug]/order/[orderId]/page.tsx`: order confirmation/detail page.
- `frontend/app/store/[slug]/_components/store-header.tsx`: public store header.
- `frontend/app/store/[slug]/_components/store-footer.tsx`: public store footer.
- `frontend/app/invites/[token]/page.tsx`: invite acceptance bridge page.

### 5.3 Shared Components (`frontend/components/`)

- `frontend/components/app-sidebar.tsx`: dashboard sidebar shell.
- `frontend/components/create-store-sidebar.tsx`: create-store flow sidebar.
- `frontend/components/nav-group.tsx`: grouped sidebar navigation container.
- `frontend/components/nav-secondary.tsx`: secondary navigation items.
- `frontend/components/nav-stores.tsx`: per-store sidebar section.
- `frontend/components/nav-user.tsx`: profile/account menu.
- `frontend/components/query-provider.tsx`: React Query provider.
- `frontend/components/search-form.tsx`: header search form.
- `frontend/components/sidebar-trigger.tsx`: sidebar open/close trigger.
- `frontend/components/site-header.tsx`: dashboard top header.
- `frontend/components/store-switcher.tsx`: active store switch dropdown.
- `frontend/components/theme-provider.tsx`: theme context wrapper.

#### Dashboard Feature Components

- `frontend/components/dashboard/common/bulk-delete-dialog.tsx`: multi-delete confirmation dialog.
- `frontend/components/dashboard/common/categories-table-columns.tsx`: category table columns.
- `frontend/components/dashboard/common/category-delete-dialog.tsx`: delete-category dialog.
- `frontend/components/dashboard/common/category-editor-dialog.tsx`: add/edit category dialog.
- `frontend/components/dashboard/common/category-quick-create-dialog.tsx`: quick add category dialog.
- `frontend/components/dashboard/common/data-table-column-header.tsx`: sortable/filterable header UI.
- `frontend/components/dashboard/common/data-table.tsx`: reusable data-table wrapper.
- `frontend/components/dashboard/common/product-delete-dialog.tsx`: delete-product dialog.
- `frontend/components/dashboard/common/products-table-columns.tsx`: product table columns.
- `frontend/components/dashboard/common/stock-management-dialog-host.tsx`: central dialog host for category/product operations.
- `frontend/components/dashboard/products/product-basic-info-sheet.tsx`: product basic info form section.
- `frontend/components/dashboard/products/product-category-input.tsx`: category selector/input.
- `frontend/components/dashboard/products/product-editor-dialog.tsx`: full product editor dialog.
- `frontend/components/dashboard/products/product-editor-types.ts`: editor types/interfaces.
- `frontend/components/dashboard/products/product-options-sheet.tsx`: option lists/options editor.
- `frontend/components/dashboard/store/store-edit-form.tsx`: store create/edit form.
- `frontend/components/dashboard/store/business-hours-form.tsx`: business hours form block.
- `frontend/components/dashboard/store/business-hours-selector.tsx`: business hours selector.
- `frontend/components/dashboard/store/hours-edit-dialog.tsx`: business-hours edit dialog.
- `frontend/components/dashboard/store/time-utils.ts`: business-hour time conversion helpers.
- `frontend/components/dashboard/store/timezone-selector.tsx`: timezone selector.
- `frontend/components/dashboard/ai-import/import-review-header.tsx`: import review header/meta.
- `frontend/components/dashboard/ai-import/import-review-action-bar.tsx`: bulk actions and publish controls.
- `frontend/components/dashboard/ai-import/import-review-columns.tsx`: review table columns.
- `frontend/components/dashboard/ai-import/import-review-dialogs.tsx`: review dialogs.
- `frontend/components/dashboard/ai-import/use-import-review-state.ts`: local import review state hook.
- `frontend/components/dashboard/ai-import/utils.ts`: import review helper utilities.
- `frontend/components/dashboard/ai-import/types.ts`: import review TS types.

#### Storefront Components

- `frontend/components/store/menu-browser.tsx`: menu browsing and category navigation UI.
- `frontend/components/store/menu-browser copy.tsx`: backup/alternate copy of menu browser.
- `frontend/components/store/product-dialog.tsx`: product option selection modal.
- `frontend/components/store/product-detail.tsx`: product detail body block.
- `frontend/components/store/cart-button.tsx`: add-to-cart button logic.

#### UI Primitives (`frontend/components/ui/`)

- `avatar.tsx`: avatar primitive.
- `badge.tsx`: badge primitive.
- `breadcrumb.tsx`: breadcrumb primitive.
- `button.tsx`: button primitive.
- `button-group.tsx`: grouped button layout.
- `card.tsx`: card primitive.
- `checkbox.tsx`: checkbox primitive.
- `collapsible.tsx`: collapsible primitive.
- `dialog.tsx`: modal/dialog primitive.
- `dropdown-menu.tsx`: dropdown primitive.
- `input.tsx`: text input primitive.
- `input-group.tsx`: grouped input layout.
- `label.tsx`: label primitive.
- `radio-group.tsx`: radio group primitive.
- `select.tsx`: select primitive.
- `separator.tsx`: separator primitive.
- `sheet.tsx`: slide-over sheet primitive.
- `sidebar.tsx`: sidebar primitive system.
- `skeleton.tsx`: loading skeleton primitive.
- `sonner.tsx`: toast provider wrapper.
- `switch.tsx`: switch primitive.
- `table.tsx`: table primitive.
- `tabs.tsx`: tabs primitive.
- `textarea.tsx`: textarea primitive.
- `tooltip.tsx`: tooltip primitive.

### 5.4 Frontend Data and Utilities

- `frontend/hooks/use-mobile.ts`: mobile breakpoint hook.
- `frontend/hooks/use-menu-scroll-spy.ts`: active category tracking on scroll.
- `frontend/lib/api.ts`: API request wrapper and error handling.
- `frontend/lib/auth-fetch.ts`: token-aware fetch helper.
- `frontend/lib/cart-store.ts`: Zustand cart state and persistence.
- `frontend/lib/form-context.ts`: form context helper utilities.
- `frontend/lib/normalize-response.ts`: case normalization between API/UI payload shapes.
- `frontend/lib/store-context.tsx`: store context provider/hooks.
- `frontend/lib/stripe.ts`: Stripe client loader.
- `frontend/lib/uploads.ts`: upload intent + direct-upload + completion helpers.
- `frontend/lib/utils.ts`: shared utility functions (`cn`, etc.).
- `frontend/lib/supabase/client.ts`: browser Supabase client.
- `frontend/lib/supabase/server.ts`: server Supabase client.
- `frontend/lib/supabase/middleware.ts`: middleware session helper.
- `frontend/queries/stores.ts`: stores query options/hooks.
- `frontend/queries/team.ts`: roles/members/invites queries/hooks.
- `frontend/stores/ui-store.ts`: UI-only Zustand state for dialogs/forms.

## 6. Important End-to-End Flows

### 6.1 Store and Team Permissions

- Auth user is resolved via Supabase JWT in backend deps.
- `StoreContext` combines membership + role/custom role permissions.
- Team UI (`frontend/app/dashboard/[storeId]/team/*`) consumes role/member/invite endpoints.

### 6.2 AI Menu Import

- Frontend upload pages create upload intent and send file to S3.
- Backend persists `UploadAsset` + `MenuImport` and enqueues worker.
- Worker parses menu with Gemini/structured parser and creates import items.
- Dashboard review UI edits/approves import items.
- Publish endpoint creates categories/products/options in normalized tables.

### 6.3 Storefront Ordering and Payments

- Public store pages fetch store/categories/products by slug.
- Cart state is maintained in Zustand.
- Checkout creates orders in backend.
- Payment intent endpoint supports Stripe Connect distribution.

## 7. Notes and Cleanup Candidates

- `frontend/app/dashboard/page.tsx.bak` appears to be backup code.
- `frontend/components/store/menu-browser copy.tsx` appears to be backup/duplicate component.
- `frontend/tsconfig.tsbuildinfo` is generated cache and usually excluded from long-term source docs.

This file is intended to be a stable reference for future implementation planning and onboarding.
