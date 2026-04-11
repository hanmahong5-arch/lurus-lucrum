'use client';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { GitPullRequest, Check, X, RotateCcw } from 'lucide-react';

const STATUS_CONFIG: Record<string, { variant: BadgeProps['variant']; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  open: { variant: 'default', icon: GitPullRequest, label: '评审中' },
  approved: { variant: 'success', icon: Check, label: '已通过' },
  rejected: { variant: 'danger', icon: X, label: '已拒绝' },
  withdrawn: { variant: 'secondary', icon: RotateCcw, label: '已撤回' },
};

export function ReviewStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.open!;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}
