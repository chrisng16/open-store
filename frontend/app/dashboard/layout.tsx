import { SiteHeader } from "@/components/site-header";
import { DashboardShell } from "./_components/dashboard-shell";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DashboardShell header={<SiteHeader />}>
            {children}
        </DashboardShell>
    );
}