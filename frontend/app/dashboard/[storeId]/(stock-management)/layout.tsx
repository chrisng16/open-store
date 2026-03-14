import { StockManagementDialogHost } from "@/components/dashboard/common/stock-management-dialog-host";
import StockManagementSubNav from "./_components/stock-management-sub-nav";

export default function StoreManagementLayout({
    children,

}: {
    children: React.ReactNode;

}) {
    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="sticky top-0 z-20 shrink-0 bg-background-elevated rounded-t-md">
                <StockManagementSubNav />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
                {children}
            </div>
            <StockManagementDialogHost />
        </div>
    );
}
