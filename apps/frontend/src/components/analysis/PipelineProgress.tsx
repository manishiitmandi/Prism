'use client';

import { Check, Loader2, X, CircleDot } from 'lucide-react';
import { isTerminalStatus } from '@/lib/utils';

interface PipelineProgressProps {
  status: string;
}

const STEPS = [
  { key: 'QUEUED', label: 'Queued', desc: 'Job initialized' },
  { key: 'CLONING', label: 'Fetch PR', desc: 'Pulling git diff' },
  { key: 'PARSING', label: 'Syntax Parsing', desc: 'Code scope analysis' },
  { key: 'ANALYZING', label: 'Call Graph', desc: 'Impact reachability' },
  { key: 'RETRIEVING', label: 'Context Retrieval', desc: 'Semantic & code graph' },
  { key: 'AI_ANALYSIS', label: 'Risk Evaluation', desc: 'Safety guardrails' },
  { key: 'COMPLETED', label: 'Report Ready', desc: 'Risk evaluated' },
];

const ORDER = ['QUEUED', 'CLONING', 'PARSING', 'ANALYZING', 'RETRIEVING', 'AI_ANALYSIS', 'COMPLETED'];

export default function PipelineProgress({ status }: PipelineProgressProps) {
  const currentIdx = ORDER.indexOf(status.toUpperCase());
  const isFailed = status.toUpperCase() === 'FAILED';
  const isCompleted = status.toUpperCase() === 'COMPLETED';

  return (
    <div
      className="card"
      style={{
        padding: '16px 20px',
        marginBottom: 24,
        background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CircleDot size={14} style={{ color: 'var(--accent-secondary)' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
            Analysis Pipeline Execution
          </span>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: isFailed ? 'var(--risk-high)' : isCompleted ? 'var(--risk-low)' : 'var(--accent-secondary)',
            fontWeight: 600,
          }}
        >
          {isFailed ? 'PIPELINE FAILED' : isCompleted ? 'ALL PHASES COMPLETED' : `PHASE ${currentIdx + 1} OF ${STEPS.length}`}
        </span>
      </div>

      <div className="pipeline-grid-responsive" style={{ position: 'relative' }}>
        {STEPS.map((step, idx) => {
          const isDone = isCompleted || (!isFailed && currentIdx > idx);
          const isActive = !isFailed && currentIdx === idx && !isCompleted;
          const isStepFailed = isFailed && currentIdx === idx;

          return (
            <div
              key={step.key}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                position: 'relative',
              }}
            >
              {/* Progress Bar Segment */}
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: isDone
                    ? 'var(--risk-low)'
                    : isActive
                    ? 'var(--gradient-primary)'
                    : isStepFailed
                    ? 'var(--risk-high)'
                    : 'var(--border-subtle)',
                  boxShadow: isActive
                    ? '0 0 10px rgba(108, 99, 255, 0.6)'
                    : isDone
                    ? '0 0 6px rgba(38, 222, 129, 0.3)'
                    : undefined,
                  transition: 'all 0.3s ease',
                }}
              />

              {/* Step info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    background: isDone
                      ? 'rgba(38, 222, 129, 0.15)'
                      : isActive
                      ? 'rgba(108, 99, 255, 0.2)'
                      : isStepFailed
                      ? 'rgba(255, 77, 109, 0.15)'
                      : 'var(--bg-elevated)',
                    color: isDone
                      ? 'var(--risk-low)'
                      : isActive
                      ? 'var(--accent-secondary)'
                      : isStepFailed
                      ? 'var(--risk-high)'
                      : 'var(--text-muted)',
                    border: `1px solid ${
                      isDone
                        ? 'rgba(38, 222, 129, 0.3)'
                        : isActive
                        ? 'rgba(108, 99, 255, 0.4)'
                        : isStepFailed
                        ? 'rgba(255, 77, 109, 0.4)'
                        : 'var(--border)'
                    }`,
                  }}
                >
                  {isDone ? (
                    <Check size={11} strokeWidth={3} />
                  ) : isActive ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : isStepFailed ? (
                    <X size={11} strokeWidth={3} />
                  ) : (
                    idx + 1
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: '0.725rem',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive
                        ? 'var(--text-primary)'
                        : isDone
                        ? 'var(--text-secondary)'
                        : 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {step.label}
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {step.desc}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
