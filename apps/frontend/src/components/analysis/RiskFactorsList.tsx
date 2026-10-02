'use client';

import { useState } from 'react';
import { RiskFactor, AffectedComponent } from '@/lib/api';
import { AlertTriangle, ShieldAlert, ChevronRight, Layers, FileCode, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface RiskFactorsListProps {
  summary?: string | null;
  riskFactors?: RiskFactor[] | null;
  affectedComponents?: AffectedComponent[] | null;
  edgeCases?: string[] | null;
  showSummary?: boolean;
  showAffectedComponents?: boolean;
}

export default function RiskFactorsList({
  summary,
  riskFactors,
  affectedComponents,
  edgeCases,
  showSummary = true,
  showAffectedComponents = true,
}: RiskFactorsListProps) {
  const [expandedFactors, setExpandedFactors] = useState<Record<number, boolean>>({ 0: true, 1: true });

  const toggleFactor = (idx: number) => {
    setExpandedFactors(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Executive Summary Card */}
      {showSummary && summary && (
        <div
          className="card"
          style={{
            padding: '20px 24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
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
              <FileCode size={14} />
            </div>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Executive Analysis Summary
            </h2>
          </div>
          <p
            style={{
              fontSize: '0.925rem',
              lineHeight: 1.6,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-line',
            }}
          >
            {summary}
          </p>
        </div>
      )}

      {/* Identified Risk Factors */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: 'var(--risk-high-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--risk-high)',
              }}
            >
              <ShieldAlert size={14} />
            </div>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Identified Risk Factors
            </h2>
          </div>
          <span style={{ fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
            {riskFactors?.length || 0} factors analyzed
          </span>
        </div>

        {(!riskFactors || riskFactors.length === 0) ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No critical risk factors identified by static and AI analysis.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {riskFactors.map((factor, idx) => {
              const isExpanded = !!expandedFactors[idx];
              return (
                <div
                  key={idx}
                  style={{
                    borderRadius: 8,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    onClick={() => toggleFactor(idx)}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: 'var(--bg-elevated)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AlertTriangle size={15} style={{ color: 'var(--risk-medium)' }} />
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {factor.title}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
                        {factor.description}
                      </p>

                      {factor.evidence && factor.evidence.length > 0 && (
                        <div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                            Supporting Evidence:
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {factor.evidence.map((ev, eIdx) => (
                              <span
                                key={eIdx}
                                style={{
                                  fontSize: '0.72rem',
                                  fontFamily: "'JetBrains Mono', monospace",
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  background: 'var(--bg-card)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {ev}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Affected Components */}
      {showAffectedComponents && affectedComponents && affectedComponents.length > 0 && (
        <div
          className="card"
          style={{
            padding: '20px 24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Layers size={15} style={{ color: 'var(--accent-secondary)' }} />
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Affected Components & Architecture Blast Radius
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {affectedComponents.map((comp, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 14px',
                  borderRadius: 6,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  fontSize: '0.825rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--accent-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {comp.component}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.4, fontSize: '0.8rem' }}>
                  {comp.reason}
                </p>
                {comp.evidence && comp.evidence.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {comp.evidence.map((ev, eIdx) => (
                      <span
                        key={eIdx}
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-muted)',
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
      )}

      {/* Edge Cases & Failure Modes */}
      {edgeCases && edgeCases.length > 0 && (
        <div
          className="card"
          style={{
            padding: '20px 24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <HelpCircle size={15} style={{ color: 'var(--risk-medium)' }} />
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Potential Edge Cases & Failure Modes
            </h2>
          </div>

          <ul style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {edgeCases.map((ec, idx) => (
              <li key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {ec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
