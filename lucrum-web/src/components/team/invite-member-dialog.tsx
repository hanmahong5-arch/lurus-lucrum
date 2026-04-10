'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
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

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: number;
  onInvited: () => void;
}

export function InviteMemberDialog({ open, onOpenChange, teamId, onInvited }: InviteMemberDialogProps) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [appError, setAppError] = useState<AppError | null>(null);
  const [success, setSuccess] = useState(false);

  const { execute: submit, isRunning } = useSafeAction(
    async () => {
      const res = await fetch(`/api/team/${teamId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!res.ok) throw await parseApiError(res, 'INVITATION_FAILED');
      return true;
    },
    {
      onSuccess: () => {
        setSuccess(true);
        setAppError(null);
        setEmail('');
        onInvited();
        // Auto-close after success animation
        setTimeout(() => {
          onOpenChange(false);
          setSuccess(false);
        }, 1500);
      },
      onError: (err) => {
        setAppError({
          code: 'INVITATION_FAILED',
          title: '邀请发送失败',
          description: err.message,
          severity: 'error',
          recoveryActions: [{ type: 'retry', label: '重试' }],
        });
      },
    }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('team.inviteTitle')}</DialogTitle>
        </DialogHeader>

        {/* Success state with animation */}
        {success ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3 animate-in zoom-in-50 duration-300">
            <div className="w-12 h-12 rounded-full bg-profit/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-profit" />
            </div>
            <p className="text-sm text-profit font-medium">{t('team.inviteSuccess')}</p>
            <p className="text-xs text-white/30">{email}</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm text-white/60">{t('team.inviteEmail')}</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setAppError(null); }}
                  placeholder="colleague@example.com"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/60">{t('team.inviteRole')}</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="admin">{t('team.role.admin')}</option>
                  <option value="member">{t('team.role.member')}</option>
                  <option value="viewer">{t('team.role.viewer')}</option>
                </select>
                {/* Role decision helper */}
                <p className="text-[11px] text-white/20">
                  {role === 'admin' && '可管理成员和设置'}
                  {role === 'member' && '可创建策略和运行回测'}
                  {role === 'viewer' && '仅查看，不可修改'}
                </p>
              </div>

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
                disabled={isRunning || !email.trim()}
              >
                {isRunning ? t('common.loading') : t('team.inviteSend')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
