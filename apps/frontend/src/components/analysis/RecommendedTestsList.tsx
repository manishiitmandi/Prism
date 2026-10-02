'use client';

import { useState } from 'react';
import { RecommendedTest } from '@/lib/api';
import {
  ShieldAlert,
  CheckCircle2,
  Copy,
  Check,
  Terminal,
  FileCode,
  Flame,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface RecommendedTestsListProps {
  recommendedTests?: RecommendedTest[] | null;
  missingTestCandidates?: string[] | null;
  relatedTests?: string[] | null;
}

export default function RecommendedTestsList({
  recommendedTests,
  missingTestCandidates,
  relatedTests,
}: RecommendedTestsListProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyTestCmd = async (testName: string, idx: number) => {
    const cmd = `pytest -k "${testName}"`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // ignore
    }
  };

  const hasMissing = missingTestCandidates && missingTestCandidates.length > 0;
  const hasRecommended = recommendedTests && recommendedTests.length > 0;
  const hasRelated = relatedTests && relatedTests.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Missing Test Candidates Alert Banner (High Urgency) */}
      {hasMissing && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, rgba(255, 77, 109, 0.12) 0%, rgba(255, 159, 67, 0.08) 100%)',
            border: '1px solid var(--risk-high-border)',
            boxShadow: '0 0 16px rgba(255, 77, 109, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Flame size={18} style={{ color: 'var(--risk-high)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--risk-high)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Uncovered Public Symbols Alert
            </span>
          </div>

          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
            The following modified public symbols lack associated unit or integration tests in the repository AST graph:
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {missingTestCandidates.map((sym, idx) => (
              <span
                key={idx}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: 'rgba(255, 77, 109, 0.18)',
                  border: '1px solid rgba(255, 77, 109, 0.35)',
                  color: '#ff859b',
                }}
              >
                {sym}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Tests to Execute Card */}
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
                background: 'var(--accent-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-secondary)',
              }}
            >
              <Terminal size={14} />
            </div>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Recommended Test Suites & Scenarios
            </h2>
          </div>
          <span style={{ fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
            {recommendedTests?.length || 0} suggested
          </span>
        </div>

        {!hasRecommended ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No specific test additions or runs recommended by AI evaluator.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recommendedTests.map((t, idx) => {
              const priority = (t.priority || 'MEDIUM').toUpperCase();
              let pColor = 'var(--risk-medium)';
              let pBg = 'var(--risk-medium-bg)';
              let pBorder = 'var(--risk-medium-border)';

              if (priority === 'HIGH') {
                pColor = 'var(--risk-high)';
                pBg = 'var(--risk-high-bg)';
                pBorder = 'var(--risk-high-border)';
              } else if (priority === 'LOW') {
                pColor = 'var(--risk-low)';
                pBg = 'var(--risk-low-bg)';
                pBorder = 'var(--risk-low-border)';
              }

              const isCopied = copiedIndex === idx;

              return (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: pBg,
                          border: `1px solid ${pBorder}`,
                          color: pColor,
                          fontFamily: "'JetBrains Mono', monospace",
                          letterSpacing: '0.05em',
                        }}
                      >
                        {priority}
                      </span>

                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.825rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={t.test_name}
                      >
                        {t.test_name}
                      </span>
                    </div>

                    <button
                      onClick={() => copyTestCmd(t.test_name, idx)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        color: isCopied ? 'var(--risk-low)' : 'var(--text-secondary)',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      title="Copy pytest command"
                    >
                      {isCopied ? <Check size={11} /> : <Copy size={11} />}
                      <span>{isCopied ? 'Copied' : 'Run cmd'}</span>
                    </button>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {t.reason}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Related Existing Tests Detected Card */}
      {hasRelated && (
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
            <CheckCircle2 size={15} style={{ color: 'var(--risk-low)' }} />
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Related Existing Test Files
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {relatedTests.map((rt, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 4,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.75rem',
                  color: 'var(--text-primary)',
                }}
              >
                <Check size={13} style={{ color: 'var(--risk-low)' }} />
                <span>{rt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
