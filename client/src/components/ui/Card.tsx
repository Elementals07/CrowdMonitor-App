import React from 'react';
import clsx from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, elevated = false, ...props }) => {
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl border transition-all duration-200',
        elevated
          ? 'shadow-md border-slate-200/80 hover:shadow-lg'
          : 'shadow-sm border-slate-200/60 hover:border-slate-300/80',
        'p-5 sm:p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
