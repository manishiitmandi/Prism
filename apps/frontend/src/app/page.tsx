'use client';

import { useState, useEffect } from 'react';
import { api, Repository } from '@/lib/api';
import { formatTimeAgo } from '@/lib/utils';
import Link from 'next/link';
import NavBar from '@/components/NavBar';

export default function HomePage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [owner, setOwner] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    loadRepos();
  }, []);

  async function loadRepos() {
    try {
      setLoading(true);
      const data = await api.listRepositories();
      setRepos(data);
    } catch {
      setError('Failed to connect to backend. Make sure PRism API is running.');
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
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add repository');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="page-wrapper" suppressHydrationWarning>
      <NavBar badge="BETA" subtitle="AI Pull Request Risk Analyzer" />

      <main className="container" style={{ paddingTop: 48, paddingBottom: 64, flex: 1 }}>
        {/* Hero */}
        <div style={{ marginBottom: 48, textAlign: 'center', position: 'relative' }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--gradient-glow)',
            pointerEvents: 'none',
          }} />
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--accent-glow)',
            border: '1px solid rgba(108,99,255,0.2)',
            borderRadius: 100,
            padding: '4px 14px',
            marginBottom: 20,
            fontSize: '0.8rem',
            color: 'var(--accent-secondary)',
            fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-secondary)', display: 'inline-block' }} />
            Static Analysis + AI Reasoning
          </div>
          <h1 className="text-gradient" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', marginBottom: 16 }}>
            Know your PR risk<br />before it hits production
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: 560, margin: '0 auto 32px' }}>
            PRism analyzes GitHub Pull Requests using Tree-sitter static analysis and AI to provide evidence-backed risk reports, impact graphs, and test recommendations.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => setShowAddForm(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Add Repository
          </button>
        </div>

        {/* Add Repository Modal */}
        {showAddForm && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 24,
          }} onClick={() => setShowAddForm(false)}>
            <div className="card animate-fade-in" style={{ padding: 32, width: '100%', maxWidth: 480 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Add GitHub Repository</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)} style={{ padding: '4px 8px', fontSize: '1.2rem' }}>×</button>
              </div>
              <form onSubmit={handleAddRepo} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Owner / Organization</label>
                  <input
                    className="form-input"
                    placeholder="e.g. facebook"
                    value={owner}
                    onChange={e => setOwner(e.target.value)}
                    required
                    id="repo-owner-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Repository Name</label>
                  <input
                    className="form-input"
                    placeholder="e.g. react"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    id="repo-name-input"
                  />
                </div>
                {addError && (
                  <div style={{
                    background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high-border)',
                    borderRadius: 8, padding: '10px 14px', color: 'var(--risk-high)', fontSize: '0.85rem',
                  }}>
                    {addError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={adding} id="add-repo-submit">
                    {adding ? (
                      <>
                        <span className="animate-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} />
                        Adding...
                      </>
                    ) : 'Add Repository'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Repositories */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              Repositories
              {repos.length > 0 && (
                <span style={{ marginLeft: 10, fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                  {repos.length}
                </span>
              )}
            </h2>
            {repos.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddForm(true)} id="add-repo-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Add
              </button>
            )}
          </div>

          {error && (
            <div style={{
              background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high-border)',
              borderRadius: 12, padding: '20px 24px', color: 'var(--risk-high)', marginBottom: 24,
            }}>
              <strong>Connection Error:</strong> {error}
              <p style={{ marginTop: 8, fontSize: '0.85rem', opacity: 0.8 }}>
                Start the backend with: <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '1px 6px', borderRadius: 4 }}>cd apps/backend && uvicorn app.main:app</code>
              </p>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'grid', gap: 16 }}>
              {[1,2,3].map(i => (
                <div key={i} className="card" style={{ padding: 24 }}>
                  <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 12 }} />
                  <div className="skeleton" style={{ height: 14, width: '40%' }} />
                </div>
              ))}
            </div>
          ) : repos.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>No repositories yet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Add a GitHub repository to start analyzing pull requests</p>
              <button className="btn btn-primary" onClick={() => setShowAddForm(true)} id="first-add-repo-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Add First Repository
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {repos.map(repo => (
                <Link key={repo.id} href={`/repositories/${repo.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card card-interactive" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                          </svg>
                          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                            {repo.full_name}
                          </span>
                          {repo.private && (
                            <span style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)' }}>
                              Private
                            </span>
                          )}
                        </div>
                        {repo.description && (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 12, lineHeight: 1.5 }}>
                            {repo.description}
                          </p>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                          {repo.language && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-secondary)', display: 'inline-block' }} />
                              {repo.language}
                            </span>
                          )}
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            ⎇ {repo.default_branch}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} suppressHydrationWarning>
                            Added {formatTimeAgo(repo.created_at)}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Feature highlights */}
        {repos.length === 0 && !loading && !error && (
          <div style={{ marginTop: 64 }}>
            <h3 style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 32 }}>
              How PRism works
            </h3>
            <div className="grid-3" style={{ gap: 16 }}>
              {[
                { icon: '🔍', title: 'Static Analysis', desc: 'Tree-sitter parses your code into a dependency graph — no guessing.' },
                { icon: '⚡', title: 'Impact Analysis', desc: 'Traces which files, functions, and tests are affected by PR changes.' },
                { icon: '🤖', title: 'AI Reasoning', desc: 'LLM reasons over concrete evidence to classify risk and recommend tests.' },
              ].map(f => (
                <div key={f.title} className="card" style={{ padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 12 }}>{f.icon}</div>
                  <h4 style={{ fontWeight: 700, marginBottom: 8 }}>{f.title}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
