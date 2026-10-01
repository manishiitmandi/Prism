'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { api, Analysis } from '@/lib/api';
import Link from 'next/link';
import {
  getRiskBadgeClass, getStatusColor, getStatusLabel,
  isTerminalStatus, formatDuration, getLanguageColor, truncatePath
} from '@/lib/utils';

interface Props { params: Promise<{ id: string }> }

const PIPELINE_STEPS = [
  { key: 'QUEUED', label: 'Queued' },
  { key: 'CLONING', label: 'Fetch PR' },
  { key: 'PARSING', label: 'Parse Code' },
  { key: 'ANALYZING', label: 'Impact' },
  { key: 'RETRIEVING', label: 'Evidence' },
  { key: 'AI_ANALYSIS', label: 'AI Analysis' },
  { key: 'COMPLETED', label: 'Complete' },
];

const STATUS_ORDER = ['QUEUED','CLONING','PARSING','ANALYZING','RETRIEVING','AI_ANALYSIS','COMPLETED'];

export default function AnalysisPage({ params }: Props) {
  const { id } = use(params);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview'|'impact'|'tests'|'evidence'>('overview');

  const pollAnalysis = useCallback(async () => {
    try {
      const data = await api.getAnalysis(id);
      setAnalysis(data);
      return data;
    } catch {
      return null;
    }
  }, [id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    async function init() {
      const data = await pollAnalysis();
      setLoading(false);
      if (data && !isTerminalStatus(data.status)) {
        interval = setInterval(async () => {
          const updated = await pollAnalysis();
          if (updated && isTerminalStatus(updated.status)) {
            clearInterval(interval);
          }
        }, 2500);
      }
    }
    
    init();
    return () => clearInterval(interval);
  }, [pollAnalysis]);

  if (loading) {
    return (
      <Shell>
        <div style={{ paddingTop: 48 }}>
          <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 48, width: '60%', marginBottom: 32 }} />
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      </Shell>
    );
  }

  if (!analysis) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
          <h2>Analysis not found</h2>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>← Back to Dashboard</Link>
        </div>
      </Shell>
    );
  }

  const currentStepIdx = STATUS_ORDER.indexOf(analysis.status);
  const isRunning = !isTerminalStatus(analysis.status);
  const isFailed = analysis.status === 'FAILED';

  return (
    <Shell>
      <div style={{ paddingTop: 32, paddingBottom: 64 }}>
        {/* Back */}
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 24, textDecoration: 'none' }}
              className="btn btn-ghost btn-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          Back
        </Link>

        {/* Header */}
        <div className="card animate-fade-in" style={{ padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Analysis</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{id.slice(0,8)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>PR Risk Report</h1>
                {analysis.risk_level && (
                  <span className={getRiskBadgeClass(analysis.risk_level)} style={{ fontSize: '0.8rem', padding: '4px 14px' }}>
                    {analysis.risk_level} RISK
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="status-dot" style={{ background: getStatusColor(analysis.status) }} />
                {isRunning && <span className="status-dot status-dot-pulse" style={{ background: getStatusColor(analysis.status), position: 'absolute', opacity: 0.4 }} />}
                <span style={{ fontSize: '0.85rem', color: getStatusColor(analysis.status), fontWeight: 600 }}>
                  {getStatusLabel(analysis.status)}
                </span>
              </div>
              {analysis.duration_seconds && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {formatDuration(analysis.duration_seconds)}
                </span>
              )}
            </div>
          </div>

          {/* Pipeline progress */}
          <div style={{ marginTop: 24, overflowX: 'auto', paddingBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content', gap: 0 }}>
              {PIPELINE_STEPS.map((step, i) => {
                const stepIdx = STATUS_ORDER.indexOf(step.key);
                const isDone = isFailed ? false : (stepIdx < currentStepIdx || analysis.status === 'COMPLETED');
                const isCurrent = stepIdx === currentStepIdx && !isFailed;
                const color = isFailed && isCurrent ? 'var(--risk-high)' : isDone ? 'var(--risk-low)' : isCurrent ? 'var(--accent-secondary)' : 'var(--text-muted)';
                
                return (
                  <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: isDone ? 'rgba(38,222,129,0.15)' : isCurrent ? 'rgba(108,99,255,0.15)' : 'var(--bg-elevated)',
                        border: `2px solid ${color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.3s',
                        position: 'relative',
                      }}>
                        {isDone ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--risk-low)" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                        ) : isCurrent && isRunning ? (
                          <span className="animate-spin" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid rgba(168,139,250,0.3)', borderTopColor: 'var(--accent-secondary)', borderRadius: '50%' }} />
                        ) : (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                        )}
                      </div>
                      <span style={{ fontSize: '0.65rem', color, fontWeight: 600, whiteSpace: 'nowrap' }}>{step.label}</span>
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div style={{ width: 32, height: 2, background: isDone ? 'var(--risk-low)' : 'var(--border)', marginBottom: 20, transition: 'background 0.3s' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {isFailed && analysis.error_message && (
            <div style={{ marginTop: 16, background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high-border)', borderRadius: 8, padding: '12px 16px', color: 'var(--risk-high)', fontSize: '0.85rem' }}>
              <strong>Error:</strong> {analysis.error_message}
            </div>
          )}

          {/* Running message */}
          {isRunning && (
            <div style={{ marginTop: 16, background: 'var(--accent-glow)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 8, padding: '10px 16px', color: 'var(--accent-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="animate-spin" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(168,139,250,0.3)', borderTopColor: 'var(--accent-secondary)', borderRadius: '50%', flexShrink: 0 }} />
              Analysis in progress — page auto-updates every 2.5s
            </div>
          )}
        </div>

        {/* Summary */}
        {analysis.summary && (
          <div className="card animate-fade-in" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Summary</h3>
            <p style={{ color: 'var(--text-primary)', lineHeight: 1.7, fontSize: '0.95rem' }}>{analysis.summary}</p>
          </div>
        )}

        {/* Stats row */}
        {analysis.dependency_metrics && (
          <div className="grid-4 animate-fade-in" style={{ marginBottom: 24 }}>
            {[
              { label: 'Changed Files', value: analysis.changed_files_data?.length ?? '—' },
              { label: 'Changed Symbols', value: analysis.changed_symbols?.length ?? '—' },
              { label: 'Affected Components', value: analysis.dependency_metrics.direct_dependents ?? '—' },
              { label: 'Related Tests', value: analysis.dependency_metrics.affected_tests ?? '—' },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        {analysis.status === 'COMPLETED' && (
          <div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 1 }}>
              {(['overview','impact','tests','evidence'] as const).map(tab => (
                <button
                  key={tab}
                  id={`tab-${tab}`}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 20px',
                    background: 'none',
                    border: 'none',
                    borderBottom: `2px solid ${activeTab === tab ? 'var(--accent-primary)' : 'transparent'}`,
                    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: activeTab === tab ? 700 : 500,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    marginBottom: -1,
                    transition: 'all 0.15s',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="animate-fade-in">
              {activeTab === 'overview' && <OverviewTab analysis={analysis} />}
              {activeTab === 'impact' && <ImpactTab analysis={analysis} />}
              {activeTab === 'tests' && <TestsTab analysis={analysis} />}
              {activeTab === 'evidence' && <EvidenceTab analysis={analysis} />}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

// ─── Tab Components ───────────────────────────────────────────────────────────

function OverviewTab({ analysis }: { analysis: Analysis }) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Risk Factors */}
      {analysis.risk_factors && analysis.risk_factors.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.1rem' }}>⚠</span> Risk Factors
          </h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {analysis.risk_factors.map((rf, i) => (
              <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: '0.9rem' }}>{rf.title}</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: rf.evidence?.length ? 10 : 0 }}>{rf.description}</p>
                {rf.evidence?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {rf.evidence.map((e, j) => (
                      <span key={j} className="tag">{truncatePath(e)}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signals */}
      {analysis.dependency_metrics && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Risk Signals</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {[
              { label: 'Public API Changed', value: analysis.dependency_metrics.public_api_changed },
              { label: 'Database Modified', value: analysis.dependency_metrics.database_changed },
              { label: 'Auth Code Modified', value: analysis.dependency_metrics.auth_changed },
              { label: 'Payment Code Modified', value: analysis.dependency_metrics.payment_changed },
              { label: 'Config Changed', value: analysis.dependency_metrics.config_changed },
              { label: 'Tests Absent', value: analysis.dependency_metrics.tests_absent },
            ].map(sig => (
              <div key={sig.label} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: sig.value ? 'rgba(255,77,109,0.08)' : 'var(--bg-elevated)',
                border: `1px solid ${sig.value ? 'rgba(255,77,109,0.2)' : 'var(--border)'}`,
                borderRadius: 8,
              }}>
                <span style={{ fontSize: '0.9rem' }}>{sig.value ? '🔴' : '🟢'}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: sig.value ? 'var(--risk-high)' : 'var(--text-secondary)' }}>
                  {sig.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edge Cases */}
      {analysis.edge_cases && analysis.edge_cases.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>⟐ Edge Cases to Consider</h3>
          <ul style={{ paddingLeft: 20, display: 'grid', gap: 8 }}>
            {analysis.edge_cases.map((ec, i) => (
              <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>{ec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ImpactTab({ analysis }: { analysis: Analysis }) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Changed Files */}
      {analysis.changed_files_data && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Changed Files</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {analysis.changed_files_data.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.language ? getLanguageColor(f.language) : 'var(--text-muted)', flexShrink: 0, marginTop: 6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{f.path}</span>
                    {f.language && <span className="badge badge-neutral" style={{ fontSize: '0.62rem' }}>{f.language}</span>}
                    <span className="tag-added" style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(38,222,129,0.08)', color: '#26de81', border: '1px solid rgba(38,222,129,0.2)' }}>+{f.added_lines}</span>
                    <span className="tag-removed" style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(255,77,109,0.08)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.2)' }}>-{f.removed_lines}</span>
                  </div>
                  {f.changed_symbols?.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                      {f.changed_symbols.map((s, j) => (
                        <span key={j} className="tag">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Affected Components */}
      {analysis.affected_components && analysis.affected_components.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Affected Components</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {analysis.affected_components.map((comp, i) => (
              <div key={i} style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4, color: 'var(--accent-secondary)' }}>
                  {comp.component}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{comp.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Changed Symbols */}
      {analysis.changed_symbols && analysis.changed_symbols.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Changed Symbols</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {analysis.changed_symbols.map((s, i) => (
              <span key={i} className="tag">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TestsTab({ analysis }: { analysis: Analysis }) {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Recommended Tests */}
      {analysis.recommended_tests && analysis.recommended_tests.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Recommended Tests</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {analysis.recommended_tests.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)', alignItems: 'flex-start' }}>
                <span className={`badge badge-${t.priority.toLowerCase()}`} style={{ flexShrink: 0, marginTop: 2 }}>
                  {t.priority}
                </span>
                <div>
                  <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>{t.test_name}</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Tests Found */}
      {analysis.related_tests && analysis.related_tests.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Related Tests Detected</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {analysis.related_tests.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--risk-low)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                <span className="font-mono" style={{ fontSize: '0.82rem' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.related_tests?.length === 0 && analysis.recommended_tests?.length === 0 && (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>No test information available</p>
        </div>
      )}
    </div>
  );
}

function EvidenceTab({ analysis }: { analysis: Analysis }) {
  const evidence = analysis.evidence as Record<string, unknown> | null;
  if (!evidence) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No evidence package available</div>;

  const relevantCode = evidence.relevant_code as Array<{file: string; symbol: string; code: string; start_line: number; end_line: number}> | undefined;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Code Snippets */}
      {relevantCode && relevantCode.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Code Evidence</h3>
          <div style={{ display: 'grid', gap: 16 }}>
            {relevantCode.map((snippet, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: 'var(--bg-elevated)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
                  <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--accent-secondary)' }}>{snippet.file}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>lines {snippet.start_line}–{snippet.end_line}</span>
                  <span className="font-mono" style={{ fontSize: '0.75rem', background: 'var(--accent-glow)', color: 'var(--accent-secondary)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 4, padding: '0 6px' }}>{snippet.symbol}</span>
                </div>
                <pre className="code-block" style={{ margin: 0, borderRadius: 0, border: 'none', maxHeight: 300, overflow: 'auto' }}>
                  {snippet.code}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw metrics */}
      {analysis.dependency_metrics && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Dependency Metrics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {Object.entries(analysis.dependency_metrics).map(([k, v]) => (
              <div key={k} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  {k.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: typeof v === 'boolean' ? (v ? 'var(--risk-high)' : 'var(--risk-low)') : 'var(--text-primary)' }}>
                  {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-wrapper">
      <nav style={{ borderBottom: '1px solid var(--border)', background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 60 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'var(--text-primary)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800, color: 'white', boxShadow: 'var(--shadow-glow)' }}>P</div>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>PRism</span>
          </Link>
        </div>
      </nav>
      <main className="container">{children}</main>
    </div>
  );
}
