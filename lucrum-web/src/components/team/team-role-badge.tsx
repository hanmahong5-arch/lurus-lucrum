'use client';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/dictionaries/zh';

const ROLE_VARIANT: Record<string, BadgeProps['variant']> = {
  owner: 'default',    // accent/20 text-accent
  admin: 'success',    // profit/20 text-profit
  member: 'secondary', // white/10 text-white/80
  viewer: 'outline',   // border, transparent
};

const ROLE_I18N: Record<string, TranslationKey> = {
  owner: 'team.role.owner',
  admin: 'team.role.admin',
  member: 'team.role.member',
  viewer: 'team.role.viewer',
};

export function TeamRoleBadge({ role }: { role: string }) {
  const { t } = useI18n();
  const variant = ROLE_VARIANT[role] ?? 'secondary';
  const label = ROLE_I18N[role] ? t(ROLE_I18N[role]!) : role;

  return <Badge variant={variant}>{label}</Badge>;
}
