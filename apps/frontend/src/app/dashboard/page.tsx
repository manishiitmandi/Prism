'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import Breadcrumbs from '@/components/Breadcrumbs';
import UserAvatar from '@/components/UserAvatar';
import RiskBadge from '@/components/RiskBadge';
import { api, UserMonitoredRepo, Analysis } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatTimeAgo, getLanguageColor } from '@/lib/utils';
import {
  FolderGit2,
  GitPullRequest,
  Plus,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Search,
  Lock,
  Trash2,
  Loader2,
  Sparkles,
  AlertTriangle,
  LogIn,
  Layers,
  GitBranch,
  X,
  Play,
  CheckCircle2,
  Star,
} from 'lucide-react';

const SAMPLE_REPOS = [
  {
    owner: 'fastapi',
    name: 'fastapi',
    desc: 'FastAPI framework, high performance, easy to learn, fast to code, ready for production',
    language: 'Python',
    stars: '75k+',
  },
  {
    owner: 'facebook',
    name: 'react',
    desc: 'The library for web and native user interfaces',
    language: 'JavaScript',
    stars: '225k+',
  },
  {
    owner: 'pallets',
    name: 'flask',
    desc: 'The Python micro framework for building web applications',
    language: 'Python',
    stars: '68k+',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [monitoredRepos, setMonitoredRepos] = useState<UserMonitoredRepo[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [repoSearch, setRepoSearch] = useState('');
  const [repoTab, setRepoTab] = useState<'ALL' | 'PRIVATE' | 'OSS'>('ALL');
  const [analysisRiskFilter, setAnalysisRiskFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);

  // Add repo state
  const [newOwner, setNewOwner] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'tracked_oss' | 'owner'>('tracked_oss');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState<string | null>(null);

  // Quick Analyze state
  const [analyzePrUrl, setAnalyzePrUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    } else if (!authLoading) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  async function loadDashboardData() {
    try {
      setLoading(true);
      const [repoData, allAnalyses] = await Promise.all([
        api.getMonitoredRepositories().catch(() => []),
        api.listAnalyses({ limit: 40 }).catch(() => []),
      ]);

      setMonitoredRepos(repoData);

      // Only show analyses belonging to the user's monitored repositories
      if (repoData.length > 0) {
        const userRepoFullNames = new Set(repoData.map(m => m.repository.full_name.toLowerCase()));
        const userRepoNames = new Set(repoData.map(m => m.repository.name.toLowerCase()));
        const filteredAnalyses = allAnalyses.filter(a => {
          const repoFullName = a.evidence?.repository?.full_name?.toLowerCase();
          const repoName = a.evidence?.repository?.name?.toLowerCase();
          if (repoFullName && userRepoFullNames.has(repoFullName)) return true;
          if (repoName && userRepoNames.has(repoName)) return true;
          return false;
        });
        setAnalyses(filteredAnalyses);
      } else {
        // Brand new user starts with 0 analyses
        setAnalyses([]);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
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
      await loadDashboardData();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to connect repository. Please verify the owner and repo name.');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleTrackSample(owner: string, name: string) {
    try {
      setSampleLoading(`${owner}/${name}`);
      await api.trackRepository(owner, name, 'tracked_oss');
      await loadDashboardData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to connect sample repository');
    } finally {
      setSampleLoading(null);
    }
  }

  async function handleUntrack(repoId: string, repoName: string) {
    if (!confirm(`Untrack "${repoName}" from your personal dashboard?`)) return;
    try {
      await api.untrackRepository(repoId);
      setMonitoredRepos(prev => prev.filter(m => m.repository.id !== repoId));
      setAnalyses(prev => prev.filter(a => a.evidence?.repository?.full_name?.toLowerCase() !== repoName.toLowerCase()));
    } catch (err) {
      console.error('Failed to untrack repo:', err);
    }
  }

  async function handleQuickAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setAnalyzeError(null);
    const trimmed = analyzePrUrl.trim();
    if (!trimmed) return;

    // Match GitHub PR URL or shorthand
    const urlMatch = trimmed.match(
      /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)/i
    );
    const shortMatch =
      trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)#(\d+)$/i) ||
      trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)$/i);

    const match = urlMatch || shortMatch;
    if (!match) {
      setAnalyzeError('Please enter a valid GitHub PR URL (e.g. https://github.com/owner/repo/pull/123) or shorthand (owner/repo#123).');
      return;
    }

    const owner = match[1];
    const name = match[2];
    const prNumber = parseInt(match[3], 10);

    try {
      setIsAnalyzing(true);
      const repo = await api.createRepository(owner, name);
      try {
        await api.trackRepository(owner, name, 'tracked_oss');
      } catch {
        // ignore if already tracked
      }
      const res = await api.triggerAnalysis(repo.id, prNumber);
      setShowAnalyzeModal(false);
      router.push(`/analyses/${res.id}`);
    } catch (err: unknown) {
      setAnalyzeError(err instanceof Error ? err.message : 'Failed to trigger pull request analysis');
      setIsAnalyzing(false);
    }
  }

  // Filtered repositories
  const filteredRepos = monitoredRepos.filter(m => {
    const full = m.repository.full_name.toLowerCase();
    const matchesSearch =
      full.includes(repoSearch.toLowerCase()) ||
      (m.repository.description?.toLowerCase().includes(repoSearch.toLowerCase()) ?? false);
    if (!matchesSearch) return false;

    if (repoTab === 'PRIVATE') return m.repository.private;
    if (repoTab === 'OSS') return !m.repository.private;
    return true;
  });

  // Filtered analyses
  const filteredAnalyses = analyses.filter(a => {
    if (analysisRiskFilter === 'ALL') return true;
    return a.risk_level?.toUpperCase() === analysisRiskFilter;
  });

  const ossCount = monitoredRepos.filter(m => !m.repository.private).length;
  const privateCount = monitoredRepos.filter(m => m.repository.private).length;
  const highRiskCount = analyses.filter(a => a.risk_level?.toUpperCase() === 'HIGH').length;

  // If unauthenticated or loading auth, display clean loader while redirecting to landing page
  if (authLoading || !user) {
    return (
      <div className="page-wrapper" style={{ minHeight: '100vh', background: '#080a11', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ minHeight: '100vh', background: '#080a11', color: '#f8fafc' }}>
      <NavBar subtitle="Personal Dashboard" badge="WORKSPACE" />

      <main className="container" style={{ paddingTop: 28, paddingBottom: 80, flex: 1, maxWidth: '1150px' }}>
        <Breadcrumbs
          items={[
            { label: 'Personal Dashboard' },
          ]}
        />

        {/* Dashboard Command Header Card */}
        <div
          style={{
            padding: '26px 30px',
            marginBottom: 28,
            borderRadius: 18,
            background: 'linear-gradient(180deg, rgba(22, 27, 44, 0.85) 0%, rgba(13, 16, 28, 0.95) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <UserAvatar
                avatarUrl={user?.avatar_url}
                name={user?.name}
                username={user?.username}
                size={54}
                borderRadius={14}
                style={{
                  border: '2px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                }}
              />

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>
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
                <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0 }}>
                  Manage monitored repositories, review prioritized pull request risk reports, and configure codebase tracking.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowAnalyzeModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                className="hover-card"
              >
                <GitPullRequest size={15} style={{ color: '#38bdf8' }} />
                <span>Analyze a PR</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  border: '1px solid rgba(167, 139, 250, 0.4)',
                  color: '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)',
                }}
                className="hover-bright"
              >
                <Plus size={15} />
                <span>Connect Repository</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Metric Tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
          <div
            style={{
              padding: '18px 20px',
              borderRadius: 14,
              background: 'rgba(18, 22, 38, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Connected Repositories
              </span>
              <FolderGit2 size={16} style={{ color: '#c084fc' }} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
              {monitoredRepos.length}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 4 }}>
              {privateCount} Private · {ossCount} Open Source
            </div>
          </div>

          <div
            style={{
              padding: '18px 20px',
              borderRadius: 14,
              background: 'rgba(18, 22, 38, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Evaluated PR Reports
              </span>
              <GitPullRequest size={16} style={{ color: '#38bdf8' }} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
              {analyses.length}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 4 }}>
              Across your monitored repos
            </div>
          </div>

          <div
            style={{
              padding: '18px 20px',
              borderRadius: 14,
              background: 'rgba(18, 22, 38, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                High-Risk PRs Flagged
              </span>
              <ShieldAlert size={16} style={{ color: 'var(--risk-high)' }} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: highRiskCount > 0 ? 'var(--risk-high)' : '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
              {highRiskCount}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 4 }}>
              {highRiskCount > 0 ? 'Urgent attention required' : 'No active high risk alerts'}
            </div>
          </div>

          <div
            style={{
              padding: '18px 20px',
              borderRadius: 14,
              background: 'rgba(18, 22, 38, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Guard Status
              </span>
              <ShieldCheck size={16} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', fontFamily: "'JetBrains Mono', monospace" }}>
              Active
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 4 }}>
              Automated PR analysis online
            </div>
          </div>
        </div>

        {/* ─── Connected Repositories Section ───────────────────────────── */}
        <section id="repositories" style={{ marginBottom: 44 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FolderGit2 size={18} style={{ color: '#c084fc' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                My Connected Repositories
              </h2>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>
                ({monitoredRepos.length})
              </span>
            </div>

            {monitoredRepos.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {/* Search */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(18, 22, 38, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    width: 220,
                  }}
                >
                  <Search size={14} style={{ color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Filter repositories..."
                    value={repoSearch}
                    onChange={e => setRepoSearch(e.target.value)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      outline: 'none',
                      width: '100%',
                    }}
                  />
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: 6, background: 'rgba(255, 255, 255, 0.04)', padding: 4, borderRadius: 8 }}>
                  <button
                    type="button"
                    onClick={() => setRepoTab('ALL')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: repoTab === 'ALL' ? 'rgba(99, 102, 241, 0.25)' : 'none',
                      border: 'none',
                      color: repoTab === 'ALL' ? '#ffffff' : '#94a3b8',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    All ({monitoredRepos.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepoTab('PRIVATE')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: repoTab === 'PRIVATE' ? 'rgba(99, 102, 241, 0.25)' : 'none',
                      border: 'none',
                      color: repoTab === 'PRIVATE' ? '#ffffff' : '#94a3b8',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Private ({privateCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepoTab('OSS')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: repoTab === 'OSS' ? 'rgba(99, 102, 241, 0.25)' : 'none',
                      border: 'none',
                      color: repoTab === 'OSS' ? '#ffffff' : '#94a3b8',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Open Source ({ossCount})
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Repositories Content */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  style={{
                    height: 150,
                    borderRadius: 14,
                    background: 'rgba(18, 22, 38, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                  className="skeleton"
                />
              ))}
            </div>
          ) : monitoredRepos.length === 0 ? (
            /* ─── NEW USER ONBOARDING EMPTY STATE ─── */
            <div
              style={{
                borderRadius: 20,
                background: 'linear-gradient(180deg, rgba(22, 27, 44, 0.6) 0%, rgba(13, 16, 28, 0.8) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '40px 32px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 18,
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
                  border: '1px solid rgba(167, 139, 250, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#c084fc',
                  margin: '0 auto 18px',
                  boxShadow: '0 0 25px rgba(99, 102, 241, 0.25)',
                }}
              >
                <FolderGit2 size={26} />
              </div>

              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span>Welcome to PRism, {user?.name?.split(' ')[0] || user?.username}!</span>
                <Sparkles size={18} style={{ color: '#c084fc', flexShrink: 0 }} />
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: '580px', margin: '0 auto 28px', lineHeight: 1.6 }}>
                You have not connected any repositories yet. Link your GitHub repository or test with one of our sample
                codebases below to start auditing pull requests with AI blast-radius intelligence.
              </p>

              {/* 1-Click Sample Repositories */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                  Connect a Sample Repository in 1-Click
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, maxWidth: '860px', margin: '0 auto' }}>
                  {SAMPLE_REPOS.map(sample => {
                    const isSampleTracking = sampleLoading === `${sample.owner}/${sample.name}`;
                    return (
                      <div
                        key={sample.name}
                        style={{
                          padding: '16px 18px',
                          borderRadius: 14,
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
                              {sample.owner}/{sample.name}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              {sample.stars} <Star size={10} fill="currentColor" />
                            </span>
                          </div>
                          <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4, margin: 0 }}>
                            {sample.desc}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={isSampleTracking}
                          onClick={() => handleTrackSample(sample.owner, sample.name)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '7px 12px',
                            borderRadius: 8,
                            background: 'rgba(99, 102, 241, 0.2)',
                            border: '1px solid rgba(167, 139, 250, 0.35)',
                            color: '#ffffff',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          className="hover-bright"
                        >
                          {isSampleTracking ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Connecting...</span>
                            </>
                          ) : (
                            <>
                              <Plus size={13} />
                              <span>Connect Sample Repo</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Or connect custom repo */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '11px 22px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    border: '1px solid rgba(167, 139, 250, 0.4)',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
                  }}
                  className="hover-bright"
                >
                  <Plus size={15} />
                  <span>Connect Custom Repository</span>
                </button>
              </div>
            </div>
          ) : (
            /* ─── EXISTING USER REPOSITORIES GRID ─── */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
              {filteredRepos.map(m => {
                const r = m.repository;
                return (
                  <div
                    key={m.id}
                    style={{
                      padding: '20px 22px',
                      background: 'rgba(18, 22, 38, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                    className="hover-card"
                  >
                    <div>
                      {/* Top Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              background: r.private ? 'rgba(244, 63, 94, 0.12)' : 'rgba(99, 102, 241, 0.15)',
                              border: `1px solid ${r.private ? 'rgba(244, 63, 94, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: r.private ? 'var(--risk-high)' : '#c084fc',
                            }}
                          >
                            {r.private ? <Lock size={16} /> : <FolderGit2 size={16} />}
                          </div>
                          <div>
                            <Link
                              href={`/repositories/${r.name || r.id}`}
                              style={{
                                fontSize: '0.98rem',
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
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
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
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: 4,
                            borderRadius: 6,
                          }}
                          className="hover-card"
                          title="Untrack from personal dashboard"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Description */}
                      {r.description && (
                        <p
                          style={{
                            fontSize: '0.8rem',
                            color: '#94a3b8',
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
                    <div style={{ paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.76rem', color: '#94a3b8' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <GitBranch size={13} />
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
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.78rem',
                          borderRadius: 8,
                          padding: '6px 12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#ffffff',
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                        className="hover-card"
                      >
                        <span>Open Repo</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── Recent Pull Request Analysis Reports Section ──────────────── */}
        <section id="analyses">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <GitPullRequest size={18} style={{ color: '#38bdf8' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Recent Pull Request Analyses
              </h2>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>
                ({filteredAnalyses.length})
              </span>
            </div>

            {analyses.length > 0 && (
              <div style={{ display: 'flex', gap: 6, background: 'rgba(255, 255, 255, 0.04)', padding: 4, borderRadius: 8 }}>
                {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setAnalysisRiskFilter(lvl)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: analysisRiskFilter === lvl ? 'rgba(99, 102, 241, 0.25)' : 'none',
                      border: 'none',
                      color: analysisRiskFilter === lvl ? '#ffffff' : '#94a3b8',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {lvl === 'ALL' ? 'All Risks' : `${lvl}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2].map(i => (
                <div
                  key={i}
                  style={{
                    height: 90,
                    borderRadius: 14,
                    background: 'rgba(18, 22, 38, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                  className="skeleton"
                />
              ))}
            </div>
          ) : analyses.length === 0 ? (
            /* ─── NEW USER ANALYSIS EMPTY STATE ─── */
            <div
              style={{
                borderRadius: 18,
                background: 'rgba(18, 22, 38, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '36px 24px',
                textAlign: 'center',
              }}
            >
              <GitPullRequest size={32} style={{ margin: '0 auto 12px', opacity: 0.35, color: '#38bdf8' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                No Pull Request Analyses Yet
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', maxWidth: '460px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                {monitoredRepos.length === 0
                  ? 'Connect a repository above to enable automatic pull request risk audits, or run an ad-hoc analysis directly on any GitHub PR.'
                  : 'No pull requests have been evaluated yet for your tracked repositories. Run an analysis on an active PR to view reports here.'}
              </p>
              <button
                type="button"
                onClick={() => setShowAnalyzeModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 12px rgba(99, 102, 241, 0.35)',
                }}
                className="hover-bright"
              >
                <Play size={13} fill="currentColor" />
                <span>Run First PR Analysis</span>
              </button>
            </div>
          ) : (
            /* ─── EXISTING USER ANALYSES LIST ─── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredAnalyses.map(a => {
                const pr = a.evidence?.pr;
                const repo = a.evidence?.repository;
                const riskLevel = a.risk_level || 'UNKNOWN';
                const scoreEstimate = riskLevel === 'HIGH' ? 85 : riskLevel === 'MEDIUM' ? 55 : 15;

                return (
                  <Link
                    key={a.id}
                    href={`/analyses/${a.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      borderRadius: 14,
                      background: 'rgba(18, 22, 38, 0.65)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'all 0.15s ease',
                      flexWrap: 'wrap',
                      gap: 14,
                    }}
                    className="hover-card"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                      <RiskBadge risk={a.risk_level} size="md" />

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: '0.78rem', color: '#c084fc', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                            {repo?.full_name || 'Repository'} #{pr?.number || 'PR'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>•</span>
                          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                            {formatTimeAgo(a.created_at)}
                          </span>
                        </div>
                        <h4
                          style={{
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {pr?.title || a.summary || 'Pull Request Risk Audit'}
                        </h4>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
                          {scoreEstimate}<span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>/100</span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Risk Index</div>
                      </div>

                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                        }}
                      >
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── Modal 1: Track Repository ───────────────────────────────── */}
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
              style={{
                width: '100%',
                maxWidth: 460,
                background: 'rgba(18, 22, 38, 0.98)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 20,
                padding: 0,
                overflow: 'hidden',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.2)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'rgba(99, 102, 241, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#c084fc',
                    }}
                  >
                    <Plus size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                      Connect a Repository
                    </h3>
                    <p style={{ fontSize: '0.76rem', color: '#94a3b8', margin: 0 }}>
                      Link an open-source or private GitHub repository
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleAddRepo} style={{ padding: '24px' }}>
                {addError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(244, 63, 94, 0.12)',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                      color: 'var(--risk-high)',
                      fontSize: '0.8rem',
                      marginBottom: 18,
                    }}
                  >
                    <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                    <span>{addError}</span>
                  </div>
                )}

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                    Repository Owner or Organization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. fastapi, facebook, or your-org"
                    value={newOwner}
                    onChange={e => setNewOwner(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontSize: '0.86rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                    Repository Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. fastapi, react, or my-backend"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontSize: '0.86rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 22 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
                    Tracking Mode
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setNewRole('tracked_oss')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: 10,
                        background: newRole === 'tracked_oss' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(0, 0, 0, 0.3)',
                        border: `1px solid ${newRole === 'tracked_oss' ? 'rgba(167, 139, 250, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
                        color: newRole === 'tracked_oss' ? '#ffffff' : '#94a3b8',
                        fontSize: '0.78rem',
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
                        padding: '10px',
                        borderRadius: 10,
                        background: newRole === 'owner' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(0, 0, 0, 0.3)',
                        border: `1px solid ${newRole === 'owner' ? 'rgba(167, 139, 250, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
                        color: newRole === 'owner' ? '#ffffff' : '#94a3b8',
                        fontSize: '0.78rem',
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
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAdding}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 20px',
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 12px rgba(99, 102, 241, 0.35)',
                    }}
                    className="hover-bright"
                  >
                    {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    <span>{isAdding ? 'Connecting...' : 'Connect Repository'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Modal 2: Analyze Ad-Hoc PR ──────────────────────────────── */}
        {showAnalyzeModal && (
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
            onClick={() => setShowAnalyzeModal(false)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 480,
                background: 'rgba(18, 22, 38, 0.98)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 20,
                padding: 0,
                overflow: 'hidden',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(56, 189, 248, 0.2)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'rgba(56, 189, 248, 0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#38bdf8',
                    }}
                  >
                    <GitPullRequest size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                      Analyze Pull Request
                    </h3>
                    <p style={{ fontSize: '0.76rem', color: '#94a3b8', margin: 0 }}>
                      Audit any pull request for risk factors and blast radius
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAnalyzeModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleQuickAnalyze} style={{ padding: '24px' }}>
                {analyzeError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(244, 63, 94, 0.12)',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                      color: 'var(--risk-high)',
                      fontSize: '0.8rem',
                      marginBottom: 18,
                    }}
                  >
                    <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                    <span>{analyzeError}</span>
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
                    GitHub Pull Request URL or Shorthand
                  </label>
                  <input
                    type="text"
                    placeholder="https://github.com/fastapi/fastapi/pull/16159 or owner/repo#123"
                    value={analyzePrUrl}
                    onChange={e => setAnalyzePrUrl(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 10,
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontSize: '0.86rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      outline: 'none',
                    }}
                  />
                  <span style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginTop: 6 }}>
                    Supports full URLs or shorthand notation like <code>fastapi/fastapi#123</code>.
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowAnalyzeModal(false)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAnalyzing}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 20px',
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 12px rgba(56, 189, 248, 0.35)',
                    }}
                    className="hover-bright"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Starting Analysis...</span>
                      </>
                    ) : (
                      <>
                        <Play size={14} fill="currentColor" />
                        <span>Start Analysis</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
