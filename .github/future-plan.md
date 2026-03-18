# Open Store Full Audit and Future Plan

Date: 2026-03-15
Scope: backend, frontend, worker pipeline, data flow, security, performance, reliability, delivery workflow

## Executive Summary

This audit found several high-impact logic and security gaps, plus a larger set of architecture and efficiency improvements.

Top risks to address first:

1. Public order data exposure through unauthenticated order detail endpoint.
2. Client-trusted pricing/order amounts that can be tampered with.
3. Non-atomic order number allocation (race condition).
4. Payment intents are not linked to orders, so webhook confirmation cannot reliably transition orders.

High-level maturity gaps:

1. No automated tests in backend or frontend.
2. No CI workflows.
3. Blocking IO inside async paths (S3 boto3 usage) and broad implicit commit behavior.

---

## Critical Findings

### C1. Unauthenticated order detail endpoint exposes order data

Evidence:

- backend/app/api/v1/orders.py:218-233

Problem:

- GET /stores/{store_id}/orders/{order_id} does not require auth or membership checks.
- This can expose customer data (name/email/phone/notes/order contents) to anyone who knows IDs.

Impact:

- Data privacy incident risk.
- Regulatory/compliance exposure.

How to improve:

1. Require store membership with at least staff role (or owner/admin depending policy).
2. If public order tracking is needed, provide a separate tokenized endpoint with scoped fields.
3. Add audit logging for sensitive order reads.

---

### C2. Order creation trusts client-provided prices and product metadata

Evidence:

- backend/app/api/v1/orders.py:87-103
- backend/app/schemas/order.py:14-26

Problem:

- Order subtotal/tax/total are computed from request payload values provided by client (unit_amount, option amounts, product_name).
- The server does not verify these prices against product/option records.

Impact:

- Price tampering / underpayment risk.
- Inconsistent accounting and merchant revenue loss.

How to improve:

1. Replace client amount fields with product_id + option_id + quantity only.
2. Recompute all pricing server-side from Product and Option tables.
3. Store snapshot names for history, but derive prices from DB at order creation time.
4. Reject unknown/inactive products/options and invalid option list combinations.

---

### C3. Payment intent amount is client-controlled and not bound to an order

Evidence:

- backend/app/api/v1/payments.py:85-118
- backend/app/api/v1/payments.py:145-151
- backend/app/models/order.py:34
- backend/app/api/v1/orders.py (no assignment to stripe_payment_intent_id)

Problem:

- /payments/create-intent accepts raw amount from client and returns intent id/secret.
- No required order_id linkage and no persistence of stripe_payment_intent_id on Order.
- Webhook updates order status only by stripe_payment_intent_id lookup, but that value is never set.

Impact:

- Payments and orders can drift out of sync.
- Confirmed payment may not confirm any order.
- Potential underpayment if amount differs from actual basket.

How to improve:

1. Require order_id in create-intent.
2. Recompute server-side order amount and use that for payment intent.
3. Persist payment_intent_id on order when intent is created.
4. Enforce idempotency keys for intent creation.
5. Validate webhook state transitions against order status machine.

---

### C4. Non-atomic order number generation can race under concurrency

Evidence:

- backend/app/api/v1/orders.py:81-85

Problem:

- next order_number uses max(order_number)+1 with no lock and no unique DB guard.

Impact:

- Duplicate order numbers in concurrent traffic.
- Fulfillment/operator confusion and reconciliation issues.

How to improve:

1. Add unique constraint on (store_id, order_number).
2. Replace max+1 with a store-scoped sequence or transactional lock strategy.
3. Add retry-on-conflict logic if optimistic approach is used.

---

## High Priority Findings

### H1. get_db auto-commit on every successful request hides transaction boundaries

Evidence:

- backend/app/database.py:22-29

Problem:

- Dependency commits automatically after any endpoint execution.
- Handlers that expect explicit transaction control can unintentionally commit partial changes.

Impact:

- Harder reasoning about consistency.
- Surprise writes in complex flows.

How to improve:

1. Move transaction ownership into service/endpoint layers using explicit begin/commit.
2. Keep dependency limited to session lifecycle (yield + rollback on exception + close).
3. Add unit tests around rollback behavior for multi-step operations.

---

