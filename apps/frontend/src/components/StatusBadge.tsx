'use client';

import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { getStatusColor, getStatusLabel, isTerminalStatus } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);
  const isRunning = !isTerminalStatus(status);
  const isCompleted = status.toUpperCase() === 'COMPLETED';
  const isFailed = status.toUpperCase() === 'FAILED';

  const sizeStyles = {
    sm: { padding: '2px 7px', fontSize: '0.7rem', iconSize: 11, gap: 4 },
    md: { padding: '4px 10px', fontSize: '0.75rem', iconSize: 13, gap: 5 },
  }[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeStyles.gap,
        padding: sizeStyles.padding,
        fontSize: sizeStyles.fontSize,
        fontWeight: 600,
        borderRadius: 100,
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        whiteSpace: 'nowrap',
      }}
    >
      {isRunning && (
        <Loader2 size={sizeStyles.iconSize} className="animate-spin" style={{ color }} />
      )}
      {isCompleted && <CheckCircle2 size={sizeStyles.iconSize} style={{ color }} />}
      {isFailed && <XCircle size={sizeStyles.iconSize} style={{ color }} />}
      {!isRunning && !isCompleted && !isFailed && (
        <Clock size={sizeStyles.iconSize} style={{ color }} />
      )}
      <span>{label}</span>
    </span>
  );
}
