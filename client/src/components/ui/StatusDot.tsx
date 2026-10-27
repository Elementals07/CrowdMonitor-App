import React from 'react';
import clsx from 'clsx';

interface StatusDotProps {
  connected: boolean;
  stale?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export const StatusDot: React.FC<StatusDotProps> = ({
  connected,
  stale = false,
  className,
  size = 'md',
  pulse = true,
}) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  let dotColor = 'bg-rose-500';
  let ringColor = 'ring-rose-500/20';
  let pulseClass = '';

  if (connected) {
    if (stale) {
      dotColor = 'bg-amber-400';
      ringColor = 'ring-amber-400/20';
      pulseClass = pulse ? 'animate-pulse' : '';
    } else {
      dotColor = 'bg-emerald-500';
      ringColor = 'ring-emerald-500/25';
      pulseClass = pulse ? 'animate-radar' : '';
    }
  }

  return (
    <span className="relative inline-flex items-center justify-center shrink-0">
      <span
        className={clsx(
          'inline-block rounded-full ring-4 transition-all duration-300',
          sizeClasses[size],
          dotColor,
          ringColor,
          pulseClass,
          className
        )}
        aria-hidden="true"
      />
    </span>
  );
};
