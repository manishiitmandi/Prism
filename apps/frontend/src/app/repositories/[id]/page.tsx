'use client';

import { useState, useEffect, use } from 'react';
import { api, Repository, PullRequest } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Props { params: Promise<{ id: string }> }

export default function RepositoryPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [prsLoading, setPrsLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRepo();
  }, [id]);

  async function loadRepo() {
    try {
      const r = await api.getRepository(id);
      setRepo(r);
      loadPRs(r.id);
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
      // GitHub API error — show empty state
    } finally {
      setPrsLoading(false);
    }
  }

  async function handleAnalyze(prNumber: number) {
    if (!repo) return;
    setAnalyzing(prNumber);
    try {
      const result = await api.triggerAnalysis(repo.id, prNumber);
      router.push(`/analyses/${result.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to trigger analysis');
      setAnalyzing(null);
    }
  }

  if (loading) {
    return (
      <div className="page-wrapper">
        <NavBar />
        <div className="container" style={{ paddingTop: 48 }}>
          <div className="skeleton" style={{ height: 28, width: 300, marginBottom: 32 }} />
          <div style={{ display: 'grid', gap: 16 }}>
            {[1,2,3].map(i => <div key={i} className="card skeleton" style={{ height: 100 }} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error && !repo) {
    return (
      <div className="page-wrapper">
        <NavBar />
        <div className="container" style={{ paddingTop: 48 }}>
          <div style={{ textAlign: 'center', padding: 64 }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
            <h2>{error}</h2>
            <Link href="/" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>← Back to Repositories</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <NavBar />
      <main className="container" style={{ paddingTop: 40, paddingBottom: 64 }}>
        {/* Back */}
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 24, textDecoration: 'none' }}
              className="btn btn-ghost btn-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          All Repositories
        </Link>

        {/* Repo header */}
        {repo && (
          <div className="card" style={{ padding: 28, marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem', flexShrink: 0,
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: '1.5rem', marginBottom: 4 }}>{repo.full_name}</h1>
                {repo.description && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 12 }}>{repo.description}</p>}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {repo.language && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent-secondary)', display: 'inline-block' }} />
                      {repo.language}
                    </span>
                  )}
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>⎇ {repo.default_branch}</span>
                  <a href={`https://github.com/${repo.full_name}`} target="_blank" rel="noopener noreferrer"
                     style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    View on GitHub ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PR list */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              Open Pull Requests
              {prs.length > 0 && <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.9rem' }}>{prs.length}</span>}
            </h2>
            <button className="btn btn-ghost btn-sm" onClick={() => repo && loadPRs(repo.id)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
              Refresh
            </button>
          </div>

          {error && (
            <div style={{ background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high-border)', borderRadius: 8, padding: '10px 14px', color: 'var(--risk-high)', fontSize: '0.85rem', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {prsLoading ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {[1,2,3].map(i => <div key={i} className="card skeleton" style={{ height: 80 }} />)}
            </div>
          ) : prs.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12"/>
                </svg>
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>No open pull requests</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>This repository has no open PRs to analyze</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {prs.map(pr => (
                <div key={pr.number} className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-muted)', flexShrink: 0 }}>
                          #{pr.number}
                        </span>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pr.title}
                        </h3>
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{pr.author}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{pr.head_branch} → {pr.base_branch}</span>
                        <span style={{ fontSize: '0.78rem', color: '#26de81' }}>+{pr.additions}</span>
                        <span style={{ fontSize: '0.78rem', color: '#ff4d6d' }}>-{pr.deletions}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{pr.changed_files} files</span>
                      </div>
                    </div>
                    <button
                      id={`analyze-pr-${pr.number}`}
                      className="btn btn-primary btn-sm"
                      style={{ flexShrink: 0 }}
                      onClick={() => handleAnalyze(pr.number)}
                      disabled={analyzing === pr.number}
                    >
                      {analyzing === pr.number ? (
                        <>
                          <span className="animate-spin" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} />
                          Starting...
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          Analyze PR
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function NavBar() {
  return (
    <nav style={{ borderBottom: '1px solid var(--border)', background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 60 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'var(--text-primary)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800, color: 'white', boxShadow: 'var(--shadow-glow)' }}>P</div>
          <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>PRism</span>
        </Link>
      </div>
    </nav>
  );
}
