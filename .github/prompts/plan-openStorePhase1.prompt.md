# Phase 1 — Multi-Tenant Food Ordering Platform with AI Menu Ingestion

**TL;DR**: Build a complete food ordering platform from scratch. Store owners onboard via `/dashboard`, upload menus (PDF/image/spreadsheet) that AI (Gemini 3 Flash) auto-parses into structured catalogs with human review. Customers browse stores at `/store/{slug}/menu`, search items, add to cart, and checkout via Stripe Connect (Express, destination charges). The backend is FastAPI with SQLAlchemy 2.0 async + Supabase PostgreSQL. Auth flows through Supabase on the frontend, with JWTs verified by FastAPI via JWKS. Monorepo root orchestrates both services with Docker Compose for local dev.

**Steps**

## 0. Monorepo & Dev Environment

1. Add root-level `package.json` (scripts: `dev`, `build`, `lint`), `docker-compose.yml` (FastAPI + local Supabase or Postgres + Redis), `.env.example` with all required env vars (Supabase URL/keys, Stripe keys, Gemini API key, AWS S3 bucket, etc.)
2. In `backend/`, scaffold a Python project with `pyproject.toml` (Poetry or uv) — dependencies: `fastapi`, `uvicorn`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `pyjwt[crypto]`, `httpx`, `python-multipart`, `boto3`, `stripe`, `google-genai`, `pgvector`, `pydantic>=2`, `arq`, `redis`
3. In `frontend/`, run `pnpm dlx shadcn@latest init` to scaffold shadcn/ui with Tailwind v4. Add dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `@stripe/stripe-js`, `@stripe/react-stripe-js`, `zustand` (lightweight state for cart), `zod`
4. Add a root `Dockerfile` for backend (Python 3.12+), a `Dockerfile` for frontend (Node 22 + pnpm), and configure `docker-compose.yml` with services: `api`, `web`, `db` (Postgres 16 + pgvector), `redis`

## 1. Database Schema & Migrations

Create Alembic migrations for the following tables (all tables include `created_at`, `updated_at`; UUIDs as primary keys):

