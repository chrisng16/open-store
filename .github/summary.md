# Open Store Team/Permissions Discovery Summary

## Scope

This summary captures the codebase state before implementing Team role/permission revamp.

## Backend Findings

- Team APIs currently live in `backend/app/api/v1/team.py`.
- Existing endpoints:
  - `GET /stores/{store_id}/members`
  - `GET /stores/{store_id}/invites`
  - `POST /stores/{store_id}/invites`
  - `DELETE /stores/{store_id}/invites/{invite_id}`
  - `POST /team/invites/accept/{token}`
- Role system is fixed enum in `backend/app/models/store.py`:
  - `MemberRole = owner | admin | staff`
  - `StoreMember.role` stores a single enum role.
- Role checks are done via `require_role()` in `backend/app/api/deps.py` with hardcoded hierarchy:
  - `staff: 0`, `admin: 1`, `owner: 2`.
- No custom roles, permission sets, or role CRUD endpoints exist yet.
- No member role update/remove endpoint exists yet.

## Frontend Findings

- Team page is currently a single component:
  - `frontend/app/dashboard/[storeId]/team/page.tsx`
- Team query layer:
  - `frontend/queries/team.ts`
  - supports members and invites fetch + invite create/revoke/accept.
- Reusable UI primitives available:
  - Tabs: `frontend/components/ui/tabs.tsx`
  - Dialog: `frontend/components/ui/dialog.tsx`
- No `alert-dialog` component is present; unsaved prompts should use `Dialog`.

## Architectural Patterns To Reuse

- Backend
  - Pydantic response models in `backend/app/schemas/*`.
  - FastAPI dependency-driven auth/authorization in `backend/app/api/deps.py`.
  - Alembic migration style in `backend/alembic/versions/*`.
- Frontend
  - React Query wrappers in `frontend/queries/*`.
  - Split page into collocated `_components` for complex route UIs.
  - Explicit save/discard UX for security-sensitive edits.

## Implementation Direction

- Introduce store-scoped roles with priority and permission sets.
- Keep predefined roles (`owner`, `admin`, `staff`) and allow custom roles.
- Enforce hierarchy: users may modify only lower-priority members.
- Build Team page tabs: `team members`, `roles`, `invites`.
- Stage edits in member/role tabs and apply only on Save.
- Add unsaved-changes navigation protection.
