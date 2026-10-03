'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import Breadcrumbs from '@/components/Breadcrumbs';
import RiskBadge from '@/components/RiskBadge';
import { api, UserMonitoredRepo, Repository, Analysis } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatTimeAgo, getLanguageColor } from '@/lib/utils';
import {
  FolderGit2,
  GitPullRequest,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Activity,
  ArrowRight,
  ExternalLink,
  Search,
  Lock,
  Globe,
  Trash2,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  LogIn,
  Layers,
  GitBranch,
  X,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const [monitoredRepos, setMonitoredRepos] = useState<UserMonitoredRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [repoSearch, setRepoSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'PRIVATE' | 'OSS'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Add repo form state
  const [newOwner, setNewOwner] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'tracked_oss' | 'owner'>('tracked_oss');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadMonitoredRepos();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  async function loadMonitoredRepos() {
    try {
      setLoading(true);
      const data = await api.getMonitoredRepositories();
      setMonitoredRepos(data);
    } catch (err) {
      console.error('Failed to load monitored repos:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRepo(e: React.FormEvent) {
    e.preventDefault();
    if (!newOwner.trim() || !newName.trim()) return;

    try {
      setIsAdding(true);
      setAddError(null);
      await api.trackRepository(newOwner.trim(), newName.trim(), newRole);
      setNewOwner('');
      setNewName('');
      setShowAddModal(false);
      await loadMonitoredRepos();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add repository');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleUntrack(repoId: string, repoName: string) {
    if (!confirm(`Remove "${repoName}" from your personal dashboard?`)) return;
    try {
      await api.untrackRepository(repoId);
      setMonitoredRepos(prev => prev.filter(m => m.repository.id !== repoId));
    } catch (err) {
      console.error('Failed to untrack repo:', err);
    }
  }

  // Filtered repositories
  const filteredRepos = monitoredRepos.filter(m => {
    const full = m.repository.full_name.toLowerCase();
    const matchesSearch = full.includes(repoSearch.toLowerCase()) ||
      (m.repository.description?.toLowerCase().includes(repoSearch.toLowerCase()) ?? false);
    if (!matchesSearch) return false;

    if (activeTab === 'PRIVATE') return m.repository.private;
    if (activeTab === 'OSS') return !m.repository.private;
    return true;
  });

  const ossCount = monitoredRepos.filter(m => !m.repository.private).length;
  const privateCount = monitoredRepos.filter(m => m.repository.private).length;

  // Unauthenticated Guard Screen
  if (!authLoading && !user) {
    return (
      <div className="page-wrapper">
        <NavBar subtitle="User Dashboard" />
        <main className="container" style={{ paddingTop: 70, paddingBottom: 80, textAlign: 'center', maxWidth: 580 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(167, 139, 250, 0.3)',
              color: '#c084fc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 30px rgba(99, 102, 241, 0.25)',
            }}
          >
            <Lock size={28} />
          </div>

          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', marginBottom: 12 }}>
            Personal Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: 28 }}>
            Sign in to track your personal GitHub repositories, monitor open-source dependencies, and review prioritized pull request risk reports.
          </p>

          <button
            type="button"
            onClick={openAuthModal}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 24px',
              fontSize: '0.92rem',
              borderRadius: 10,
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
            }}
          >
            <LogIn size={16} />
            <span>Sign In to Access Dashboard</span>
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <NavBar subtitle="Personal Dashboard" badge="WORKSPACE" />

      <main className="container" style={{ paddingTop: 28, paddingBottom: 64, flex: 1 }}>
        <Breadcrumbs
          items={[
            { label: 'Workspace', href: '/' },
            { label: 'Dashboard' },
          ]}
        />

        {/* Dashboard Header Hero Card */}
        <div
          className="hero-command-card"
          style={{
            padding: '26px 30px',
            marginBottom: 28,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    border: '2px solid rgba(255, 255, 255, 0.15)',
                    objectFit: 'cover',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: '#ffffff',
                  }}
                >
                  {user?.username.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>
                    {user?.name ? `${user.name}'s Dashboard` : `@${user?.username}`}
                  </h1>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      padding: '2px 8px',
                      borderRadius: 100,
                      background: user?.auth_provider === 'github' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: user?.auth_provider === 'github' ? '#c084fc' : '#10b981',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {user?.auth_provider} Connected
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: 0 }}>
                  Manage monitored repositories, review incoming pull request risks, and configure codebase tracking.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                borderRadius: 8,
                fontSize: '0.85rem',
                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)',
              }}
            >
              <Plus size={15} />
              <span>Track Repository</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Tiles */}
        <div className="grid-cols-4-responsive" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          <div className="stat-card-pro" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Monitored Repositories
              </span>
              <FolderGit2 size={15} style={{ color: 'var(--accent-secondary)' }} />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
              {monitoredRepos.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              {privateCount} Private · {ossCount} Open Source
            </div>
          </div>

          <div className="stat-card-pro" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Repository Security Mode
              </span>
              <ShieldCheck size={15} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#10b981', fontFamily: "'JetBrains Mono', monospace" }}>
              Active
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              Automated PR risk evaluation enabled
            </div>
          </div>

          <div className="stat-card-pro" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Quick Action
              </span>
              <GitPullRequest size={15} style={{ color: '#38bdf8' }} />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
              Ad-Hoc PR
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              <Link href="/#repositories" style={{ color: 'var(--accent-secondary)', textDecoration: 'none' }}>
                Analyze any public PR →
              </Link>
            </div>
          </div>
        </div>

        {/* Repositories Section */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} style={{ color: 'var(--accent-secondary)' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                My Tracked Repositories
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                ({filteredRepos.length})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Search Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '6px 12px',
                  width: 220,
                }}
              >
                <Search size={13} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter repositories..."
                  value={repoSearch}
                  onChange={e => setRepoSearch(e.target.value)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>

              {/* Tabs */}
              <div className="filter-segmented-pill">
                <button
                  type="button"
                  className={`filter-pill ${activeTab === 'ALL' ? 'active' : ''}`}
                  onClick={() => setActiveTab('ALL')}
                >
                  All ({monitoredRepos.length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${activeTab === 'PRIVATE' ? 'active' : ''}`}
                  onClick={() => setActiveTab('PRIVATE')}
                >
                  Private ({privateCount})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${activeTab === 'OSS' ? 'active' : ''}`}
                  onClick={() => setActiveTab('OSS')}
                >
                  Open Source ({ossCount})
                </button>
              </div>
            </div>
          </div>

          {/* Repos Grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="card skeleton" style={{ height: 160 }} />
              ))}
            </div>
          ) : filteredRepos.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <FolderGit2 size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                {monitoredRepos.length === 0 ? 'No Repositories Tracked Yet' : 'No Matching Repositories'}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 18px', lineHeight: 1.5 }}>
                {monitoredRepos.length === 0
                  ? 'Track open-source dependencies or import your personal repositories to monitor pull request risk.'
                  : 'Try adjusting your search filter above.'}
              </p>
              {monitoredRepos.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} />
                  <span>Track Your First Repository</span>
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
              {filteredRepos.map(m => {
                const r = m.repository;
                return (
                  <div
                    key={m.id}
                    className="card hover-card"
                    style={{
                      padding: '20px 22px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      {/* Top Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 8,
                              background: r.private ? 'rgba(244, 63, 94, 0.12)' : 'rgba(99, 102, 241, 0.15)',
                              border: `1px solid ${r.private ? 'rgba(244, 63, 94, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: r.private ? 'var(--risk-high)' : '#c084fc',
                            }}
                          >
                            {r.private ? <Lock size={15} /> : <FolderGit2 size={15} />}
                          </div>
                          <div>
                            <Link
                              href={`/repositories/${r.name || r.id}`}
                              style={{
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                color: '#ffffff',
                                textDecoration: 'none',
                                display: 'inline-block',
                              }}
                              className="hover-bright"
                            >
                              {r.full_name}
                            </Link>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  fontFamily: "'JetBrains Mono', monospace",
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  background: r.private ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                  border: `1px solid ${r.private ? 'rgba(244, 63, 94, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                                  color: r.private ? 'var(--risk-high)' : '#10b981',
                                  fontWeight: 600,
                                }}
                              >
                                {r.private ? 'Private' : 'Open Source'}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                {m.role === 'owner' ? 'Owner' : 'Tracked'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Untrack Button */}
                        <button
                          type="button"
                          onClick={() => handleUntrack(r.id, r.full_name)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 4,
                            borderRadius: 6,
                          }}
                          title="Untrack from dashboard"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Description */}
                      {r.description && (
                        <p
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.45,
                            marginBottom: 16,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {r.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom Metadata & Link */}
                    <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <GitBranch size={12} />
                          <span>{r.default_branch}</span>
                        </div>
                        {r.language && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: getLanguageColor(r.language) }} />
                            <span>{r.language}</span>
                          </div>
                        )}
                      </div>

                      <Link
                        href={`/repositories/${r.name || r.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.75rem',
                          borderRadius: 6,
                          padding: '5px 12px',
                        }}
                      >
                        <span>Open Repo</span>
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal: Track Repository */}
        {showAddModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              background: 'rgba(5, 6, 10, 0.82)',
              backdropFilter: 'blur(12px)',
            }}
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: 460,
                background: 'var(--bg-elevated)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 18,
                padding: 0,
                overflow: 'hidden',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>
                    <Plus size={16} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                      Track a Repository
                    </h3>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Add an open-source or personal repository to your dashboard
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleAddRepo} style={{ padding: '22px 24px' }}>
                {addError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(244, 63, 94, 0.12)',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                      color: 'var(--risk-high)',
                      fontSize: '0.78rem',
                      marginBottom: 16,
                    }}
                  >
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    <span>{addError}</span>
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Repository Owner or Organization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. fastapi, facebook, or your-username"
                    value={newOwner}
                    onChange={e => setNewOwner(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '0.84rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Repository Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. fastapi, react, or my-repo"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '0.84rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Tracking Mode
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setNewRole('tracked_oss')}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: newRole === 'tracked_oss' ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-secondary)',
                        border: `1px solid ${newRole === 'tracked_oss' ? 'rgba(167, 139, 250, 0.4)' : 'var(--border-subtle)'}`,
                        color: newRole === 'tracked_oss' ? '#ffffff' : 'var(--text-muted)',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Open Source (Public)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRole('owner')}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: newRole === 'owner' ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-secondary)',
                        border: `1px solid ${newRole === 'owner' ? 'rgba(167, 139, 250, 0.4)' : 'var(--border-subtle)'}`,
                        color: newRole === 'owner' ? '#ffffff' : 'var(--text-muted)',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Personal / Team
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAdding}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {isAdding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    <span>{isAdding ? 'Connecting...' : 'Track Repository'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
