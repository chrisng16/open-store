"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { type Store } from "@/lib/types";
import { useTeamMembersQuery } from "@/queries/team";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, CreditCard, ExternalLink, FileUp, Package, Settings, ShoppingBag, Palette } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { StoreActiveToggle } from "./store-active-toggle";

interface StoreSubNavProps {
    store?: Store;
    pending: boolean;
}

export default function StoreSubNav({ pending, store }: StoreSubNavProps) {
    const membersQuery = useTeamMembersQuery(store?.id);
    const currentUserIdQuery = useQuery({
        queryKey: ["current-user-id"],
        queryFn: async () => {
            const supabase = createClient();
            const { data } = await supabase.auth.getUser();
            return data.user?.id ?? null;
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    const isOwner = useMemo(() => {
        if (!currentUserIdQuery.data || !membersQuery.data) {
            return false;
        }
        const myMember = membersQuery.data.find((member) => member.userId === currentUserIdQuery.data);
        return myMember?.role === "owner";
    }, [currentUserIdQuery.data, membersQuery.data]);

    return (
        <div className="border-b rounded-t-md bg-background-elevated/70 backdrop-blur">
            <div className="flex items-center justify-between px-6 py-3">
                <div className="flex flex-col">
                    {
                        pending ? <Skeleton className="h-4 w-32" /> : <h1 className="text-base font-semibold">{store?.name || "Store"}</h1>
                    }
                    <div className="flex items-center gap-3 mt-0.5">
                        <Link
                            href={`/store/${store?.slug}/`}
                            target="_blank"
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center"
                        >
                            View Store <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                        {!pending && (
                            <>
                                <span className="text-muted-foreground/30 text-xs">|</span>
                                <Link
                                    href={`/dashboard/${store?.id}?tab=appearance`}
                                    className="text-xs text-muted-foreground hover:text-foreground flex items-center"
                                >
                                    <Palette className="mr-1 h-3 w-3" /> Customize
                                </Link>
                                <span className="text-muted-foreground/30 text-xs">|</span>
                                <Link
                                    href={`/dashboard/${store?.id}`}
                                    className="text-xs text-muted-foreground hover:text-foreground flex items-center"
                                >
                                    <Settings className="mr-1 h-3 w-3" /> Settings
                                </Link>
                            </>
                        )}
                    </div>
                </div>
                {/* Store Active Toggle (Owner only) */}
                {!pending && isOwner && (
                    <StoreActiveToggle store={store} />
                )}
            </div>
        </div>
    )
}
