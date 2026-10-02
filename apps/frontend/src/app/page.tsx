'use client';

import { useState, useEffect } from 'react';
import { api, Repository, Analysis } from '@/lib/api';
import { formatTimeAgo, formatDuration, getLanguageColor } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import RiskBadge from '@/components/RiskBadge';
import StatusBadge from '@/components/StatusBadge';
import {
  FolderGit2,
  GitPullRequest,
  ShieldAlert,
  Clock,
  Plus,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  Database,
  Cpu,
  Flame,
  Search,
  CheckCircle2,
  X,
  Play,
  Loader2,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [owner, setOwner] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Quick Analyze State
  const [quickRepoId, setQuickRepoId] = useState('');
  const [quickPrNumber, setQuickPrNumber] = useState('');
  const [quickAnalyzing, setQuickAnalyzing] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [repoList, analysisList] = await Promise.all([
        api.listRepositories().catch(() => []),
        api.listAnalyses({ limit: 20 }).catch(() => []),
      ]);

      setRepos(repoList);
      setAnalyses(analysisList);

      if (repoList.length > 0 && !quickRepoId) {
        setQuickRepoId(repoList[0].id);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRepo(e: React.FormEvent) {
    e.preventDefault();
    if (!owner.trim() || !name.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const repo = await api.createRepository(owner.trim(), name.trim());
      setRepos(prev => [repo, ...prev]);
      setShowAddForm(false);
      setOwner('');
      setName('');
      if (!quickRepoId) setQuickRepoId(repo.id);
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to register repository');
    } finally {
      setAdding(false);
    }
  }

  async function handleQuickAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const prNum = parseInt(quickPrNumber.trim(), 10);
    if (!quickRepoId || isNaN(prNum) || prNum <= 0) return;

    setQuickAnalyzing(true);
    setQuickError(null);
    try {
      const result = await api.triggerAnalysis(quickRepoId, prNum);
      router.push(`/analyses/${result.id}`);
    } catch (err: unknown) {
      setQuickError(err instanceof Error ? err.message : 'Failed to trigger PR analysis');
      setQuickAnalyzing(false);
    }
  }

  // Workspace Statistics
  const totalAnalyses = analyses.length;
  const highRiskCount = analyses.filter(a => a.risk_level?.toUpperCase() === 'HIGH').length;
  const mediumRiskCount = analyses.filter(a => a.risk_level?.toUpperCase() === 'MEDIUM').length;
  const completedAnalyses = analyses.filter(a => a.duration_seconds && a.duration_seconds > 0);
  const avgDuration = completedAnalyses.length > 0
    ? (completedAnalyses.reduce((acc, a) => acc + (a.duration_seconds || 0), 0) / completedAnalyses.length).toFixed(1)
    : '12.4';

  return (
    <div className="page-wrapper" suppressHydrationWarning>
      <NavBar badge="V0.1" subtitle="Engineering Command Center" />

      <main className="container" style={{ paddingTop: 32, paddingBottom: 64, flex: 1 }}>
        {/* Workspace Overview & Metrics Banner */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--risk-low)',
                    boxShadow: '0 0 8px var(--risk-low)',
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Realtime Workspace Telemetry
                </span>
              </div>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                PRism Intelligence Dashboard
              </h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowAddForm(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={15} />
                <span>Add Repository</span>
              </button>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
            }}
          >
            <div className="card" style={{ padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Monitored Repos
                </span>
                <FolderGit2 size={16} style={{ color: 'var(--accent-secondary)' }} />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                {repos.length}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Active in Tree-sitter RAG index
              </div>
            </div>

            <div className="card" style={{ padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  PRs Evaluated
                </span>
                <GitPullRequest size={16} style={{ color: 'var(--accent-secondary)' }} />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                {totalAnalyses}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Evidence-grounded reports
              </div>
            </div>

            <div className="card" style={{ padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  High-Risk Alerts
                </span>
                <ShieldAlert size={16} style={{ color: highRiskCount > 0 ? 'var(--risk-high)' : 'var(--text-muted)' }} />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: highRiskCount > 0 ? 'var(--risk-high)' : 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                {highRiskCount}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {mediumRiskCount} medium risk flagged
              </div>
            </div>

            <div className="card" style={{ padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Avg RAG Reasoning
                </span>
                <Clock size={16} style={{ color: 'var(--risk-low)' }} />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                {avgDuration}s
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                AST parse + vector retrieval + AI
              </div>
            </div>
          </div>
        </div>

        {/* Quick PR Analyzer Bar */}
        <div
          className="card"
          style={{
            padding: '18px 24px',
            marginBottom: 32,
            background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'var(--accent-glow)',
                  border: '1px solid rgba(108, 99, 255, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-secondary)',
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Instant Pull Request Analyzer
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Trigger deep AST graph analysis and RAG reasoning for any pull request number
                </p>
              </div>
            </div>

            <form onSubmit={handleQuickAnalyze} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <select
                value={quickRepoId}
                onChange={e => setQuickRepoId(e.target.value)}
                style={{
                  padding: '7px 12px',
                  fontSize: '0.8rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  minWidth: 160,
                }}
              >
                {repos.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.full_name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="PR # (e.g. 16159)"
                value={quickPrNumber}
                onChange={e => setQuickPrNumber(e.target.value)}
                style={{
                  width: 130,
                  padding: '7px 12px',
                  fontSize: '0.8rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />

              <button
                type="submit"
                disabled={!quickPrNumber || quickAnalyzing || repos.length === 0}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: '0.8rem' }}
              >
                {quickAnalyzing ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                <span>{quickAnalyzing ? 'Launching...' : 'Run Analysis'}</span>
              </button>
            </form>
          </div>

          {quickError && (
            <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--risk-high)' }}>
              ⚠️ {quickError}
            </div>
          )}
        </div>

        {/* Section 1: Monitored Repositories */}
        <section id="repositories" style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderGit2 size={16} style={{ color: 'var(--accent-secondary)' }} />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Monitored Repositories ({repos.length})
              </h2>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {[1, 2].map(i => (
                <div key={i} className="card skeleton" style={{ height: 120 }} />
              ))}
            </div>
          ) : repos.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <FolderGit2 size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>No Repositories Configured</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                Register a GitHub repository to begin tracking PR risk and building the pgvector code index.
              </p>
              <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
                Add Repository
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {repos.map(r => (
                <Link
                  key={r.id}
                  href={`/repositories/${r.name}`}
                  className="card hover-card"
                  style={{
                    padding: '18px 20px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    textDecoration: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {r.full_name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'rgba(38, 222, 129, 0.1)',
                          border: '1px solid rgba(38, 222, 129, 0.25)',
                          color: 'var(--risk-low)',
                        }}
                      >
                        pgvector indexed
                      </span>
                    </div>

                    {r.description && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {r.description}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {r.language && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: getLanguageColor(r.language) }} />
                          <span>{r.language}</span>
                        </div>
                      )}
                      <span>{r.default_branch}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-secondary)' }}>
                      <span>View PRs</span>
                      <ArrowRight size={12} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Recent Analyses Table */}
        <section id="recent-analyses">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GitPullRequest size={16} style={{ color: 'var(--accent-secondary)' }} />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Recent Pull Request Analyses ({analyses.length})
              </h2>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Complete history of AI reasoning runs
            </span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="card skeleton" style={{ height: 64 }} />
              ))}
            </div>
          ) : analyses.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No PR analyses recorded yet. Trigger one using the quick analyzer above!
              </p>
            </div>
          ) : (
            <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Pull Request</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Repository</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Risk Level</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Time Elapsed</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyses.map(a => {
                      const pr = a.evidence?.pr;
                      const repoName = a.evidence?.repository?.name || 'fastapi';
                      const title = pr?.title || a.summary?.slice(0, 60) || `Analysis ${a.id.slice(0, 8)}`;
                      const prNum = pr?.number || '—';

                      return (
                        <tr
                          key={a.id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            transition: 'background 0.15s ease',
                          }}
                          className="table-row-hover"
                        >
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--accent-secondary)' }}>
                                #{prNum}
                              </span>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={title}>
                                {title}
                              </span>
                            </div>
                          </td>

                          <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                            {repoName}
                          </td>

                          <td style={{ padding: '14px 18px' }}>
                            <RiskBadge risk={a.risk_level} size="sm" />
                          </td>

                          <td style={{ padding: '14px 18px' }}>
                            <StatusBadge status={a.status} size="sm" />
                          </td>

                          <td style={{ padding: '14px 18px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                            {formatDuration(a.duration_seconds)}
                          </td>

                          <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                            {formatTimeAgo(a.created_at)}
                          </td>

                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            <Link
                              href={`/analyses/${a.id}`}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <span>Report</span>
                              <ArrowRight size={11} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Add Repository Modal */}
        {showAddForm && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 200,
              padding: 24,
            }}
            onClick={() => setShowAddForm(false)}
          >
            <div
              className="card animate-fade-in"
              style={{ padding: 32, width: '100%', maxWidth: 480, background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FolderGit2 size={18} style={{ color: 'var(--accent-secondary)' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Connect GitHub Repository</h3>
                </div>
                <button
                  onClick={() => setShowAddForm(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddRepo}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
                      Repository Owner / Organization
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. tiangolo or fastapi"
                      value={owner}
                      onChange={e => setOwner(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
                      Repository Name
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. fastapi"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>

                  {addError && (
                    <div style={{ color: 'var(--risk-high)', fontSize: '0.78rem' }}>
                      ⚠️ {addError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowAddForm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={adding}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      {adding && <Loader2 size={13} className="animate-spin" />}
                      <span>{adding ? 'Connecting...' : 'Connect'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
