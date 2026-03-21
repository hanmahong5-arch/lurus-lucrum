'use client';

/**
 * Keyboard Shortcuts Help Dialog
 *
 * Displays all registered keyboard shortcuts in a categorized modal.
 * Triggered by pressing "?" key or via the settings menu.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  SHORTCUTS,
  getShortcutsByCategory,
  useModifierSymbol,
} from '@/hooks/use-keyboard-shortcuts';

// =============================================================================
// Types
// =============================================================================

interface ShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// =============================================================================
// Category Labels
// =============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  nav: '导航',
  action: '操作',
  panel: '面板',
};

// =============================================================================
// Component
// =============================================================================

export function ShortcutsHelp({ open, onOpenChange }: ShortcutsHelpProps) {
  const modSymbol = useModifierSymbol();
  const categories = getShortcutsByCategory();

  /**
   * Replace the generic command symbol with the platform-specific one.
   * The shortcut definitions use \u2318 (Mac command) by default.
   */
  function formatDisplay(display: string): string {
    return display.replace('\u2318', modSymbol);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-surface border-border text-white">
        <DialogHeader>
          <DialogTitle className="text-white">键盘快捷键</DialogTitle>
          <DialogDescription className="text-white/50">
            使用快捷键加速操作
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2 max-h-[60vh] overflow-y-auto pr-1">
          {Object.entries(categories).map(([catKey, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={catKey}>
                <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                  {CATEGORY_LABELS[catKey] ?? catKey}
                </h3>
                <div className="space-y-1">
                  {items.map(({ key, def }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/5"
                    >
                      <span className="text-sm text-white/80">{def.label}</span>
                      <kbd className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 border border-white/10 text-xs font-mono text-white/60 min-w-[2rem] justify-center">
                        {formatDisplay(def.display)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs text-white/30 text-center">
            按 <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/50 font-mono text-[10px]">?</kbd> 随时查看此帮助
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ShortcutsHelp;
