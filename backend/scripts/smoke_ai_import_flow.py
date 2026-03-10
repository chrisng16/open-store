import asyncio
import uuid
from sqlalchemy import select

from app.database import async_session_factory
from app.models.store import Store, MemberRole
from app.models.menu_import import MenuImport, MenuImportItem, ImportStatus, ImportItemStatus, FileType
from app.schemas.menu_import import MenuImportItemUpdate
from app.api.deps import StoreContext
from app.api.v1.menu_imports import update_import_item, publish_menu_import
from app.models.product import Product, OptionList, Option


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
            unit_amount=1050,
            option_lists={
                "optionLists": [
                    {
                        "name": "Size",
                        "selectionNode": "single_select",
                        "minNumOptions": 1,
                        "maxNumOptions": 1,
                        "isOptional": False,
                        "sortOrder": 0,
                        "options": [
                            {"name": "Regular", "unitAmount": 0, "isDefault": True, "sortOrder": 0},
                            {"name": "Large", "unitAmount": 200, "isDefault": False, "sortOrder": 1},
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
            unit_amount=700,
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
                unit_amount=700,
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
                unit_amount=700,
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
        lists = (
            await db.execute(select(OptionList).where(OptionList.product_id == approved_product.id))
        ).scalars().all()
        assert len(lists) == 1, f"Expected 1 option list, got {len(lists)}"
        assert lists[0].name == "Size"
        assert lists[0].min_num_options == 1
        assert lists[0].max_num_options == 1
        assert lists[0].is_optional is False

        options = (
            await db.execute(
                select(Option)
                .where(Option.option_list_id == lists[0].id)
                .order_by(Option.sort_order.asc())
            )
        ).scalars().all()
        assert [o.name for o in options] == ["Regular", "Large"], "Option names mismatch"
        assert options[0].is_default is True

        await db.rollback()
        print("SMOKE PASS: update semantics, approved-only publish, and option list persistence verified")


if __name__ == "__main__":
    asyncio.run(main())
