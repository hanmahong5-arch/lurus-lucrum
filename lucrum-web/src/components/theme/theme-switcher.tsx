/**
 * Theme Switcher
 *
 * Toolbar dropdown that picks any registered theme. Iterates the registry
 * directly, so adding a third theme is a single-file change in
 * `lib/theme/registry.ts`.
 *
 * Behavior:
 *   - Button label shows the active theme's zh label + palette icon
 *   - Dropdown lists every theme with a check on the active one
 *   - Selection: setTheme → close → focus returns to button → polite ARIA
 *     announcement via `announceThemeChange`
 *
 * @module components/theme/theme-switcher
 */

"use client";

import { Check, Palette } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme, THEME_IDS, THEMES } from "@/lib/theme";
import type { ThemeId } from "@/lib/theme";
import { announceThemeChange } from "./theme-announcer";

export interface ThemeSwitcherProps {
  /** Additional CSS classes (parent layout overrides). */
  className?: string;
}

export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  const { themeId, setTheme, definition } = useTheme();

  const handleSelect = (next: ThemeId) => {
    if (next === themeId) return;
    setTheme(next);
    announceThemeChange(next);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`切换主题，当前 ${definition.label.zh}`}
          className={cn(
            "px-3 py-1.5 text-xs rounded-lg font-medium transition-all btn-tactile",
            "flex items-center gap-1.5 border outline-none",
            "bg-surface border-white/5 text-neutral-400",
            "hover:text-neutral-200 hover:border-white/10",
            "data-[state=open]:text-neutral-100 data-[state=open]:border-white/15",
            className,
          )}
        >
          <Palette className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{definition.label.zh}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 min-w-[10rem] rounded-lg p-1",
            "bg-surface border border-white/10 shadow-lg",
            "animate-slide-down",
          )}
        >
          <DropdownMenu.Label className="px-2 py-1 text-[10px] uppercase tracking-wider text-neutral-500">
            主题
          </DropdownMenu.Label>
          {THEME_IDS.map((id) => {
            const isActive = id === themeId;
            const label = THEMES[id].label.zh;
            return (
              <DropdownMenu.Item
                key={id}
                aria-current={isActive ? "true" : undefined}
                onSelect={(e) => {
                  // Radix closes by default on select; we only have to fire
                  // the side-effect.
                  e.preventDefault();
                  handleSelect(id);
                }}
                className={cn(
                  "flex items-center justify-between gap-3 px-2 py-1.5 text-xs rounded cursor-pointer outline-none",
                  "text-neutral-300 hover:text-neutral-100",
                  "hover:bg-white/5 focus:bg-white/5",
                  isActive && "text-primary",
                )}
              >
                <span>{label}</span>
                {isActive ? (
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <span className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
