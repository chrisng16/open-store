"use client"

import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "rounded-lg p-[3px] group-data-[orientation=horizontal]/tabs:h-9 data-[variant=line]:rounded-none group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col relative",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// The slider reads --slider-offset and --slider-size written by TabsList.
// `inset: 3px` matches the list's hardcoded p-[3px] — no JS padding math needed.
// Only the single sliding axis is controlled by JS; the cross-axis fills
// the inner area automatically via inset.
function TabsSlider({ orientation }: { orientation: "horizontal" | "vertical" }) {
  const isVertical = orientation === "vertical"
  return (
    <span
      aria-hidden
      className={cn(
        "absolute rounded-md bg-background shadow-sm pointer-events-none",
        "transition-[left,top,width,height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        "dark:bg-input dark:border dark:border-input"
      )}
      style={
        isVertical
          ? {
            inset: "3px",
            top: "var(--slider-offset)",
            height: "var(--slider-size)",
          }
          : {
            inset: "3px",
            left: "var(--slider-offset)",
            width: "var(--slider-size)",
          }
      }
    />
  )
}

// Writes --slider-offset and --slider-size as CSS variables onto the list element.
// Uses offsetLeft/offsetTop + offsetWidth/offsetHeight — these are relative to
// offsetParent (the list, which is position:relative), so no rect subtraction
// or padding math is needed at all.
function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const [orientation, setOrientation] = React.useState<"horizontal" | "vertical">("horizontal")

  React.useEffect(() => {
    const list = listRef.current
    if (!list) return

    const update = () => {
      const root = list.closest("[data-slot='tabs']")
      const isVertical = root?.getAttribute("data-orientation") === "vertical"
      setOrientation(isVertical ? "vertical" : "horizontal")

      const active = list.querySelector<HTMLButtonElement>(
        "[data-slot='tabs-trigger'][data-state='active']"
      )
      if (!active) return

      list.style.setProperty(
        "--slider-offset",
        `${isVertical ? active.offsetTop : active.offsetLeft}px`
      )
      list.style.setProperty(
        "--slider-size",
        `${isVertical ? active.offsetHeight : active.offsetWidth}px`
      )
    }

    update()

    const observer = new MutationObserver(update)
    observer.observe(list, { attributes: true, subtree: true, attributeFilter: ["data-state"] })
    return () => observer.disconnect()
  }, [])

  return (
    <TabsPrimitive.List
      ref={listRef as React.RefObject<HTMLDivElement>}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {variant === "default" && <TabsSlider orientation={orientation} />}
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // Base layout
        "relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-semibold whitespace-nowrap",
        // Transition — includes transform for press effect
        "transition-[color,border-color,box-shadow,transform] duration-150 ease-out",
        // Press animation on click
        "active:scale-95",
        // Focus
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:outline-1",
        // Colors
        "text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground",
        // Active state — text only; background is handled by the slider
        "data-[state=active]:text-foreground dark:data-[state=active]:text-foreground",
        "group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none",
        // Disabled
        "disabled:pointer-events-none disabled:opacity-50",
        // Vertical
        "group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start",
        // SVG
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Line variant
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        // Line variant underline animation
        "after:bg-foreground after:absolute after:transition-transform after:duration-300 after:ease-out",
        "group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:-bottom-1.25 group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=horizontal]/tabs:after:origin-left group-data-[orientation=horizontal]/tabs:after:scale-x-0",
        "group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[orientation=vertical]/tabs:after:origin-top group-data-[orientation=vertical]/tabs:after:scale-y-0",
        "group-data-[variant=line]/tabs-list:data-[state=active]:after:scale-x-100 group-data-[variant=line]/tabs-list:data-[state=active]:after:scale-y-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, tabsListVariants, TabsTrigger }
