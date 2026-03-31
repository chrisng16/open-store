"use client";

import { cn } from "@/lib/utils";
import { Check, Clock, Package, Utensils, Flag, LucideIcon } from "lucide-react";

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";

const STEPS: { status: OrderStatus; label: string; icon: LucideIcon }[] = [
    { status: "confirmed", label: "Confirmed", icon: Check },
    { status: "preparing", label: "Preparing", icon: Utensils },
    { status: "ready", label: "Ready", icon: Package },
    { status: "completed", label: "Picked up", icon: Flag },
];

export function OrderTracker({ currentStatus }: { currentStatus: string }) {
    if (currentStatus === "cancelled") {
        return (
            <div className="mb-8 rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <Clock className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-destructive">Order Cancelled</h3>
                <p className="mt-1 text-sm text-destructive/80">
                    This order has been cancelled and will not be fulfilled.
                </p>
            </div>
        );
    }

    // Map internal status to step index
    const statusToIndex: Record<string, number> = {
        pending: -1,
        confirmed: 0,
        preparing: 1,
        ready: 2,
        completed: 3,
    };

    const currentIndex = statusToIndex[currentStatus] ?? -1;

    return (
        <div className="mb-8 rounded-[2rem] border border-border/70 bg-card p-8 shadow-sm">
            <div className="relative flex justify-between">
                {/* Progress Line */}
                <div className="absolute top-5 left-0 h-0.5 w-full bg-muted" aria-hidden="true" />
                <div 
                    className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500 ease-in-out" 
                    style={{ width: `${Math.max(0, (currentIndex / (STEPS.length - 1)) * 100)}%` }}
                    aria-hidden="true"
                />

                {/* Steps */}
                {STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isCompleted = index <= currentIndex;
                    const isCurrent = index === currentIndex;

                    return (
                        <div key={step.status} className="relative flex flex-col items-center text-center">
                            <div
                                className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors duration-300 bg-card z-10",
                                    isCompleted ? "border-primary bg-primary text-primary-foreground" : "border-muted bg-card text-muted-foreground",
                                    isCurrent && "ring-4 ring-primary/20"
                                )}
                            >
                                <Icon className="h-5 w-5" />
                            </div>
                            <span className={cn(
                                "mt-3 text-xs font-semibold uppercase tracking-wider",
                                isCompleted ? "text-primary" : "text-muted-foreground",
                                isCurrent && "font-bold"
                            )}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
