"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { CreateStoreSidebar } from "@/components/create-store-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    if (pathname === "/dashboard/store/new") {
        return (
            <div className="[--header-height:calc(--spacing(14))] max-h-screen overflow-hidden overscroll-none">
                <SidebarProvider className="flex flex-col">
                    <SiteHeader />
                    <div className="flex min-w-0">
                        <CreateStoreSidebar collapsible="icon" />
                        <SidebarInset className="bg-background-elevated min-w-0">
                            <div className="h-[calc(100dvh-var(--header-height))] overflow-y-auto overscroll-none">
                                {children}
                            </div>
                        </SidebarInset>
                    </div>
                </SidebarProvider>
            </div>
        )
    }
    return (
        <div className="[--header-height:calc(--spacing(14))] max-h-screen overflow-hidden overscroll-none">
            <SidebarProvider className="flex flex-col">
                <SiteHeader />
                <div className="flex min-w-0">
                    <AppSidebar collapsible="icon" />
                    <SidebarInset className="bg-background-elevated min-w-0">
                        <div className="h-[calc(100dvh-var(--header-height)-0.5rem)] overflow-y-auto overflow-x-hidden overscroll-none">
                            {children}
                        </div>
                    </SidebarInset>
                </div>
            </SidebarProvider>
        </div>
    );
}