- **`stores`** — `id`, `owner_id` (FK→Supabase auth.users), `name`, `slug` (unique), `description`, `logo_url`, `banner_url`, `theme_config` (JSONB — colors, fonts), `stripe_account_id`, `stripe_onboarding_complete` (bool), `is_active`, `address`, `phone`, `timezone`
- **`store_members`** — `id`, `store_id` (FK), `user_id`, `role` (enum: owner/admin/staff), unique constraint on (store_id, user_id)
- **`categories`** — `id`, `store_id` (FK), `name`, `description`, `sort_order`, `is_active`
- **`products`** — `id`, `store_id` (FK), `category_id` (FK), `name`, `description`, `base_price` (numeric), `image_url`, `is_active`, `sort_order`, `dietary_tags` (JSONB array — vegan, gluten-free, etc.), `allergens` (JSONB array), `ingredients` (text, optional), `embedding` (vector(768) for semantic search — Phase 2)
- **`modifier_groups`** — `id`, `product_id` (FK), `name` (e.g. "Size", "Toppings"), `min_selections`, `max_selections`, `is_required`
- **`modifiers`** — `id`, `modifier_group_id` (FK), `name`, `price_adjustment` (numeric), `is_default`, `sort_order`
- **`orders`** — `id`, `store_id` (FK), `customer_id` (nullable — guest checkout possible), `status` (enum: pending/confirmed/preparing/ready/completed/cancelled), `subtotal`, `tax`, `total`, `stripe_payment_intent_id`, `customer_name`, `customer_email`, `customer_phone`, `notes`, `order_number` (per-store sequential)
- **`order_items`** — `id`, `order_id` (FK), `product_id` (FK), `product_name` (snapshot), `quantity`, `unit_price`, `total_price`
- **`order_item_modifiers`** — `id`, `order_item_id` (FK), `modifier_id` (FK), `modifier_name` (snapshot), `price_adjustment`
- **`menu_imports`** — `id`, `store_id` (FK), `uploaded_by` (FK), `file_url` (S3 path), `file_type` (enum: pdf/image/csv/xlsx), `status` (enum: uploading/processing/review/published/failed), `raw_extraction` (JSONB — Gemini raw output), `parsed_data` (JSONB — validated structured menu), `confidence_scores` (JSONB — per-field confidence), `error_log` (text), `published_at`
- **`menu_import_items`** — `id`, `menu_import_id` (FK), `category_name`, `item_name`, `description`, `price`, `modifiers` (JSONB), `dietary_tags` (JSONB), `allergens` (JSONB), `confidence` (float 0-1), `status` (enum: pending/approved/edited/rejected), `linked_product_id` (nullable FK→products — set when published)
- **`audit_logs`** — `id`, `store_id`, `user_id`, `action` (string), `entity_type`, `entity_id`, `old_data` (JSONB), `new_data` (JSONB)

Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`

## 2. Backend — FastAPI Core

Structure `backend/` as:

```
backend/
  app/
    main.py                    # FastAPI app, CORS, lifespan, routers
    config.py                  # Pydantic Settings (env vars)
    database.py                # Async engine, sessionmaker, get_db dependency
    models/                    # SQLAlchemy 2.0 mapped classes
      base.py                  # DeclarativeBase, common mixins (timestamps, UUID pk)
      store.py, product.py, order.py, menu_import.py, audit.py
    schemas/                   # Pydantic v2 request/response schemas
      store.py, product.py, order.py, menu_import.py
    api/
      deps.py                  # get_current_user (JWT verify), get_current_store, require_role
      v1/
        stores.py              # CRUD stores, onboarding
        products.py            # CRUD categories, products, modifiers
        orders.py              # Create order, update status, list
        menu_imports.py        # Upload, trigger AI, review queue, publish
        payments.py            # Stripe Connect onboarding, webhook
        health.py
    services/
      ai/
        menu_parser.py         # Gemini integration: upload → structured extraction
        schema.py              # Pydantic models for AI output (MenuExtractionResult)
        prompts.py             # System prompts for menu parsing
        validators.py          # Post-AI validation (prices numeric, required fields)
      storage.py               # S3 upload/download/presigned URLs
      stripe_service.py        # Stripe Connect account management, payment intents
    workers/
      menu_ingestion.py        # ARQ task: orchestrates the full ingestion pipeline
    middleware/
      tenant.py                # Optional: extract tenant from request headers
  alembic/
    env.py, versions/
  alembic.ini
  pyproject.toml
  Dockerfile
```

### Key API endpoints (all prefixed `/api/v1`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/stores` | User | Create a new store (user becomes owner) |
| GET | `/stores/{slug}` | Public | Get store public profile by slug |
| PATCH | `/stores/{store_id}` | Owner | Update store settings/branding |
| POST | `/stores/{store_id}/stripe/onboard` | Owner | Create Stripe Connect account + return onboarding URL |
| GET | `/stores/{store_id}/stripe/status` | Owner | Check Stripe onboarding status |
| GET | `/stores/{store_id}/categories` | Public | List categories for a store |
| POST | `/stores/{store_id}/categories` | Staff+ | Create category |
| GET | `/stores/{store_id}/products` | Public | List products (with modifiers) |
| POST | `/stores/{store_id}/products` | Staff+ | Create product |
| PATCH | `/stores/{store_id}/products/{id}` | Staff+ | Update product |
| POST | `/stores/{store_id}/menu-imports/upload` | Staff+ | Upload menu file → S3, create `menu_imports` record |
| POST | `/stores/{store_id}/menu-imports/{id}/process` | Staff+ | Trigger AI ingestion (kicks off background job) |
| GET | `/stores/{store_id}/menu-imports/{id}` | Staff+ | Get import status + parsed items (review queue) |
| PATCH | `/stores/{store_id}/menu-imports/{id}/items/{item_id}` | Staff+ | Edit a parsed item before publishing |
| POST | `/stores/{store_id}/menu-imports/{id}/publish` | Owner | Publish approved items → create real products |
| POST | `/stores/{store_id}/orders` | Public | Create order (cart → order) |
| GET | `/stores/{store_id}/orders` | Staff+ | List orders (dashboard) |
| PATCH | `/stores/{store_id}/orders/{id}/status` | Staff+ | Update order status |
| POST | `/payments/create-intent` | Public | Create Stripe PaymentIntent (destination charge) |
| POST | `/webhooks/stripe` | Stripe | Handle payment confirmations |

