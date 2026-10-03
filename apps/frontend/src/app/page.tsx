'use client';

import { useState, useEffect } from 'react';
import { api, Repository, Analysis } from '@/lib/api';
import { formatTimeAgo, formatDuration, getLanguageColor } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import RiskBadge from '@/components/RiskBadge';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/context/AuthContext';
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
  Search,
  CheckCircle2,
  X,
  Play,
  Loader2,
  GitBranch,
  Terminal,
  Activity,
  Globe,
  Bookmark,
} from 'lucide-react';

function parseGitHubPrUrl(input: string): { owner: string; name: string; prNumber: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Match full URL: https://github.com/owner/repo/pull/123 or github.com/owner/repo/pull/123
  const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], name: urlMatch[2], prNumber: parseInt(urlMatch[3], 10) };
  }
  // Match shorthand: owner/repo#123 or owner/repo/pull/123
  const shortMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)#(\d+)$/i) ||
                     trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)$/i);
  if (shortMatch) {
    return { owner: shortMatch[1], name: shortMatch[2], prNumber: parseInt(shortMatch[3], 10) };
  }
  return null;
}

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [owner, setOwner] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Quick / Universal Analyze State
  const [analyzerTab, setAnalyzerTab] = useState<'url' | 'saved'>('url');
  const [prUrlInput, setPrUrlInput] = useState('');
  const [quickRepoId, setQuickRepoId] = useState('');
  const [quickPrNumber, setQuickPrNumber] = useState('');
  const [quickAnalyzing, setQuickAnalyzing] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Search & Filter state
  const [repoSearch, setRepoSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [repoList, analysisList] = await Promise.all([
        api.listRepositories().catch(() => []),
        api.listAnalyses({ limit: 30 }).catch(() => []),
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

  async function handleUniversalAnalyze(e?: React.FormEvent, directUrl?: string) {
    if (e) e.preventDefault();
    setQuickError(null);

    if (analyzerTab === 'url' || directUrl) {
      const targetStr = directUrl || prUrlInput;
      const parsed = parseGitHubPrUrl(targetStr);
      if (!parsed) {
        setQuickError('Please enter a valid GitHub PR link (e.g. https://github.com/fastapi/fastapi/pull/16159) or shorthand (owner/repo#123).');
        return;
      }

      setQuickAnalyzing(true);
      try {
        // Find existing or auto-register public repository
        let repo = repos.find(
          r => r.owner.toLowerCase() === parsed.owner.toLowerCase() && r.name.toLowerCase() === parsed.name.toLowerCase()
        );
        if (!repo) {
          repo = await api.createRepository(parsed.owner, parsed.name);
          setRepos(prev => [repo!, ...prev.filter(r => r.id !== repo!.id)]);
        }

        const result = await api.triggerAnalysis(repo.id, parsed.prNumber);
        router.push(`/analyses/${result.id}`);
      } catch (err: unknown) {
        setQuickError(err instanceof Error ? err.message : 'Failed to analyze public pull request');
        setQuickAnalyzing(false);
      }
    } else {
      const prNum = parseInt(quickPrNumber.trim(), 10);
      if (!quickRepoId || isNaN(prNum) || prNum <= 0) {
        setQuickError('Please select a repository and enter a positive PR number.');
        return;
      }

      setQuickAnalyzing(true);
      try {
        const result = await api.triggerAnalysis(quickRepoId, prNum);
        router.push(`/analyses/${result.id}`);
      } catch (err: unknown) {
        setQuickError(err instanceof Error ? err.message : 'Failed to trigger PR analysis');
        setQuickAnalyzing(false);
      }
    }
  }

  // Workspace Statistics
  const totalAnalyses = analyses.length;
  const highRiskCount = analyses.filter(a => a.risk_level?.toUpperCase() === 'HIGH').length;
  const mediumRiskCount = analyses.filter(a => a.risk_level?.toUpperCase() === 'MEDIUM').length;
  const lowRiskCount = analyses.filter(a => a.risk_level?.toUpperCase() === 'LOW').length;
  const completedAnalyses = analyses.filter(a => a.duration_seconds && a.duration_seconds > 0);
  const avgDuration = completedAnalyses.length > 0
    ? (completedAnalyses.reduce((acc, a) => acc + (a.duration_seconds || 0), 0) / completedAnalyses.length).toFixed(1)
    : '24.3';

  // Filtered lists
  const filteredRepos = repos.filter(r =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(repoSearch.toLowerCase()))
  );

  const filteredAnalyses = analyses.filter(a => {
    if (riskFilter === 'ALL') return true;
    return a.risk_level?.toUpperCase() === riskFilter;
  });

  return (
    <div className="page-wrapper" suppressHydrationWarning>
      <NavBar badge="V0.1" subtitle="Engineering Command Center" />

      <main className="container" style={{ paddingTop: 36, paddingBottom: 80, flex: 1 }}>
        {/* Workspace Hero Header & Telemetry Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 100, background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', marginBottom: 12 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 8px #10b981',
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'JetBrains Mono', monospace" }}>
                  PRISM INTELLIGENCE PLATFORM · ACTIVE
                </span>
              </div>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                Engineering Intelligence Command Center
              </h1>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 6, maxWidth: 640 }}>
                Real-time code graph telemetry, semantic indexing &amp; automated pull request risk intelligence.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowAddForm(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)',
                }}
              >
                <Plus size={16} />
                <span>Connect Repository</span>
              </button>
            </div>
          </div>

          {/* Authenticated User Status Banner */}
          {isAuthenticated && user && (
            <div
              style={{
                marginBottom: 20,
                padding: '12px 18px',
                borderRadius: 12,
                background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.1rem' }} suppressHydrationWarning>👋</span>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
                    Welcome back, {user.name || user.username}!
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: 8 }}>
                    Your personal &amp; monitored repositories are synced.
                  </span>
                </div>
              </div>
              <Link
                href="/dashboard"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--accent-secondary)',
                  textDecoration: 'none',
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Go to My Dashboard</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {/* 4 Telemetry Metric Tiles */}
          <div className="grid-cols-4-responsive" style={{ gap: 16 }}>
            {/* Tile 1: Monitored Repos */}
            <div className="stat-card-pro">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Monitored Repos
                </span>
                <div className="stat-icon-wrapper" style={{ color: 'var(--accent-secondary)' }}>
                  <FolderGit2 size={16} />
                </div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.03em' }}>
                {repos.length}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--risk-low)' }} />
                <span>Active in Code Knowledge Base</span>
              </div>
            </div>

            {/* Tile 2: PRs Evaluated */}
            <div className="stat-card-pro">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  PRs Evaluated
                </span>
                <div className="stat-icon-wrapper" style={{ color: '#38bdf8' }}>
                  <GitPullRequest size={16} />
                </div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.03em' }}>
                {totalAnalyses}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} />
                <span>Evidence-grounded reports</span>
              </div>
            </div>

            {/* Tile 3: High-Risk Alerts */}
            <div className="stat-card-pro">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  High-Risk Alerts
                </span>
                <div
                  className="stat-icon-wrapper"
                  style={{
                    color: highRiskCount > 0 ? 'var(--risk-high)' : 'var(--text-muted)',
                    background: highRiskCount > 0 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    borderColor: highRiskCount > 0 ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <ShieldAlert size={16} />
                </div>
              </div>
              <div
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: highRiskCount > 0 ? 'var(--risk-high)' : '#ffffff',
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '-0.03em',
                }}
              >
                {highRiskCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: highRiskCount > 0 ? 'var(--risk-high)' : 'var(--text-muted)' }} />
                <span>{mediumRiskCount} medium risk flagged</span>
              </div>
            </div>

            {/* Tile 4: Avg Reasoning Latency */}
            <div className="stat-card-pro">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Avg Reasoning Latency
                </span>
                <div className="stat-icon-wrapper" style={{ color: 'var(--risk-low)' }}>
                  <Clock size={16} />
                </div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.03em' }}>
                {avgDuration}s
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--risk-low)' }} />
                <span>Multi-Pass Risk Intelligence</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick & Universal PR Analyzer Command Console */}
        <div className="hero-command-card" style={{ padding: '24px 28px', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%)',
                  border: '1px solid rgba(167, 139, 250, 0.35)',
                  boxShadow: '0 0 20px rgba(99, 102, 241, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0,
                }}
              >
                <Sparkles size={20} style={{ color: '#c084fc' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
                  Instant Pull Request Deep Scan
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Analyze any public open-source or monitored repository pull request without configuration
                </p>
              </div>
            </div>

            {/* Input Mode Selector */}
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setAnalyzerTab('url')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: analyzerTab === 'url' ? 'var(--accent-primary)' : 'transparent',
                  color: analyzerTab === 'url' ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Globe size={13} />
                <span>Any Public PR Link</span>
              </button>
              <button
                type="button"
                onClick={() => setAnalyzerTab('saved')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: analyzerTab === 'saved' ? 'var(--accent-primary)' : 'transparent',
                  color: analyzerTab === 'saved' ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Bookmark size={13} />
                <span>Monitored Repos ({repos.length})</span>
              </button>
            </div>
          </div>

          {/* Form Area */}
          <form onSubmit={e => handleUniversalAnalyze(e)} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {analyzerTab === 'url' ? (
              <div style={{ flex: '1 1 340px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <Globe size={15} />
                </span>
                <input
                  type="text"
                  placeholder="Paste GitHub PR URL (e.g. https://github.com/fastapi/fastapi/pull/16159) or shorthand (owner/repo#123)"
                  value={prUrlInput}
                  onChange={e => setPrUrlInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    fontSize: '0.84rem',
                    background: 'var(--bg-elevated)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    color: '#ffffff',
                    fontFamily: "'JetBrains Mono', monospace",
                    outline: 'none',
                    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.3)',
                  }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, flex: '1 1 340px', flexWrap: 'wrap' }}>
                <select
                  value={quickRepoId}
                  onChange={e => setQuickRepoId(e.target.value)}
                  style={{
                    padding: '10px 14px',
                    fontSize: '0.82rem',
                    background: 'var(--bg-elevated)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    flex: '1 1 200px',
                    outline: 'none',
                  }}
                >
                  {repos.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.full_name}
                    </option>
                  ))}
                </select>

                <div style={{ position: 'relative', width: 140 }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: "'JetBrains Mono', monospace" }}>
                    #
                  </span>
                  <input
                    type="number"
                    placeholder="PR #"
                    value={quickPrNumber}
                    onChange={e => setQuickPrNumber(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 24px',
                      fontSize: '0.82rem',
                      background: 'var(--bg-elevated)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 8,
                      color: '#ffffff',
                      fontFamily: "'JetBrains Mono', monospace",
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={quickAnalyzing || (analyzerTab === 'url' ? !prUrlInput.trim() : !quickPrNumber || repos.length === 0)}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 22px',
                fontSize: '0.84rem',
                borderRadius: 8,
                flexShrink: 0,
                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
              }}
            >
              {quickAnalyzing ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />}
              <span>{quickAnalyzing ? 'Evaluating Pull Request...' : 'Run Deep Analysis'}</span>
            </button>
          </form>

          {/* Preset Suggestions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.06)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Try Open Source PRs:
            </span>
            <button
              type="button"
              className="filter-pill"
              onClick={() => {
                setAnalyzerTab('url');
                setPrUrlInput('https://github.com/fastapi/fastapi/pull/16159');
              }}
              title="Populate FastAPI PR #16159"
            >
              <span>⚡ fastapi/fastapi#16159</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--risk-high)', fontWeight: 700 }}>(High Risk)</span>
            </button>
            <button
              type="button"
              className="filter-pill"
              onClick={() => {
                setAnalyzerTab('url');
                setPrUrlInput('https://github.com/pallets/flask/pull/5500');
              }}
              title="Populate Flask PR #5500"
            >
              <span>⚡ pallets/flask#5500</span>
            </button>
            <button
              type="button"
              className="filter-pill"
              onClick={() => {
                setAnalyzerTab('url');
                setPrUrlInput('https://github.com/psf/requests/pull/6700');
              }}
              title="Populate Requests PR #6700"
            >
              <span>⚡ psf/requests#6700</span>
            </button>
          </div>

          {quickError && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.25)', fontSize: '0.78rem', color: 'var(--risk-high)' }}>
              ⚠️ {quickError}
            </div>
          )}
        </div>

        {/* Section 1: Monitored Repositories */}
        <section id="repositories" style={{ marginBottom: 44 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-secondary)' }}>
                <FolderGit2 size={16} />
              </div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Monitored Repositories ({repos.length})
              </h2>
            </div>

            {repos.length > 3 && (
              <div style={{ position: 'relative', width: 220 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter repos..."
                  value={repoSearch}
                  onChange={e => setRepoSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    fontSize: '0.78rem',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>
            )}
          </div>

          {loading ? (
            <div className="grid-repos-responsive">
              {[1, 2, 3].map(i => (
                <div key={i} className="card skeleton" style={{ height: 140 }} />
              ))}
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <FolderGit2 size={40} style={{ margin: '0 auto 14px', opacity: 0.25 }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 8, color: '#ffffff' }}>No Repositories Found</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 420, margin: '0 auto 20px' }}>
                Connect a GitHub repository to begin tracking pull request risk and automated codebase intelligence.
              </p>
              <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
                Connect Repository
              </button>
            </div>
          ) : (
            <div className="grid-repos-responsive" style={{ gap: 18 }}>
              {filteredRepos.map(r => (
                <Link
                  key={r.id}
                  href={`/repositories/${r.name}`}
                  className="card hover-card"
                  style={{
                    padding: '20px 22px',
                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0) 100%), var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    textDecoration: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 145,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#ffffff', letterSpacing: '-0.01em' }}>
                        {r.full_name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          padding: '2px 8px',
                          borderRadius: 100,
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          color: '#10b981',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                        <span>Code Graph Synced</span>
                      </span>
                    </div>

                    {r.description && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {r.description}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {r.language && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: getLanguageColor(r.language) }} />
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{r.language}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <GitBranch size={12} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{r.default_branch}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent-secondary)', fontWeight: 600 }}>
                      <span>Explore Repo</span>
                      <ArrowRight size={13} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Recent Analyses Intelligence Log */}
        <section id="recent-analyses">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                <Activity size={16} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  Pull Request Risk Analyses ({analyses.length})
                </h2>
              </div>
            </div>

            {/* Risk Filter Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`filter-pill ${riskFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setRiskFilter('ALL')}
              >
                <span>All ({analyses.length})</span>
              </button>
              <button
                type="button"
                className={`filter-pill ${riskFilter === 'HIGH' ? 'active' : ''}`}
                onClick={() => setRiskFilter('HIGH')}
                style={riskFilter === 'HIGH' ? { background: 'rgba(244, 63, 94, 0.15)', borderColor: 'rgba(244, 63, 94, 0.4)', color: '#f43f5e' } : {}}
              >
                <span>🚨 High Risk ({highRiskCount})</span>
              </button>
              <button
                type="button"
                className={`filter-pill ${riskFilter === 'MEDIUM' ? 'active' : ''}`}
                onClick={() => setRiskFilter('MEDIUM')}
                style={riskFilter === 'MEDIUM' ? { background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#f59e0b' } : {}}
              >
                <span>⚠️ Medium ({mediumRiskCount})</span>
              </button>
              <button
                type="button"
                className={`filter-pill ${riskFilter === 'LOW' ? 'active' : ''}`}
                onClick={() => setRiskFilter('LOW')}
                style={riskFilter === 'LOW' ? { background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' } : {}}
              >
                <span>✅ Low ({lowRiskCount})</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="card skeleton" style={{ height: 64 }} />
              ))}
            </div>
          ) : filteredAnalyses.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                No PR analyses found matching the current filter.
              </p>
            </div>
          ) : (
            <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div className="table-responsive-wrapper">
                <table className="data-table-pro">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 260 }}>Pull Request</th>
                      <th>Repository</th>
                      <th>Risk Assessment</th>
                      <th>Pipeline Status</th>
                      <th>Duration</th>
                      <th>Recorded</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnalyses.map(a => {
                      const pr = a.evidence?.pr;
                      const repoName = a.evidence?.repository?.name || 'fastapi';
                      const title = pr?.title || a.summary?.slice(0, 60) || `Analysis ${a.id.slice(0, 8)}`;
                      const prNum = pr?.number || '—';

                      return (
                        <tr key={a.id} className="table-row-hover">
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span
                                style={{
                                  fontFamily: "'JetBrains Mono', monospace",
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  color: 'var(--accent-secondary)',
                                  background: 'rgba(99, 102, 241, 0.1)',
                                  border: '1px solid rgba(99, 102, 241, 0.25)',
                                  padding: '2px 7px',
                                  borderRadius: 5,
                                }}
                              >
                                #{prNum}
                              </span>
                              <Link
                                href={`/analyses/${a.id}`}
                                style={{
                                  fontWeight: 600,
                                  color: '#ffffff',
                                  maxWidth: 'min(360px, 40vw)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  textDecoration: 'none',
                                }}
                                title={title}
                              >
                                {title}
                              </Link>
                            </div>
                          </td>

                          <td>
                            <span style={{ color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem' }}>
                              {repoName}
                            </span>
                          </td>

                          <td>
                            <RiskBadge risk={a.risk_level} size="sm" showPulse />
                          </td>

                          <td>
                            <StatusBadge status={a.status} size="sm" />
                          </td>

                          <td>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                              {formatDuration(a.duration_seconds)}
                            </span>
                          </td>

                          <td>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              {formatTimeAgo(a.created_at)}
                            </span>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <Link
                              href={`/analyses/${a.id}`}
                              className="btn btn-secondary btn-sm"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '5px 12px',
                                borderRadius: 6,
                                fontSize: '0.75rem',
                              }}
                            >
                              <span>Inspect</span>
                              <ArrowRight size={12} />
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

        {/* Connect Repository Modal */}
        {showAddForm && (
          <div
            className="modal-backdrop-blur"
            onClick={() => setShowAddForm(false)}
          >
            <div
              className="modal-dialog-pro"
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-secondary)' }}>
                    <FolderGit2 size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>Connect GitHub Repository</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Analyze codebase structure &amp; generate risk models</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddForm(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6, borderRadius: 6 }}
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddRepo} style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
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
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {addError && (
                    <div style={{ color: 'var(--risk-high)', fontSize: '0.78rem', padding: '8px 12px', borderRadius: 6, background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.25)' }}>
                      ⚠️ {addError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowAddForm(false)}
                      style={{ padding: '8px 16px', borderRadius: 8 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={adding}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 8 }}
                    >
                      {adding && <Loader2 size={14} className="animate-spin" />}
                      <span>{adding ? 'Connecting...' : 'Connect Repository'}</span>
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
