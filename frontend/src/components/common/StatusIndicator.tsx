import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Loader2, Slash } from 'lucide-react';
import { JobStatus } from '../../types';

interface StatusIndicatorProps {
  status: JobStatus;
  stage?: string;
  className?: string;
  showIcon?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  stage,
  className = '',
  showIcon = true,
}) => {
  const normStatus = (status || 'pending').toLowerCase();

  let colorClass = 'text-slate-400';
  let icon = <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  let label = normStatus;

  switch (normStatus) {
    case 'completed':
      colorClass = 'text-emerald-400';
      icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      label = 'Completed';
      break;
    case 'running':
    case 'processing':
      colorClass = 'text-indigo-400';
      icon = <Loader2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 animate-spin" />;
      label = stage ? `Running: ${stage.replace('_', ' ')}` : 'Running';
      break;
    case 'pending':
      colorClass = 'text-amber-400';
      icon = <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      label = 'Pending';
      break;
    case 'failed':
      colorClass = 'text-rose-400';
      icon = <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      label = 'Failed';
      break;
    case 'cancelled':
      colorClass = 'text-slate-400';
      icon = <Slash className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
      label = 'Cancelled';
      break;
    default:
      label = normStatus.charAt(0).toUpperCase() + normStatus.slice(1);
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${colorClass} ${className}`}>
      {showIcon && icon}
      <span>{label}</span>
    </span>
  );
};