### Auth flow in `deps.py`:

- `get_current_user()`: Extract `Authorization: Bearer <token>`, decode JWT using Supabase JWKS (cache public keys with TTL), return user dict with `sub`, `email`
- `get_current_store(store_id, user)`: Verify user has a role in `store_members` for this store, return store + role
- `require_role(min_role)`: Dependency that checks `role >= min_role`

## 3. AI Menu Ingestion Pipeline

This is the flagship feature. The flow:

1. **Upload** — Dashboard user uploads file (PDF, image, CSV, XLSX) → frontend sends to `/menu-imports/upload` → backend streams to S3, creates `menu_imports` record with `status=uploading→processing`
2. **Background Job** — ARQ worker picks up the job:
   - If CSV/XLSX: parse with `openpyxl`/`csv` module → structured data directly
   - If PDF/image: upload to Gemini File API (for files >20MB) or send inline
   - Call Gemini 3 Flash with a carefully crafted system prompt + the file
   - **Structured output mode**: Pass a Pydantic schema as `response_json_schema` — categories, items, prices, descriptions, modifiers, dietary tags, allergens
   - Gemini returns structured JSON conforming to the schema
3. **Validation** — Run post-extraction validators in `validators.py`:
   - Prices must be positive numbers
   - Item names non-empty, deduplication check
   - Modifier groups have valid min/max selections
   - Dietary tags from allowed enum
   - Assign confidence scores: price extracted cleanly → high confidence; inferred dietary tag → low confidence
4. **Store results** — Write to `menu_import_items` with per-field confidence scores. Update `menu_imports.status = 'review'`
5. **Review Queue (Dashboard)** — UI shows a diff-style view of extracted items:
   - Items sorted by confidence (low-confidence first for human attention)
   - Editable fields: name, description, price, category, modifiers, tags
   - Color coding: green (high confidence), yellow (medium), red (low/missing)
   - Approve/edit/reject per item
6. **Publish** — Owner clicks "Publish All Approved" → backend creates `categories`+`products`+`modifier_groups`+`modifiers` records, sets `linked_product_id` on import items, writes audit log

### Gemini prompt design (in `prompts.py`):

- System prompt: "You are a menu data extraction specialist. Extract ALL items from this menu document into the provided JSON schema. For each item, include the category it belongs to, full name, description, base price, any size/flavor/add-on modifiers with price adjustments, dietary tags (vegan, vegetarian, gluten-free, dairy-free, nut-free, halal, kosher), and allergens. If information is uncertain, include it but set confidence lower."
- Use `generation_config` with `response_mime_type="application/json"` and pass the Pydantic schema

### Error handling:

If Gemini fails, retry up to 3 times with exponential backoff (ARQ handles this). If all retries fail, set `status=failed` with error log. Notify user via dashboard.

## 4. Frontend — App Router Structure

