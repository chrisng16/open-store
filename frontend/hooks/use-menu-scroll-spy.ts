"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Section {
    id: string;
}

interface UseMenuScrollSpyOptions {
    sections: Section[];
    defaultSection: string;
    /** Combined pixel height of everything above the tab bar (navbar + store info + tab bar + gap). */
    getStickyOffset: () => number;
    /** Scrollable tab bar inner container ref (the overflow-x div). */
    tabScrollerRef: React.RefObject<HTMLDivElement | null>;
    /** Map of section-id → section DOM element. */
    sectionRefs: React.RefObject<Record<string, HTMLElement | null>>;
    /** Map of section-id → tab button element. */
    tabButtonRefs: React.RefObject<Record<string, HTMLButtonElement | null>>;
}

interface UseMenuScrollSpyReturn {
    activeSection: string;
    navigateTo: (sectionId: string) => void;
}

export function useMenuScrollSpy({
    sections,
    defaultSection,
    getStickyOffset,
    tabScrollerRef,
    sectionRefs,
    tabButtonRefs,
}: UseMenuScrollSpyOptions): UseMenuScrollSpyReturn {
    const [activeSection, setActiveSection] = useState(defaultSection);

    // Suppress scroll-spy while a programmatic scroll is animating.
    const isProgrammaticScrollRef = useRef(false);
    // rAF handle for the settle-detection loop.
    const settleRafRef = useRef<number | null>(null);
    const lastScrollYRef = useRef(0);
    // rAF handle for the scroll-spy tick.
    const spyRafRef = useRef<number | null>(null);

    // ─── Tab snap ────────────────────────────────────────────────────────────

    const scrollTabIntoView = useCallback(
        (sectionId: string) => {
            const tab = tabButtonRefs.current?.[sectionId];
            const bar = tabScrollerRef.current;
            if (!tab || !bar) return;

            const barLeft = bar.getBoundingClientRect().left;
            const tabLeft = tab.getBoundingClientRect().left;
            // 16 px matches the p-2 padding of the tab bar wrapper. 14px is an extra offset to show a bit of the previous tab for context, and to avoid centering the active tab which looks odd when it's the first or last one.
            bar.scrollTo({ left: bar.scrollLeft + (tabLeft - barLeft) - 16 - 14, behavior: "smooth" });
        },
        [tabButtonRefs, tabScrollerRef],
    );

    // ─── Scroll settle detection ──────────────────────────────────────────────
    //
    // Polls rAF until window.scrollY hasn't changed between two consecutive
    // frames, then re-enables the spy. More reliable than any fixed timeout.

    const waitForScrollSettle = useCallback(() => {
        if (settleRafRef.current !== null) cancelAnimationFrame(settleRafRef.current);
        lastScrollYRef.current = window.scrollY;

        const check = () => {
            const y = window.scrollY;
            if (y === lastScrollYRef.current) {
                isProgrammaticScrollRef.current = false;
                settleRafRef.current = null;
            } else {
                lastScrollYRef.current = y;
                settleRafRef.current = requestAnimationFrame(check);
            }
        };

        settleRafRef.current = requestAnimationFrame(check);
    }, []);

    // ─── Scroll-spy ──────────────────────────────────────────────────────────
    //
    // Runs once per animation frame (via rAF gate on the scroll event).
    // Picks the section with the most pixels visible in the detection band
    // (from sticky offset → 60 % of viewport height). This keeps a tall
    // section active the entire time the user scrolls through it.

    const runScrollSpy = useCallback(() => {
        if (isProgrammaticScrollRef.current) return;
        if (sections.length === 0) return;

        const bandTop = getStickyOffset();
        const bandBottom = window.innerHeight * 0.6;

        let bestId = sections[0].id;
        let bestVisible = -1;

        for (const section of sections) {
            const el = sectionRefs.current?.[section.id];
            if (!el) continue;

            const { top, bottom } = el.getBoundingClientRect();
            const visible = Math.min(bottom, bandBottom) - Math.max(top, bandTop);

            if (visible > bestVisible) {
                bestVisible = visible;
                bestId = section.id;
            }
        }

        setActiveSection((prev) => {
            if (prev === bestId) return prev;
            scrollTabIntoView(bestId);
            return bestId;
        });
    }, [sections, getStickyOffset, sectionRefs, scrollTabIntoView]);

    const onScroll = useCallback(() => {
        if (spyRafRef.current !== null) return;
        spyRafRef.current = requestAnimationFrame(() => {
            spyRafRef.current = null;
            runScrollSpy();
        });
    }, [runScrollSpy]);

    useEffect(() => {
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll(); // sync on mount
        return () => {
            window.removeEventListener("scroll", onScroll);
            if (spyRafRef.current !== null) cancelAnimationFrame(spyRafRef.current);
            if (settleRafRef.current !== null) cancelAnimationFrame(settleRafRef.current);
        };
    }, [onScroll]);

    // ─── Programmatic navigation ──────────────────────────────────────────────

    const navigateTo = useCallback(
        (sectionId: string) => {
            // Update tab immediately for instant feedback.
            setActiveSection(sectionId);
            scrollTabIntoView(sectionId);

            // Suppress spy for the duration of the scroll animation.
            isProgrammaticScrollRef.current = true;
            if (settleRafRef.current !== null) cancelAnimationFrame(settleRafRef.current);

            const target = sectionRefs.current?.[sectionId];
            if (!target) return;

            const top = window.scrollY + target.getBoundingClientRect().top - getStickyOffset();
            console.log("Scrolling to", sectionId, "at", top, getStickyOffset());
            window.scrollTo({ top, behavior: "smooth" });

            // Small delay so scrollY has started moving before we begin polling.
            setTimeout(waitForScrollSettle, 32);
        },
        [getStickyOffset, sectionRefs, scrollTabIntoView, waitForScrollSettle],
    );

    return { activeSection, navigateTo };
}