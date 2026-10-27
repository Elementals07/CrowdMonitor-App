import React from 'react';
import { AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface DataLabelProps {
  type?: 'estimated' | 'demo' | 'custom';
  text?: string;
  className?: string;
}

export const DataLabel: React.FC<DataLabelProps> = ({
  type = 'estimated',
  text,
  className,
}) => {
  const displayText = text || (type === 'demo' ? 'DEMO DATA' : 'ESTIMATED');

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-amber-100 text-amber-800 border border-amber-300',
        className
      )}
      title="This metric is calculated from snapshot deltas or sample models, not direct sensor events."
    >
      <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
      <span>{displayText}</span>
    </span>
  );
};
