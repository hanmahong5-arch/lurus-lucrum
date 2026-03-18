"use client";

/**
 * Badge Component
 * 徽章组件
 */

import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "danger";
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          // Base styles
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
          "transition-colors duration-200",

          // Variants
          variant === "default" && "bg-accent/20 text-accent",
          variant === "secondary" && "bg-white/10 text-white/80",
          variant === "outline" && "border border-current bg-transparent",
          variant === "success" && "bg-profit/20 text-profit",
          variant === "warning" && "bg-warning/20 text-warning",
          variant === "danger" && "bg-loss/20 text-loss",

          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

export { Badge };
