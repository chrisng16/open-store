"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchWithAccessToken } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { type Store } from "@/lib/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface StoreActiveToggleProps {
    store: Store | undefined;
}

export function StoreActiveToggle({ store }: StoreActiveToggleProps) {
    const queryClient = useQueryClient();
    const [isUpdating, setIsUpdating] = useState(false);

    const mutation = useMutation({
        mutationFn: async (isActive: boolean) => {
            setIsUpdating(true);
            try {
                return await fetchWithAccessToken(`/stores/${store?.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ is_active: isActive }),
                });
            } finally {
                setIsUpdating(false);
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["store", store?.id] });
            toast.success(store?.isActive ? "Store is now hidden" : "Store is now live!");
        },
        onError: () => {
            toast.error("Failed to update store state");
        }
    });

    if (!store) return null;

    const isActive = store.isActive;

    return (
        <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
                <button
                    onClick={() => mutation.mutate(!isActive)}
                    disabled={isUpdating}
                    className={cn(
                        "relative inline-flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 transition-all duration-300 select-none cursor-pointer",
                        "shadow-sm hover:shadow-md active:scale-95 disabled:opacity-70 disabled:scale-100",
                        isActive 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20" 
                            : "bg-muted/40 border-muted-foreground/20 text-muted-foreground hover:bg-muted/60"
                    )}
                >
                    <div className="relative flex size-2 items-center justify-center">
                        {isActive && !isUpdating && (
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        )}
                        {!isUpdating ? (
                            <div className={cn(
                                "size-2 rounded-full",
                                isActive ? "bg-emerald-500" : "bg-muted-foreground/40"
                            )} />
                        ) : (
                            <Loader2 className="size-2.5 animate-spin" />
                        )}
                    </div>
                    <span className="text-[11px] font-bold tracking-tight">{isActive ? "Public" : "Private"}</span>
                </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-medium px-2.5 py-1.5">
                {isActive ? "Click to take store offline" : "Click to go live"}
            </TooltipContent>
        </Tooltip>
    );
}
