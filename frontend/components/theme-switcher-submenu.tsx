"use client"

import { Check, Laptop, Moon, Palette, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"

type ThemeOption = "light" | "dark" | "system"

const themeOptions: Array<{
  value: ThemeOption
  label: string
  icon: typeof Sun
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
]

export function ThemeSwitcherSubmenu() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = mounted ? (theme as ThemeOption) : "system"
  const activeLabel =
    themeOptions.find((option) => option.value === activeTheme)?.label ?? "System"

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Palette />
        Theme
        <span className="text-muted-foreground text-xs">{activeLabel}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-44">
        {themeOptions.map((option) => {
          const Icon = option.icon
          const isActive = activeTheme === option.value

          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className="justify-between"
            >
              <span className="flex items-center gap-2">
                <Icon className="size-4" />
                {option.label}
              </span>
              {isActive ? <Check className="size-4" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}