```
frontend/
  app/
    layout.tsx                              # Root layout: fonts, Supabase provider
    page.tsx                                # Landing page (marketing)
    proxy.ts                                # Tenant validation, auth gating for /dashboard
    (auth)/
      login/page.tsx                        # Supabase Auth UI (email/password + social)
      signup/page.tsx
      callback/route.ts                     # OAuth callback handler
    store/
      [slug]/
        layout.tsx                          # Fetch store branding, provide StoreContext
        page.tsx                            # Redirect to /menu
        menu/
          page.tsx                          # Menu listing with categories + items
        item/
          [id]/
            page.tsx                        # Item detail with modifier selection
        cart/
          page.tsx                          # Cart review
        checkout/
          page.tsx                          # Stripe Elements payment form
        order/
          [orderId]/
            page.tsx                        # Order confirmation + status tracking
    dashboard/
      layout.tsx                            # Auth guard, fetch user's store(s), sidebar nav
      page.tsx                              # Overview / redirect to first store
      store/
        new/
          page.tsx                          # Create new store
      [storeId]/
        layout.tsx                          # Store-specific dashboard layout
        page.tsx                            # Dashboard home (orders summary)
        menu/
          page.tsx                          # Menu editor (categories + products CRUD)
        orders/
          page.tsx                          # Order management
        ai-import/
          page.tsx                          # Upload menu file
          [importId]/
            page.tsx                        # Review queue for a specific import
        settings/
          page.tsx                          # Store settings, branding, Stripe onboarding
  components/
    ui/                                      # shadcn/ui components
    store/                                   # Store-facing components (MenuCard, CartDrawer, etc.)
    dashboard/                               # Dashboard components (DataTable, ImportReviewTable, etc.)
  lib/
    supabase/
      client.ts                              # createBrowserClient
      server.ts                              # createServerClient (for RSC)
      middleware.ts                           # For proxy.ts
    api.ts                                   # Typed fetch wrapper for FastAPI endpoints
    store-context.tsx                         # React context for store branding/config
    cart-store.ts                             # Zustand store for cart state (persisted to localStorage)
    utils.ts
    stripe.ts                                # Stripe client setup
```

### Key frontend patterns:

