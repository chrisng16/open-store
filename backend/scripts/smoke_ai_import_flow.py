import asyncio
import uuid
from sqlalchemy import select

from app.database import async_session_factory
from app.models.store import Store, MemberRole
from app.models.menu_import import MenuImport, MenuImportItem, ImportStatus, ImportItemStatus, FileType
from app.schemas.menu_import import MenuImportItemUpdate
from app.api.deps import StoreContext
from app.api.v1.menu_imports import update_import_item, publish_menu_import
from app.models.product import Product, ModifierGroup, Modifier


async def main() -> None:
    async with async_session_factory() as db:
        store = (await db.execute(select(Store).order_by(Store.created_at.asc()))).scalars().first()
        if not store:
            raise RuntimeError("No store found in DB to run smoke test")

        run_id = uuid.uuid4().hex[:8]
        test_name_ok = f"Smoke Approved {run_id}"
        test_name_pending = f"Smoke Pending {run_id}"

        menu_import = MenuImport(
            store_id=store.id,
            uploaded_by=store.owner_id,
            file_url=f"https://example.com/{run_id}.pdf",
            file_type=FileType.pdf,
            status=ImportStatus.review,
        )
        db.add(menu_import)
        await db.flush()

        approved_item = MenuImportItem(
            menu_import_id=menu_import.id,
            category_name="Smoke",
            item_name=test_name_ok,
            description="approved item",
            price=10.5,
            modifiers={
                "groups": [
                    {
                        "group_name": "Size",
                        "min_selections": 1,
                        "max_selections": 1,
                        "is_required": True,
                        "sort_order": 0,
                        "options": [
                            {"name": "Regular", "price_adjustment": 0, "is_default": True, "sort_order": 0},
                            {"name": "Large", "price_adjustment": 2.0, "is_default": False, "sort_order": 1},
                        ],
                    }
                ]
            },
            confidence=0.95,
            status=ImportItemStatus.approved,
        )
        pending_item = MenuImportItem(
            menu_import_id=menu_import.id,
            category_name="Smoke",
            item_name=test_name_pending,
            description="pending item",
            price=7.0,
            confidence=0.8,
            status=ImportItemStatus.pending,
        )
        db.add_all([approved_item, pending_item])
        await db.flush()

        ctx = StoreContext(store=store, role=MemberRole.owner)

        await update_import_item(
            import_id=menu_import.id,
            item_id=pending_item.id,
            data=MenuImportItemUpdate(
                item_name=f"{test_name_pending} Edited",
                price=7.0,
            ),
            ctx=ctx,
            db=db,
        )
        await db.refresh(pending_item)
        assert pending_item.status == ImportItemStatus.edited, f"Expected edited, got {pending_item.status}"

        await update_import_item(
            import_id=menu_import.id,
            item_id=pending_item.id,
            data=MenuImportItemUpdate(
                item_name=f"{test_name_pending} Edited",
                price=7.0,
                status=ImportItemStatus.rejected,
            ),
            ctx=ctx,
            db=db,
        )
        await db.refresh(pending_item)
        assert pending_item.status == ImportItemStatus.rejected, f"Expected rejected, got {pending_item.status}"

        await publish_menu_import(import_id=menu_import.id, ctx=ctx, db=db)

        created_products = (
            await db.execute(
                select(Product).where(
                    Product.store_id == store.id,
                    Product.name.in_([test_name_ok, f"{test_name_pending} Edited"]),
                )
            )
        ).scalars().all()

        created_names = {p.name for p in created_products}
        assert test_name_ok in created_names, "Approved item was not published"
        assert f"{test_name_pending} Edited" not in created_names, "Rejected/edited item should not be published"

        approved_product = next(p for p in created_products if p.name == test_name_ok)
        groups = (
            await db.execute(select(ModifierGroup).where(ModifierGroup.product_id == approved_product.id))
        ).scalars().all()
        assert len(groups) == 1, f"Expected 1 modifier group, got {len(groups)}"
        assert groups[0].name == "Size"
        assert groups[0].min_selections == 1
        assert groups[0].max_selections == 1
        assert groups[0].is_required is True

        options = (
            await db.execute(
                select(Modifier)
                .where(Modifier.modifier_group_id == groups[0].id)
                .order_by(Modifier.sort_order.asc())
            )
        ).scalars().all()
        assert [o.name for o in options] == ["Regular", "Large"], "Modifier option names mismatch"
        assert options[0].is_default is True

        await db.rollback()
        print("SMOKE PASS: update semantics, approved-only publish, and modifier persistence verified")


if __name__ == "__main__":
    asyncio.run(main())
