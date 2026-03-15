"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { CreateStoreSidebar } from "@/components/create-store-sidebar";
import PageTransition from "@/components/page-transition";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";

export function DashboardShell({
    children,
    header,
}: {
    children: React.ReactNode;
    header: React.ReactNode;
}) {
    const pathname = usePathname();
    const isCreateStorePage = pathname === "/dashboard/store/new";

    return (
        <div className="[--header-height:calc(--spacing(14))] max-h-screen overflow-hidden overscroll-none">
            <SidebarProvider className="flex flex-col">
                {header}
                <div className="flex min-w-0">
                    {isCreateStorePage ? (
                        <CreateStoreSidebar collapsible="icon" />
                    ) : (
                        <AppSidebar collapsible="icon" />
                    )}
                    <SidebarInset className="bg-background-elevated min-w-0">
                        <div
                            className={
                                isCreateStorePage
                                    ? "h-[calc(100dvh-var(--header-height))] overflow-y-auto overscroll-none flex flex-col"
                                    : "h-[calc(100dvh-var(--header-height)-0.5rem)] overflow-y-auto overflow-x-hidden overscroll-none flex flex-col"
                            }
                        >
                            <PageTransition>{children}</PageTransition>
                        </div>
                    </SidebarInset>
                </div>
            </SidebarProvider>
        </div>
    );
}