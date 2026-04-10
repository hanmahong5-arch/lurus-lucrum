'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n/context';
import { useSafeAction } from '@/hooks/use-safe-action';
import { parseApiError, type AppError } from '@/lib/errors/error-types';

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (team: { id: number; name: string; slug: string }) => void;
}

export function CreateTeamDialog({ open, onOpenChange, onCreated }: CreateTeamDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [appError, setAppError] = useState<AppError | null>(null);

  const { execute: submit, isRunning } = useSafeAction(
    async () => {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      });
      if (!res.ok) throw await parseApiError(res, 'TEAM_CREATE_FAILED');
      return (await res.json()).data as { id: number; name: string; slug: string };
    },
    {
      onSuccess: (team) => {
        onCreated(team);
        onOpenChange(false);
        setName('');
        setSlug('');
        setAppError(null);
      },
      onError: (err) => {
        // parseApiError returns an AppError-like object; useSafeAction wraps it in Error
        setAppError({
          code: 'TEAM_CREATE_FAILED',
          title: '团队创建失败',
          description: err.message,
          severity: 'error',
          recoveryActions: [{ type: 'retry', label: '重试' }],
        });
      },
    }
  );

  const handleNameChange = (value: string) => {
    setName(value);
    const generated = value
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    setSlug(generated);
    setAppError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('team.createTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm text-white/60">{t('team.name')}</label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Trading Team"
              maxLength={100}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/60">{t('team.slug')}</label>
            <Input
              value={slug}
              onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setAppError(null); }}
              placeholder="my-trading-team"
              maxLength={50}
            />
            <p className="text-xs text-white/30">{t('team.slugHint')}</p>
          </div>

          {/* Structured error display with recovery action */}
          {appError && (
            <div className="rounded-md bg-loss/10 border border-loss/20 px-3 py-2.5 space-y-1">
              <p className="text-sm text-loss font-medium">{appError.title}</p>
              <p className="text-xs text-loss/70">{appError.description}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isRunning}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => submit()}
            disabled={isRunning || !name.trim() || !slug.trim()}
          >
            {isRunning ? t('common.loading') : t('team.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