### H2. Blocking S3 SDK calls inside async methods

Evidence:

- backend/app/services/storage.py:23-96

Problem:

- boto3 is synchronous; called directly in async functions.
- This can block event loop threads under load.

Impact:

- Latency spikes and reduced throughput.

How to improve:

1. Switch to aioboto3/aiobotocore, or run boto3 calls in a threadpool.
2. Add timeouts and retry policy around S3 operations.
3. Emit metrics for upload/download duration and failures.

---

### H3. Public catalog endpoints allow hidden category leakage by default

Evidence:

- backend/app/api/v1/products.py:31-45

Problem:

- list_categories has default status_filter="all" and no auth check.
- Public clients can fetch hidden categories unless they manually pass active filter.

Impact:

- Hidden/internal categories can be exposed.

How to improve:

1. Split public and dashboard endpoints.
2. For public endpoint, hardcode active-only visibility.
3. Require auth for all-states/admin views.

---

### H4. Debug print statements in production code

Evidence:

- backend/app/main.py:20-23
- backend/app/api/v1/stores.py:96
- backend/app/api/v1/payments.py:65

Problem:

- Unstructured print logs and potential sensitive value leakage.

Impact:

- Weak observability and potential information exposure.

How to improve:

1. Replace with structured logging.
2. Redact sensitive payment/auth context.
3. Add correlation/request IDs.

---

### H5. Overly broad CORS method/header allowance

Evidence:

- backend/app/main.py:43-44

Problem:

- allow_methods and allow_headers set to wildcard.

Impact:

- Increases attack surface and weakens security posture.

How to improve:

1. Restrict methods and headers to required set.
2. Separate dev and prod CORS config.

---

### H6. Frontend API client includes dead/incorrect endpoint mapping

Evidence:

- frontend/lib/api.ts:72-73
- backend/app/api/v1/stores.py routes (no /stores/mine/members)

Problem:

- Frontend client exposes listMine -> /stores/mine/members, but backend has no such route.

Impact:

- Runtime failures and maintenance drift.

How to improve:

1. Remove unused/dead endpoints from client.
2. Generate typed client from backend OpenAPI schema to prevent drift.

---

### H7. Large fixed page sizes (500) in frontend list helpers

Evidence:

- frontend/lib/api.ts:78, 89, 104
- backend/app/api/pagination.py:7 (MAX_PAGE_SIZE=500)

Problem:

- Frontend requests max-size pages by default.

Impact:

- Heavy payloads, slow initial loads, unnecessary memory/CPU in browser.

How to improve:

1. Use incremental pagination/infinite query.
2. Keep default page sizes smaller (20-50), fetch more on demand.
3. Add lightweight list projections where possible.

---

## Medium Priority Findings

### M1. Settings cache is cleared at import time in auth deps

Evidence:

- backend/app/api/deps.py:15

Problem:

- get_settings.cache_clear() executes on module import.

Impact:

- Surprising startup behavior and undermined config cache semantics.

How to improve:

1. Remove import-time cache clear.
2. Keep cache clear only in explicit dev tooling/reload paths.

---

### M2. Menu upload route records wrong uploader identity and has duplicate flush

Evidence:

- backend/app/api/v1/menu_imports.py:102
- backend/app/api/v1/menu_imports.py:114
- backend/app/api/v1/menu_imports.py:121-122

Problem:

- upload_menu imports get_current_user but does not use it.
- uploaded_by is set to store owner, not actual actor.
- duplicate await db.flush().

Impact:

- Incorrect audit history and noisier code path.

How to improve:

1. Depend on current user and set uploaded_by=user.id.
2. Remove duplicate flush.
3. Add tests for uploader attribution.

---

### M3. Menu item single-item updates are not state-gated like batch updates

Evidence:

- backend/app/api/v1/menu_imports.py:238-271
- backend/app/api/v1/menu_imports.py:289-292

Problem:

- Batch update enforces review-state, single-item patch does not.

Impact:

- Inconsistent workflow rules and potential state corruption.

How to improve:

1. Align state machine checks across both update endpoints.
2. Centralize import state transition rules.

---

### M4. Validation/scoring logic uses magic multipliers and silently drops nameless items

Evidence:

- backend/app/services/ai/validators.py:31-41

