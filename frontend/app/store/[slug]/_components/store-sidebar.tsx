"use client";

import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { BusinessHours, StorePublic } from "@/lib/types";
import { formatPhoneNumber } from "@/lib/utils";
import { ClipboardList, Clock, Home, Menu, Navigation, Phone } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { StoreThemeToggle } from "./store-theme-toggle";

export function StoreSidebar({ store, slug }: { store: StorePublic; slug: string }) {
    const [open, setOpen] = useState(false);
    const [hoursOpen, setHoursOpen] = useState(true);
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    const navItems = [
        {
            label: "Menu",
            href: `/store/${slug}`,
            icon: Home,
        },
        {
            label: "Track Orders",
            href: `/store/${slug}/orders`,
            icon: ClipboardList,
        },
    ];

    const formatTime = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const period = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;

        return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
    };

    const days: { key: keyof BusinessHours; label: string }[] = [
        { key: 'mon', label: 'Monday' },
        { key: 'tue', label: 'Tuesday' },
        { key: 'wed', label: 'Wednesday' },
        { key: 'thu', label: 'Thursday' },
        { key: 'fri', label: 'Friday' },
        { key: 'sat', label: 'Saturday' },
        { key: 'sun', label: 'Sunday' },
    ];

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden -ml-2 h-9 w-9 rounded-full">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-75 sm:w-87.5 p-0 flex flex-col">
                <SheetHeader className="p-6 text-left border-b bg-muted/20">
                    <div className="flex items-center gap-3">
                        {store.logoUrl && (
                            <img
                                src={store.logoUrl}
                                alt={store.name}
                                className="h-12 w-12 rounded-lg border border-border/70 object-cover shadow-sm"
                            />
                        )}
                        <div>
                            <SheetTitle className="text-xl font-bold tracking-tight">{store.name}</SheetTitle>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{store.description || "Store Information"}</p>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-2 flex flex-col justify-between">
                    <nav className="space-y-1.5">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive(item.href)
                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="mt-10 space-y-4">
                        {store.address && (
                            <div className="px-4 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                                <h4 className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2 tracking-widest">
                                    <Navigation className="size-3 shrink-0" />
                                    Location
                                </h4>
                                <span className="text-muted-foreground text-sm">{store.address}</span>
                            </div>
                        )}
                        {store.phone && (
                            <div className="px-4 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                                <h4 className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2 tracking-widest">
                                    <Phone className="size-3 shrink-0" />
                                    Phone
                                </h4>
                                <span className="text-muted-foreground text-sm">{formatPhoneNumber(store.phone)}</span>
                            </div>
                        )}
                        {store.businessHours && (
                            <div className="px-4 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                                <h4 className="text-[10px] mb-2 font-bold text-muted-foreground uppercase flex items-center gap-2 tracking-widest">
                                    <Clock className="size-3 shrink-0" />
                                    Business Hours
                                </h4>
                                {days.map((day) => {
                                    const dayHours = store.businessHours ? store.businessHours[day.key] : undefined;
                                    return (
                                        <div key={day.key} className="flex justify-between py-1 text-sm">
                                            <span className="text-muted-foreground">{day.label}</span>
                                            <span className="font-medium">
                                                {dayHours?.status === 'open24' && 'Open 24h'}
                                                {dayHours?.status === 'closed' && 'Closed'}
                                                {dayHours?.status === 'ranges' && dayHours.ranges?.map((r) => `${formatTime(r.startMin)} - ${formatTime(r.endMin)}`).join(', ')}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}


                    </div>
                </div>

                <div className="p-4 border-t bg-muted/10">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Dark Mode</span>
                        <StoreThemeToggle />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
