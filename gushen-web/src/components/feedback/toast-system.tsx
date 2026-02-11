"use client";

/**
 * Toast System Component
 *
 * Custom Toaster wrapper using sonner library with Gushen design system styling.
 * Provides 4 variants: success, warning, error, info
 *
 * Features:
 * - Right-bottom positioned
 * - Max 3 visible toasts with stacking
 * - Slide-in-right entry, fade-out exit (150ms)
 * - Swipe-to-dismiss support
 * - Reduced motion support
 * - Accessible (aria-live polite/assertive)
 *
 * Story 1.2: Toast 通知系统
 */

import { Toaster as SonnerToaster } from "sonner";
import { CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";

/**
 * Toast System Component
 *
 * Add this to your root layout to enable toast notifications:
 * ```tsx
 * import { ToastSystem } from '@/components/feedback/toast-system';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         <ToastSystem />
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function ToastSystem() {
  return (
    <SonnerToaster
      position="bottom-right"
      visibleToasts={3}
      gap={8}
      theme="dark"
      richColors={false}
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "toast-base group flex items-start gap-3 p-4 rounded-lg shadow-lg max-w-[360px] w-full pointer-events-auto",
          title: "text-sm font-medium text-foreground",
          description: "text-xs text-neutral-400 mt-1",
          actionButton:
            "bg-primary text-white text-xs px-3 py-1.5 rounded font-medium hover:bg-primary-hover transition-colors",
          cancelButton:
            "bg-surface-hover text-neutral-300 text-xs px-3 py-1.5 rounded font-medium hover:bg-surface-active transition-colors",
          closeButton:
            "absolute top-2 right-2 p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-neutral-200 transition-colors opacity-0 group-hover:opacity-100",
          success: "toast-success",
          warning: "toast-warning",
          error: "toast-error",
          info: "toast-info",
        },
      }}
      icons={{
        success: <CheckCircle className="w-5 h-5 text-step-done shrink-0" />,
        warning: (
          <AlertTriangle className="w-5 h-5 text-status-warn shrink-0" />
        ),
        error: <XCircle className="w-5 h-5 text-status-block shrink-0" />,
        info: <Info className="w-5 h-5 text-primary shrink-0" />,
      }}
    />
  );
}

export default ToastSystem;