Problem:

- Confidence penalties are hardcoded without documentation.
- Items with empty name are skipped without explicit tracking.

Impact:

- Harder model quality tuning and unexplained ingestion losses.

How to improve:

1. Externalize thresholds/weights to config.
2. Return skipped-items diagnostics and reasons.
3. Log validation summary per import.

---

### M5. Cart id generation uses Math.random

Evidence:

- frontend/lib/cart-store.ts:36-38

Problem:

- Non-robust ID generation in client state.

Impact:

- Rare collisions and unstable behavior in edge cases.

How to improve:

1. Use crypto.randomUUID() where available.
2. Keep deterministic item key for merge logic (product + normalized options).

---

### M6. Response normalization layer adds CPU overhead and can mask contract drift

Evidence:

- frontend/lib/auth-fetch.ts:50-51
- frontend/lib/normalize-response.ts:1-30

Problem:

- Every response is recursively transformed from snake_case to camelCase.

Impact:

- Extra client processing and less visible API schema drift.

How to improve:

1. Standardize contract shape (backend aliasing or frontend native snake_case).
2. Prefer generated types/client from OpenAPI.

---

## Delivery and Quality Gaps

### D1. No backend or frontend tests detected

Evidence:

- file search for backend test files returned none
- file search for frontend test/spec files returned none

How to improve:

1. Backend: pytest + async integration tests for auth, orders, payments, menu import.
2. Frontend: vitest/react-testing-library for query hooks/forms/cart behavior.
3. Add coverage gates for critical modules.

### D2. No CI workflows detected

Evidence:

- no files found in .github/workflows

How to improve:

1. Add PR pipeline: backend lint/type/test, frontend lint/type/test/build.
2. Add migration check and smoke API contract checks.

---

## Prioritized Execution Plan

### Phase 0 (Day 1-2): Stop-the-bleeding fixes

1. Protect GET order detail endpoint with auth and store membership.
2. Lock down order pricing: server-side recompute from product/option tables.
3. Bind payment intent to order and persist payment_intent_id.
4. Add unique (store_id, order_number) and fix allocation strategy.

Deliverables:

- Security patch release.
- Regression tests for C1-C4.

### Phase 1 (Week 1): Reliability and transaction clarity

1. Refactor DB session lifecycle to explicit transaction boundaries.
2. Replace print logs with structured logging and request IDs.
3. Restrict CORS and tighten public/admin endpoint separation.
4. Fix menu upload attribution and duplicate flush.

Deliverables:

- Clear transaction model.
- Better observability baseline.

### Phase 2 (Week 2): Performance and contract hardening

1. Remove max-page list strategy (500 fetches) and move to incremental loading.
2. Clean dead API endpoints and generate typed client from OpenAPI.
3. Migrate blocking S3 code to async-safe pattern.
4. Align menu import state checks across update routes.

Deliverables:

- Reduced frontend payload cost.
- API contract drift prevention.
- Improved concurrency behavior.

### Phase 3 (Week 3+): Quality platform

1. Stand up backend and frontend test suites with required coverage for critical paths.
2. Add CI workflows for lint/test/build/migrations.
3. Formalize AI validator telemetry and confidence policy config.

Deliverables:

- Safer releases.
- Faster refactors.
- Better ingestion quality tuning loop.

---

## Suggested Ownership

Backend/API:

- C1, C2, C3, C4, H1, H3, H4, H5, M1, M2, M3, M4

Frontend:

- H6, H7, M5, M6

Platform/DevEx:

- D1, D2, logging baseline, CI policy

---

## Success Metrics

Security and correctness:

1. 0 unauthenticated access to order resources.
2. 100% server-calculated pricing for charged orders.
3. 100% paid orders linked to payment intents and webhook-confirmed transitions.

Performance:

1. Reduce median dashboard list payload size by at least 60%.
2. Eliminate event-loop blocking S3 operations in request paths.

Quality:

1. CI required on PRs.
2. Coverage target for critical modules (orders/payments/auth/menu import) >= 80%.

---

## Final Note

The current architecture is a strong base with clear domain decomposition, but it needs immediate hardening around order/payment integrity and access control. Addressing the Phase 0 items first will materially reduce business and security risk while enabling safe improvements in later phases.
