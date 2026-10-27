import React from 'react';
import clsx from 'clsx';

export type BadgeVariant = 'normal' | 'full' | 'overlimit' | 'warning' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'normal',
  children,
  className,
  size = 'md',
  dot = true,
}) => {
  const variantStyles: Record<BadgeVariant, { pill: string; dot: string }> = {
    normal: {
      pill: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 shadow-emerald-500/5',
      dot: 'bg-emerald-500',
    },
    full: {
      pill: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 shadow-amber-500/5',
      dot: 'bg-amber-500',
    },
    overlimit: {
      pill: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20 shadow-rose-500/5',
      dot: 'bg-rose-500 animate-pulse',
    },
    warning: {
      pill: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 shadow-amber-500/5',
      dot: 'bg-amber-500',
    },
    info: {
      pill: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20 shadow-blue-500/5',
      dot: 'bg-blue-500',
    },
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5 font-medium',
    md: 'text-xs px-2.5 py-1 gap-2 font-semibold',
    lg: 'text-sm px-3.5 py-1.5 gap-2.5 font-semibold',
  };

  const selected = variantStyles[variant] || variantStyles.normal;

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-full border transition-all shadow-sm tracking-wide',
        selected.pill,
        sizeStyles[size],
        className
      )}
    >
      {dot && (
        <span
          className={clsx(
            'rounded-full shrink-0',
            size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2',
            selected.dot
          )}
        />
      )}
      {children}
    </span>
  );
};
