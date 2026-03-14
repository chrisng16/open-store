"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export default function PageTransition({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        // Cancel any in-flight animation, then fade in the new content
        el.getAnimations().forEach((a) => a.cancel());
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 220,
            easing: "ease-out",
            fill: "forwards",
        });
    }, [pathname]);

    return (
        <div ref={ref} className="flex flex-col flex-1 min-h-0">
            {children}
        </div>
    );
}
