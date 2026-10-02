'use client';

import { AffectedComponent } from '@/lib/api';
import { Layers, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface AffectedComponentsListProps {
  affectedComponents?: AffectedComponent[] | null;
}

export default function AffectedComponentsList({
  affectedComponents,
}: AffectedComponentsListProps) {
  if (!affectedComponents || affectedComponents.length === 0) {
    return null;
  }

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'var(--accent-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-secondary)',
            }}
          >
            <Layers size={14} />
          </div>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
            Affected Components & Blast Radius
          </h2>
        </div>

        <span
          style={{
            fontSize: '0.7rem',
            fontFamily: "'JetBrains Mono', monospace",
            padding: '2px 8px',
            borderRadius: 100,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--accent-secondary)',
            fontWeight: 700,
          }}
        >
          {affectedComponents.length} {affectedComponents.length === 1 ? 'component' : 'components'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {affectedComponents.map((comp, idx) => (
          <div
            key={idx}
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              fontSize: '0.825rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span
                style={{
                  fontWeight: 700,
                  color: 'var(--accent-secondary)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.825rem',
                  wordBreak: 'break-all',
                }}
              >
                {comp.component}
              </span>
            </div>

            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: '0.8rem', marginBottom: comp.evidence && comp.evidence.length > 0 ? 8 : 0 }}>
              {comp.reason}
            </p>

            {comp.evidence && comp.evidence.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {comp.evidence.map((ev, eIdx) => (
                  <span
                    key={eIdx}
                    style={{
                      fontSize: '0.68rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {ev}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