- **Server Components by default** — menu pages, store layout fetch data server-side via FastAPI
- **Client Components only where needed** — cart interactions, modifier selection, file upload, Stripe Elements
- **`proxy.ts`** — validate store slugs exist (lightweight check or cache), gate `/dashboard/*` routes behind auth
- **`[slug]/layout.tsx`** — RSC that fetches store branding (name, logo, colors) from FastAPI and injects into a `<StoreProvider>` context. Apply tenant theme via CSS custom properties on the root element
- **Cart** — Zustand store with `localStorage` persistence, namespaced by store slug (so carts from different stores don't collide)

## 5. Auth Flow

1. **Signup/Login**: Supabase Auth UI components on `/login` and `/signup`. Support email/password + Google OAuth
2. **Session**: `@supabase/ssr` manages cookies. `proxy.ts` reads the cookie to check auth for `/dashboard/*` routes
3. **API calls**: Frontend includes the Supabase access token in `Authorization: Bearer <token>` header on every FastAPI call
4. **FastAPI verification**: `get_current_user()` dependency fetches JWKS from Supabase (cached 10 min), verifies JWT signature + expiry, extracts `sub` (user_id) and `email`
5. **Store ownership**: After JWT verification, check `store_members` table for the user's role in the requested store

## 6. Stripe Connect Integration

1. **Onboarding**: Store owner clicks "Connect Stripe" in dashboard → API creates a Stripe Express connected account → returns Stripe-hosted onboarding URL → owner completes KYC → Stripe redirects back → webhook updates `stripe_onboarding_complete`
2. **Checkout**: Customer submits cart → frontend calls `/payments/create-intent` with store_id + amount → backend creates `PaymentIntent` with `transfer_data[destination]=store.stripe_account_id` and `application_fee_amount` (platform fee) → returns `client_secret` → frontend confirms with Stripe Elements
3. **Webhook**: Stripe sends `payment_intent.succeeded` → backend updates order status to `confirmed`, triggers notification
4. **Refunds**: Dashboard action → API creates refund on the PaymentIntent, Stripe reverses the transfer

## 7. Customer-Facing Storefront

- **Menu page** (`/store/{slug}/menu`): Server-rendered. Fetch categories + products from API. Display as category tabs or scrollable sections. Each item card shows name, description, price, dietary tags (icons), image
- **Item detail** (`/store/{slug}/item/{id}`): Modifier group selection (radio for single-select, checkboxes for multi-select). Price recalculates dynamically. "Add to Cart" button
- **Cart** (`/store/{slug}/cart`): List items with modifiers, quantities, subtotal. Edit/remove. Proceed to checkout
- **Checkout** (`/store/{slug}/checkout`): Contact info form + Stripe Elements card input. Create order + payment intent simultaneously. Show order confirmation on success

## 8. Dashboard

- **Overview**: Today's orders count, revenue, pending orders
- **Menu Editor**: Drag-and-drop categories/products (using `@hello-pangea/dnd` or similar). Inline editing. Add/remove modifiers
- **AI Import**:
  - File upload dropzone (accept PDF, PNG, JPG, CSV, XLSX)
  - Upload progress indicator
  - Processing status (polling or SSE)
  - Review queue: table with columns (Category, Item Name, Description, Price, Modifiers, Tags, Confidence, Actions). Low-confidence fields highlighted. Inline edit. Approve/reject checkboxes
  - Diff view: if importing into existing catalog, show what's new vs. modified
  - Publish button with confirmation dialog
- **Orders**: Real-time order list (polling). Status updates via dropdown (confirmed → preparing → ready → completed). Order detail drawer
- **Settings**: Store name/slug, logo upload, branding colors, Stripe Connect status, contact info

## 9. File Storage (S3)

- Menu file uploads (PDF/images/spreadsheets) → S3 bucket with prefix `{store_id}/imports/`
- Product images → S3 with prefix `{store_id}/products/`
- Generate presigned URLs for uploads (frontend → presigned → direct S3 upload) and downloads
- Configure CORS on the S3 bucket for direct browser uploads

## 10. Deployment

### AWS (primary):

- Frontend: Deploy to **AWS Amplify** (supports Next.js 16 SSR) or containerize and run on **ECS Fargate**
- Backend: **ECS Fargate** with an ALB, or **AWS App Runner** for simpler setup
- Database: Supabase managed PostgreSQL (external)
- Redis: **ElastiCache**
- S3: Direct
- Domain: Route53 + CloudFront (CDN for storefront assets)

### Alternative deployments:

- **Vercel** (Next.js): Deploy `frontend/` with `vercel.json` specifying root directory. Set env vars for Supabase + API URL. Configure rewrites to proxy `/api/*` to FastAPI if needed, or keep API on separate domain
- **Railway** (FastAPI): Deploy `backend/` with a `railway.toml` or Dockerfile. Railway auto-detects Python. Set env vars. Railway provides a public URL for the API
- **Render** (FastAPI): Similar — deploy with `render.yaml` blueprint or Dockerfile. Free tier available for dev

## Verification

1. **Local dev**: `docker compose up` starts all services. Visit `http://localhost:3000` (frontend), `http://localhost:8000/docs` (FastAPI Swagger)
2. **Auth**: Sign up → create store → verify JWT flow works end-to-end (Supabase → FastAPI)
3. **AI Ingestion**: Upload a sample restaurant menu PDF → verify Gemini extracts items → review queue shows parsed data → publish creates products in DB
4. **Storefront**: Visit `/store/{slug}/menu` → items display → add to cart → checkout (test mode Stripe)
5. **Stripe**: Complete Express onboarding in test mode → place order → verify PaymentIntent created with destination charge → webhook updates order
6. **Multi-tenant isolation**: Create 2 stores → verify products/orders don't leak between stores. Test API with wrong store_id → should get 403

## Decisions

- **Path routing `/store/{slug}/*`** over subdomains — avoids CloudFront/Vercel SSL limitations
- **`proxy.ts`** (not `middleware.ts`) — Next.js 16 renamed middleware
- **Stripe Express + Destination charges** — right balance of control vs. simplicity for food ordering
- **ARQ** for background jobs over FastAPI BackgroundTasks — menu ingestion needs retries, timeout handling, and job status tracking
- **Gemini 3 Flash** (`gemini-3-flash-preview`) — best cost/performance for structured extraction; fallback to 2.5 Flash if preview is unstable
- **Zustand** for cart state — minimal, no boilerplate, localStorage persistence built-in
- **`await params`** required in Next.js 16 — all dynamic route pages must await the params promise
- **Phase 2 hooks**: `products.embedding` column (vector(768)) is in the schema but unused in Phase 1 — ready for semantic search. `audit_logs` table ready for analytics queries
