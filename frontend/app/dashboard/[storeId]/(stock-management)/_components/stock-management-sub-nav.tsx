"use client"

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useStoreCapabilities } from "@/hooks/use-store-capabilities";
import { useCategoryDialogActions, useProductDialogActions } from "@/stores/ui-store";
import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

type StatusFilterValue = "all" | "active" | "hidden";

const STATUS_OPTIONS: Array<{ value: StatusFilterValue; label: string }> = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "hidden", label: "Hidden" },
];

function resolveStatusFilter(rawStatus: string | null): StatusFilterValue {
    if (rawStatus === "all" || rawStatus === "active" || rawStatus === "hidden") {
        return rawStatus;
    }

    return "all";
}

export default function StockManagementSubNav() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const directory = pathname.split("/")[3];
    const storeId = pathname.split("/")[2];
    const { openCategoryCreate } = useCategoryDialogActions();
    const { openProductCreate } = useProductDialogActions();
    const capabilities = useStoreCapabilities(storeId);

    const statusFromUrl = resolveStatusFilter(searchParams.get("status"));
    const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(statusFromUrl);

    useEffect(() => {
        setStatusFilter((current) => (current === statusFromUrl ? current : statusFromUrl));
    }, [statusFromUrl]);

    function handleStatusFilterChange(value: StatusFilterValue) {
        // Local-first update keeps tab/selector feedback immediate.
        setStatusFilter(value);

        const params = new URLSearchParams(searchParams.toString());
        if (value === "all") {
            params.delete("status");
        } else {
            params.set("status", value);
        }

        // Changing status scope should always bring users back to the first page.
        params.delete("page");

        const nextQuery = params.toString();
        startTransition(() => {
            router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
        });
    }

    return (
        <div className="border-b rounded-t-md bg-background-elevated/70 backdrop-blur">
            <div className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-4">
                    <>
                        <h1 className="font-semibold"> Manage {directory === 'categories' ? 'Categories' : 'Products'}</h1>
                        <p className="text-xs text-muted-foreground sr-only">Create and manage product {directory === 'categories' ? 'categories' : 'listings'}</p>
                    </>
                    <>
                        <div className="hidden xl:block">
                            <Tabs
                                value={statusFilter}
                                onValueChange={(value) => handleStatusFilterChange(value as StatusFilterValue)}
                            >
                                <TabsList className="bg-background">
                                    {STATUS_OPTIONS.map((option) => (
                                        <TabsTrigger key={option.value} value={option.value} className="h-8 px-2 text-xs">
                                            {option.label}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        </div>

                        <div className="xl:hidden">
                            <Select
                                value={statusFilter}
                                onValueChange={(value) => handleStatusFilterChange(value as StatusFilterValue)}
                            >
                                <SelectTrigger className="h-8 w-30">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end" position="popper">
                                    {STATUS_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </>
                </div>
                <div className="flex items-center gap-2">
                    {
                        directory === 'products' && (
                            <Button variant="outline" size={"sm"} asChild>
                                <Link href={`${pathname.split("/").slice(0, -1).join("/")}/ai-import`}>
                                    <Sparkles />
                                    Import
                                </Link>
                            </Button>
                        )
                    }
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button
                                    size={"sm"}
                                    disabled={
                                        directory === "categories"
                                            ? !capabilities.canManageCategories
                                            : !capabilities.canManageProducts
                                    }
                                    onClick={directory === "categories" ? openCategoryCreate : openProductCreate}
                                >
                                    <Plus />
                                    {directory === "categories" ? "Category" : "Product"}
                                </Button>
                            </span>
                        </TooltipTrigger>
                        {(directory === "categories" && !capabilities.canManageCategories) ||
                            (directory === "products" && !capabilities.canManageProducts) ? (
                            <TooltipContent>
                                You do not have permission to create {directory === "categories" ? "categories" : "products"}.
                            </TooltipContent>
                        ) : null}
                    </Tooltip>
                </div>
            </div>
        </div>
    )
}
