from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.menu_import import ImportStatus, MenuImport
from app.models.product import Product
from app.models.store import Store
from app.schemas.store import OnboardingStepStatus, StoreOnboardingStatusResponse


async def get_store_onboarding_status(
    db: AsyncSession,
    store: Store,
) -> StoreOnboardingStatusResponse:
    active_product_count_result = await db.execute(
        select(func.count(Product.id)).where(
            Product.store_id == store.id,
            Product.is_active == True,
        )
    )
    active_product_count = int(active_product_count_result.scalar() or 0)

    published_import_result = await db.execute(
        select(func.count(MenuImport.id)).where(
            MenuImport.store_id == store.id,
            MenuImport.status == ImportStatus.published,
        )
    )
    has_published_import = int(published_import_result.scalar() or 0) > 0

    details_complete = True
    stripe_complete = bool(store.stripe_onboarding_complete)
    menu_complete = active_product_count > 0 or has_published_import

    steps = [
        OnboardingStepStatus(
            id="store_details",
            title="Store details",
            completed=details_complete,
            required=False,
            blocking_reasons=[],
        ),
        OnboardingStepStatus(
            id="stripe_connect",
            title="Stripe Connect",
            completed=stripe_complete,
            blocking_reasons=[] if stripe_complete else ["Complete Stripe Connect onboarding."],
        ),
        OnboardingStepStatus(
            id="menu_setup",
            title="Menu setup",
            completed=menu_complete,
            blocking_reasons=[]
            if menu_complete
            else ["Publish at least one product using import or manual entry."],
        ),
    ]

    required_steps = [step for step in steps if step.required]
    completed_required_steps = sum(1 for step in required_steps if step.completed)
    onboarding_complete = completed_required_steps == len(required_steps)
    next_step = next((step.id for step in required_steps if not step.completed), None)

    return StoreOnboardingStatusResponse(
        store_id=store.id,
        onboarding_complete=onboarding_complete,
        can_go_live=onboarding_complete,
        is_active=store.is_active,
        completed_required_steps=completed_required_steps,
        total_required_steps=len(required_steps),
        next_step_id=next_step,
        active_product_count=active_product_count,
        has_published_import=has_published_import,
        steps=steps,
    )


async def refresh_store_activation_from_onboarding(
    db: AsyncSession,
    store: Store,
) -> StoreOnboardingStatusResponse:
    status = await get_store_onboarding_status(db=db, store=store)
    if status.can_go_live and not store.is_active:
        store.is_active = True
        await db.flush()
        status.is_active = True
    return status
