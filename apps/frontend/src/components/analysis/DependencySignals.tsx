'use client';

import { DependencyMetrics } from '@/lib/api';
import {
  Share2,
  AlertTriangle,
  Database,
  Lock,
  Settings,
  ShieldCheck,
  CheckCircle2,
  FileCode,
  DollarSign,
  Activity,
} from 'lucide-react';

interface DependencySignalsProps {
  metrics?: DependencyMetrics | null;
}

export default function DependencySignals({ metrics }: DependencySignalsProps) {
  if (!metrics) return null;

  const flagList = [
    { key: 'public_api_changed', label: 'Public API Modified', active: metrics.public_api_changed, icon: FileCode, danger: true },
    { key: 'auth_changed', label: 'Auth / Security Logic', active: metrics.auth_changed, icon: Lock, danger: true },
    { key: 'database_changed', label: 'Schema / DB Queries', active: metrics.database_changed, icon: Database, danger: true },
    { key: 'payment_changed', label: 'Billing / Payments', active: metrics.payment_changed, icon: DollarSign, danger: true },
    { key: 'config_changed', label: 'Configuration Files', active: metrics.config_changed, icon: Settings, danger: false },
    { key: 'tests_absent', label: 'Zero Tests Included', active: metrics.tests_absent, icon: AlertTriangle, danger: true },
    { key: 'tests_changed', label: 'Test Suite Modified', active: metrics.tests_changed, icon: ShieldCheck, danger: false },
  ];

  return (
    <div
      className="card"
      style={{
        padding: '20px 24px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Share2 size={15} style={{ color: 'var(--accent-secondary)' }} />
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
          Dependency Metrics & System Signals
        </h2>
      </div>

      {/* Metric Counters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
            Direct Callers
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
            {metrics.direct_dependents ?? 0}
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
            Transitive Impact
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: metrics.transitive_dependents > 5 ? 'var(--risk-medium)' : 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
            {metrics.transitive_dependents ?? 0}
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
            Affected Modules
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
            {metrics.affected_modules ?? 0}
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
            Affected Tests
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--risk-low)', fontFamily: "'JetBrains Mono', monospace" }}>
            {metrics.affected_tests ?? 0}
          </div>
        </div>
      </div>

      {/* Flag Badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {flagList.map(flag => {
          const Icon = flag.icon;
          const isActive = flag.active;

          let badgeColor = 'var(--text-muted)';
          let badgeBg = 'var(--bg-secondary)';
          let badgeBorder = 'var(--border-subtle)';

          if (isActive) {
            if (flag.danger) {
              badgeColor = 'var(--risk-high)';
              badgeBg = 'var(--risk-high-bg)';
              badgeBorder = 'var(--risk-high-border)';
            } else {
              badgeColor = 'var(--risk-low)';
              badgeBg = 'var(--risk-low-bg)';
              badgeBorder = 'var(--risk-low-border)';
            }
          }

          return (
            <div
              key={flag.key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: '0.75rem',
                fontWeight: isActive ? 600 : 400,
                color: badgeColor,
                background: badgeBg,
                border: `1px solid ${badgeBorder}`,
                opacity: isActive ? 1 : 0.45,
              }}
            >
              <Icon size={12} />
              <span>{flag.label}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, marginLeft: 2 }}>
                {isActive ? 'YES' : 'NO'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
