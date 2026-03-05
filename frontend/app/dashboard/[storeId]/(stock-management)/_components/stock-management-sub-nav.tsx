"use client"

import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function StockManagementSubNav() {
    const pathname = usePathname();
    const directory = pathname.split("/")[3];
    const { openCategoryCreate, openProductCreate } = useUIStore();

    return (
        <div className="border-b rounded-t-md bg-background-elevated/70 backdrop-blur">
            <div className="flex items-center justify-between px-6 py-3">
                <div className="">
                    <h1 className="font-semibold text-xl"> Manage {directory === 'categories' ? 'Categories' : 'Products'}</h1>
                    <p className="text-sm text-muted-foreground">Create and manage product {directory === 'categories' ? 'categories' : 'listings'}</p>
                </div>
                <div className="flex gap-2">
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
                    <Button size={"sm"} onClick={directory === 'categories' ? openCategoryCreate : openProductCreate}>
                        <Plus />
                        {directory === 'categories' ? 'Category' : 'Product'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
