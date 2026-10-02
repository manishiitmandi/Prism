'use client';

import { ShieldAlert, AlertTriangle, ShieldCheck, ShieldQuestion } from 'lucide-react';

interface RiskBadgeProps {
  risk: 'HIGH' | 'MEDIUM' | 'LOW' | string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  showIcon?: boolean;
}

export default function RiskBadge({
  risk,
  size = 'md',
  showPulse = false,
  showIcon = true,
}: RiskBadgeProps) {
  const normalized = (risk || 'UNKNOWN').toUpperCase();

  let color = 'var(--text-muted)';
  let bg = 'rgba(139, 144, 164, 0.1)';
  let border = 'rgba(139, 144, 164, 0.25)';
  let label = normalized;
  let Icon = ShieldQuestion;

  if (normalized === 'HIGH') {
    color = 'var(--risk-high)';
    bg = 'var(--risk-high-bg)';
    border = 'var(--risk-high-border)';
    label = 'HIGH RISK';
    Icon = ShieldAlert;
  } else if (normalized === 'MEDIUM') {
    color = 'var(--risk-medium)';
    bg = 'var(--risk-medium-bg)';
    border = 'var(--risk-medium-border)';
    label = 'MEDIUM RISK';
    Icon = AlertTriangle;
  } else if (normalized === 'LOW') {
    color = 'var(--risk-low)';
    bg = 'var(--risk-low-bg)';
    border = 'var(--risk-low-border)';
    label = 'LOW RISK';
    Icon = ShieldCheck;
  }

  const sizeStyles = {
    sm: { padding: '2px 7px', fontSize: '0.7rem', iconSize: 11, gap: 4 },
    md: { padding: '4px 10px', fontSize: '0.75rem', iconSize: 13, gap: 6 },
    lg: { padding: '6px 14px', fontSize: '0.85rem', iconSize: 16, gap: 8 },
  }[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeStyles.gap,
        padding: sizeStyles.padding,
        fontSize: sizeStyles.fontSize,
        fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '0.05em',
        borderRadius: 100,
        color,
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: normalized === 'HIGH'
          ? '0 0 14px rgba(244, 63, 94, 0.25)'
          : normalized === 'MEDIUM'
          ? '0 0 10px rgba(245, 158, 11, 0.2)'
          : '0 0 10px rgba(16, 185, 129, 0.15)',
        whiteSpace: 'nowrap',
      }}
    >
      {showPulse && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}`,
            animation: normalized === 'HIGH' ? 'pulse 1.5s infinite' : undefined,
          }}
        />
      )}
      {showIcon && <Icon size={sizeStyles.iconSize} />}
      <span>{label}</span>
    </span>
  );
}
