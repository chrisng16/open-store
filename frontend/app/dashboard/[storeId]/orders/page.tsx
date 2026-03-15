"use client";

import { use } from "react";
import { OrdersDashboard } from "./_components/orders-dashboard";

export default function OrdersPage({
    params,
}: {
    params: Promise<{ storeId: string }>;
}) {
    const { storeId } = use(params);

    return <OrdersDashboard storeId={storeId} />;
}
