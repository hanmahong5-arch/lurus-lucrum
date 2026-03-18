"use client";

/**
 * Textarea Component
 * 文本域组件
 */

import { cn } from "@/lib/utils";
import { TextareaHTMLAttributes, forwardRef } from "react";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          // Base styles
          "w-full rounded-lg border bg-surface px-4 py-3 text-sm text-white",
          "placeholder:text-white/40",
          "transition-colors duration-200",
          // Focus styles
          "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent",
          // Disabled styles
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
