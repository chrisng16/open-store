"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function OrderPoller({ status }: { status: string }) {
    const router = useRouter();
    // Use a local bit to trigger effect re-runs even if status is the same
    const [tick, setTick] = useState(0);

    useEffect(() => {
        // Keep polling as long as the order is in an active (non-terminal) state.
        const isActive = !["completed", "cancelled"].includes(status);
        
        if (isActive) {
            const timer = setTimeout(() => {
                router.refresh();
                setTick(t => t + 1);
            }, 5000); // Poll every 5 seconds (increased from 3 to be safer)

            return () => clearTimeout(timer);
        }
    }, [status, tick, router]);

    return null;
}
