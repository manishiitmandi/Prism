'use client';

import { useState, useEffect, use } from 'react';
import { api, Repository, PullRequest, Analysis } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import Breadcrumbs from '@/components/Breadcrumbs';
import RiskBadge from '@/components/RiskBadge';
import StatusBadge from '@/components/StatusBadge';
import { formatTimeAgo, getLanguageColor } from '@/lib/utils';
import {
  GitPullRequest,
  GitBranch,
  ExternalLink,
  Layers,
  Sparkles,
  Database,
  Cpu,
  Clock,
  ArrowRight,
  Plus,
  Play,
  Loader2,
  AlertTriangle,
  FolderGit2,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default function RepositoryPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [prsLoading, setPrsLoading] = useState(false);
  const [analyzingPr, setAnalyzingPr] = useState<number | null>(null);
  const [customPrNumber, setCustomPrNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const r = await api.getRepository(id);
      setRepo(r);

      // Load PRs and Analyses in parallel
      loadPRs(r.id);
      loadAnalyses(r.id);
    } catch {
      setError('Repository not found');
    } finally {
      setLoading(false);
    }
  }

  async function loadPRs(repoId: string) {
    setPrsLoading(true);
    try {
      const data = await api.listPullRequests(repoId);
      setPrs(data);
    } catch {
      // GitHub API or mock fallback
    } finally {
      setPrsLoading(false);
    }
  }

  async function loadAnalyses(repoId: string) {
    try {
      const list = await api.listAnalyses({ repositoryId: repoId });
      setAnalyses(list);
    } catch {
      // ignore
    }
  }

  async function handleAnalyze(prNumber: number) {
    if (!repo) return;
    setAnalyzingPr(prNumber);
    try {
      const result = await api.triggerAnalysis(repo.id, prNumber);
      router.push(`/analyses/${result.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to trigger analysis');
      setAnalyzingPr(null);
    }
  }

  const handleCustomAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(customPrNumber.trim(), 10);
    if (!isNaN(num) && num > 0) {
      handleAnalyze(num);
    }
  };

  // Map PR number to existing completed/running analysis
  const prAnalysisMap = new Map<number, Analysis>();
  analyses.forEach(a => {
    const prNum = a.evidence?.pr?.number;
    if (prNum && !prAnalysisMap.has(prNum)) {
      prAnalysisMap.set(prNum, a);
    }
  });

  if (loading) {
    return (
      <div className="page-wrapper">
        <NavBar />
        <main className="container" style={{ paddingTop: 32, paddingBottom: 64 }}>
          <div className="skeleton" style={{ height: 20, width: 240, marginBottom: 20 }} />
          <div className="card skeleton" style={{ height: 160, marginBottom: 24 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            <div className="card skeleton" style={{ height: 400 }} />
            <div className="card skeleton" style={{ height: 400 }} />
          </div>
        </main>
      </div>
    );
  }

  if (error && !repo) {
    return (
      <div className="page-wrapper">
        <NavBar />
        <main className="container" style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--risk-high)' }}>
            <AlertTriangle size={28} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>{error}</h2>
          <Link href="/" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: 16 }}>
            ← Back to Repositories
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <NavBar subtitle={repo?.full_name} badge="REPOSITORY" />

      <main className="container" style={{ paddingTop: 28, paddingBottom: 64, flex: 1 }}>
        <Breadcrumbs
          items={[
            { label: 'Repositories', href: '/#repositories' },
            { label: repo?.full_name || repo?.name || 'Repository' },
          ]}
        />

        {/* Repository Header Card */}
        <div
          className="card"
          style={{
            padding: '24px 28px',
            marginBottom: 24,
            background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <FolderGit2 size={20} style={{ color: 'var(--accent-secondary)' }} />
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {repo?.full_name}
                </h1>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: '2px 8px',
                    borderRadius: 100,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {repo?.private ? 'Private' : 'Public'}
                </span>
              </div>

              {repo?.description && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 14, maxWidth: 640 }}>
                  {repo.description}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <GitBranch size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{repo?.default_branch || 'main'}</span>
                </div>

                {repo?.language && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: getLanguageColor(repo.language) }} />
                    <span>{repo.language}</span>
                  </div>
                )}

                <a
                  href={`https://github.com/${repo?.full_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: 'var(--accent-secondary)',
                    textDecoration: 'none',
                  }}
                >
                  <span>GitHub Repo</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Quick Trigger Any PR Box */}
            <form
              onSubmit={handleCustomAnalyze}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-elevated)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <GitPullRequest size={14} style={{ color: 'var(--accent-secondary)' }} />
                <input
                  type="number"
                  placeholder="PR # (e.g. 16437)"
                  value={customPrNumber}
                  onChange={e => setCustomPrNumber(e.target.value)}
                  style={{
                    width: 140,
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={!customPrNumber || analyzingPr !== null}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px' }}
              >
                {analyzingPr !== null ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                <span>Analyze</span>
              </button>
            </form>
          </div>
        </div>

        {/* 2-Column Main Layout: PRs List & Code Intelligence Sidebar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
          {/* Left Column: Active Pull Requests */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GitPullRequest size={16} style={{ color: 'var(--accent-secondary)' }} />
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Pull Requests ({prs.length})
                </h2>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Select a PR to inspect risk reports or trigger new analysis
              </span>
            </div>

            {prsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} className="card skeleton" style={{ height: 100 }} />
                ))}
              </div>
            ) : prs.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <GitPullRequest size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>No Open Pull Requests Found</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto 16px' }}>
                  Use the quick trigger box above to analyze any PR number directly from GitHub.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {prs.map(pr => {
                  const existingAnalysis = prAnalysisMap.get(pr.number);
                  const isCurrentAnalyzing = analyzingPr === pr.number;

                  return (
                    <div
                      key={pr.number}
                      className="card hover-card"
                      style={{
                        padding: '16px 20px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-secondary)' }}>
                            #{pr.number}
                          </span>

                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                            {pr.title}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.75rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                          <span>by {pr.author}</span>

                          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {pr.base_branch} ← {pr.head_branch}
                          </span>

                          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            <span style={{ color: 'var(--risk-low)', fontWeight: 600 }}>+{pr.additions}</span>{' '}
                            <span style={{ color: 'var(--risk-high)', fontWeight: 600 }}>-{pr.deletions}</span>
                          </span>

                          <span>{formatTimeAgo(pr.created_at)}</span>
                        </div>
                      </div>

                      {/* Right: Analysis Action or Report Link */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {existingAnalysis ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <RiskBadge risk={existingAnalysis.risk_level} size="sm" />
                            <Link
                              href={`/analyses/${existingAnalysis.id}`}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <span>Report</span>
                              <ArrowRight size={12} />
                            </Link>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAnalyze(pr.number)}
                            disabled={isCurrentAnalyzing}
                            className="btn btn-primary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            {isCurrentAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                            <span>{isCurrentAnalyzing ? 'Analyzing...' : 'Analyze'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Code Intelligence & Architecture Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* RAG & Embeddings Intelligence Card */}
            <div
              className="card"
              style={{
                padding: '20px 22px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Sparkles size={16} style={{ color: 'var(--accent-secondary)' }} />
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                  Code Intelligence & RAG
                </h3>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
                PRism indexes this repository using Tree-sitter multi-language AST chunking and pgvector semantic embeddings.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Database size={13} style={{ color: 'var(--risk-low)' }} />
                    <span style={{ color: 'var(--text-muted)' }}>Vector Store:</span>
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--risk-low)', fontFamily: "'JetBrains Mono', monospace" }}>
                    pgvector Active
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Cpu size={13} style={{ color: 'var(--accent-secondary)' }} />
                    <span style={{ color: 'var(--text-muted)' }}>AST Engine:</span>
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                    Tree-sitter
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={13} style={{ color: 'var(--status-parsing)' }} />
                    <span style={{ color: 'var(--text-muted)' }}>Embeddings:</span>
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                    gemini-embedding-004
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={13} style={{ color: 'var(--risk-low)' }} />
                    <span style={{ color: 'var(--text-muted)' }}>Call Graph DAG:</span>
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--risk-low)', fontFamily: "'JetBrains Mono', monospace" }}>
                    Direct + Transitive
                  </span>
                </div>
              </div>
            </div>

            {/* Previous Analyses for this repo */}
            {analyses.length > 0 && (
              <div
                className="card"
                style={{
                  padding: '20px 22px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                    Analysis History
                  </h3>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {analyses.length} runs
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {analyses.slice(0, 5).map(a => (
                    <Link
                      key={a.id}
                      href={`/analyses/${a.id}`}
                      style={{
                        padding: '8px 10px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 6,
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textDecoration: 'none',
                      }}
                      className="hover-card"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                          PR #{a.evidence?.pr?.number || '—'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {formatTimeAgo(a.created_at)}
                        </span>
                      </div>

                      <RiskBadge risk={a.risk_level} size="sm" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
