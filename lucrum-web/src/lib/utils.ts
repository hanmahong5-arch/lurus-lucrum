import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format number with sign and color class
 */
export function formatPnL(value: number): { text: string; className: string } {
  const sign = value >= 0 ? '+' : ''
  const className = value >= 0 ? 'text-profit' : 'text-loss'
  return {
    text: `${sign}${value.toFixed(2)}%`,
    className,
  }
}

/**
 * Format currency
 */
export function formatCurrency(value: number, currency = 'CNY'): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
