'use client'

import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center font-medium transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
          'disabled:opacity-50 disabled:cursor-not-allowed',

          // Variants
          variant === 'primary' && [
            'bg-accent text-primary-600 hover:bg-accent-400',
            'focus:ring-accent shadow-lg shadow-accent/20',
          ],
          variant === 'secondary' && [
            'bg-surface text-white hover:bg-border',
            'focus:ring-white/20',
          ],
          variant === 'outline' && [
            'border-2 border-accent text-accent hover:bg-accent hover:text-primary-600',
            'focus:ring-accent',
          ],
          variant === 'ghost' && [
            'text-white/80 hover:text-white hover:bg-white/10',
            'focus:ring-white/20',
          ],

          // Sizes
          size === 'sm' && 'px-3 py-1.5 text-sm rounded-md',
          size === 'md' && 'px-5 py-2.5 text-base rounded-lg',
          size === 'lg' && 'px-8 py-4 text-lg rounded-xl',

          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
