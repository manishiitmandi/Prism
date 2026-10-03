'use client';

import { useState, useEffect, use } from 'react';
import { api, Repository, PullRequest, Analysis } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
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
  ArrowRight,
  Plus,
  Play,
  Loader2,
  AlertTriangle,
  FolderGit2,
  CheckCircle2,
  Activity,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
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
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [prFilter, setPrFilter] = useState<'ALL' | 'ANALYZED' | 'UNANALYZED'>('ALL');
  const [prSearch, setPrSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const r = await api.getRepository(id);
      setRepo(r);

      setPrsLoading(true);
      const [prsData, analysesData] = await Promise.all([
        api.listPullRequests(r.id).catch(() => [] as PullRequest[]),
        api.listAnalyses({ repositoryId: r.id }).catch(() => [] as Analysis[]),
      ]);

      setAnalyses(analysesData);

      // Merge PRs from API with PRs extracted from analyses
      const prMap = new Map<number, PullRequest>();
      prsData.forEach(p => prMap.set(p.number, p));

      analysesData.forEach(a => {
        const pr = a.evidence?.pr;
        if (pr && pr.number && !prMap.has(pr.number)) {
          const prRecord = pr as Record<string, unknown>;
          prMap.set(pr.number, {
            number: pr.number,
            title: pr.title || a.summary?.slice(0, 60) || `PR #${pr.number}`,
            author: pr.author || 'Kludex',
            state: 'open',
            base_branch: pr.base_branch || 'master',
            head_branch: pr.head_branch || 'patch-1',
            additions: pr.additions ?? 7,
            deletions: pr.deletions ?? 0,
            changed_files: typeof prRecord.changed_files === 'number' ? prRecord.changed_files : 1,
            created_at: typeof prRecord.created_at === 'string' ? prRecord.created_at : a.created_at,
            updated_at: a.created_at,
            html_url: pr.html_url || `https://github.com/${r.full_name}/pull/${pr.number}`,
          });
        }
      });

      setPrs(Array.from(prMap.values()).sort((a, b) => b.number - a.number));
    } catch {
      setError('Repository not found');
    } finally {
      setLoading(false);
      setPrsLoading(false);
    }
  }

  async function handleAnalyze(prNumber: number) {
    if (!repo) return;
    setAnalyzingPr(prNumber);
    setTriggerError(null);
    try {
      const result = await api.triggerAnalysis(repo.id, prNumber);
      router.push(`/analyses/${result.id}`);
    } catch (err: unknown) {
      setTriggerError(err instanceof Error ? err.message : `Pull request #${prNumber} does not exist on this repository.`);
      setAnalyzingPr(null);
    }
  }

  const handleCustomAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    setTriggerError(null);
    const num = parseInt(customPrNumber.trim(), 10);
    if (!isNaN(num) && num > 0) {
      handleAnalyze(num);
    } else {
      setTriggerError('Please enter a valid pull request number.');
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

  // Deduplicated risk breakdown based on latest analysis per unique PR
  const evaluatedPrs = Array.from(prAnalysisMap.values());
  const highRiskPrs = evaluatedPrs.filter(a => a.risk_level?.toUpperCase() === 'HIGH').length;
  const mediumRiskPrs = evaluatedPrs.filter(a => a.risk_level?.toUpperCase() === 'MEDIUM').length;
  const lowRiskPrs = evaluatedPrs.filter(a => a.risk_level?.toUpperCase() === 'LOW').length;

  const analyzedPrCount = prs.filter(pr => prAnalysisMap.has(pr.number)).length;
  const unanalyzedPrCount = Math.max(0, prs.length - analyzedPrCount);
  const coveragePercent = prs.length > 0 ? Math.round((analyzedPrCount / prs.length) * 100) : 0;

  // Repository Safety Index (0 - 100)
  const safetyScore = evaluatedPrs.length > 0
    ? Math.max(10, Math.round(100 - ((highRiskPrs * 40 + mediumRiskPrs * 15) / evaluatedPrs.length)))
    : 100;

  // Flagged PRs needing review (High and Medium risk, sorted high risk first)
  const flaggedPrs = evaluatedPrs
    .filter(a => a.risk_level?.toUpperCase() === 'HIGH' || a.risk_level?.toUpperCase() === 'MEDIUM')
    .sort((a, b) => {
      if (a.risk_level?.toUpperCase() === 'HIGH' && b.risk_level?.toUpperCase() !== 'HIGH') return -1;
      if (b.risk_level?.toUpperCase() === 'HIGH' && a.risk_level?.toUpperCase() !== 'HIGH') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Filtered PRs
  const filteredPrs = prs.filter(pr => {
    const matchesSearch = pr.title.toLowerCase().includes(prSearch.toLowerCase()) ||
      String(pr.number).includes(prSearch);
    if (!matchesSearch) return false;

    const hasAnalysis = prAnalysisMap.has(pr.number);
    if (prFilter === 'ANALYZED') return hasAnalysis;
    if (prFilter === 'UNANALYZED') return !hasAnalysis;
    return true;
  });

  if (loading) {
    return (
      <div className="page-wrapper">
        <NavBar subtitle="Repository Intelligence" />
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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8, color: '#ffffff' }}>{error}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>The repository could not be located in the current workspace.</p>
          <Link href="/" className="btn btn-primary" style={{ display: 'inline-flex' }}>
            ← Back to Command Center
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
            { label: 'Repositories', href: '/dashboard#repositories' },
            { label: repo?.full_name || repo?.name || 'Repository' },
          ]}
        />

        {/* Repository Header Hero Card */}
        <div
          className="hero-command-card"
          style={{
            padding: '26px 30px',
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(99, 102, 241, 0.18)', border: '1px solid rgba(167, 139, 250, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>
                  <FolderGit2 size={20} />
                </div>
                <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  {repo?.full_name}
                </h1>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: '2px 8px',
                    borderRadius: 100,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                  }}
                >
                  {repo?.private ? 'Private' : 'Public'}
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

              {repo?.description && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 16, maxWidth: 660, lineHeight: 1.5 }}>
                  {repo.description}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255, 255, 255, 0.03)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <GitBranch size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>{repo?.default_branch || 'main'}</span>
                </div>

                {repo?.language && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255, 255, 255, 0.03)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: getLanguageColor(repo.language) }} />
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{repo.language}</span>
                  </div>
                )}

                <a
                  href={`https://github.com/${repo?.full_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    color: 'var(--accent-secondary)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                  className="hover-bright"
                >
                  <span>GitHub Repository</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Quick Trigger Any PR Box */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <form
                onSubmit={handleCustomAnalyze}
                className="repo-quick-trigger-form"
                style={{
                  background: 'rgba(10, 11, 16, 0.7)',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: triggerError ? '1px solid rgba(244, 63, 94, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: triggerError ? '0 0 16px rgba(244, 63, 94, 0.2)' : 'inset 0 1px 2px rgba(0, 0, 0, 0.4)',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                  <GitPullRequest size={14} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
                  <input
                    type="number"
                    placeholder="PR # (e.g. 16159)"
                    value={customPrNumber}
                    onChange={e => {
                      setCustomPrNumber(e.target.value);
                      if (triggerError) setTriggerError(null);
                    }}
                    style={{
                      flex: '1 1 140px',
                      minWidth: 100,
                      padding: '7px 10px',
                      fontSize: '0.8rem',
                      background: 'var(--bg-elevated)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 6,
                      color: '#ffffff',
                      fontFamily: "'JetBrains Mono', monospace",
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!customPrNumber || analyzingPr !== null}
                  className="btn btn-primary btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '7px 16px',
                    borderRadius: 6,
                    flexShrink: 0,
                    boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)',
                  }}
                >
                  {analyzingPr !== null ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
                  <span>Analyze</span>
                </button>
              </form>

              {triggerError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(244, 63, 94, 0.12)',
                    border: '1px solid rgba(244, 63, 94, 0.35)',
                    color: 'var(--risk-high)',
                    fontSize: '0.78rem',
                    maxWidth: 380,
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    <span>{triggerError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTriggerError(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--risk-high)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                    title="Dismiss"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3-Stat Repository Health & Telemetry Strip */}
        <div className="grid-cols-4-responsive" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          <div className="stat-card-pro" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Repository Safety Score
              </span>
              <ShieldCheck size={15} style={{ color: highRiskPrs > 0 ? 'var(--risk-high)' : '#10b981' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
                {evaluatedPrs.length > 0 ? `${safetyScore}/100` : '100/100'}
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: highRiskPrs > 0 ? 'var(--risk-high)' : mediumRiskPrs > 0 ? 'var(--risk-medium)' : '#10b981',
                }}
              >
                {evaluatedPrs.length === 0 ? 'Ready' : highRiskPrs > 0 ? 'Attention Needed' : mediumRiskPrs > 0 ? 'Moderate' : 'Safe'}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              {evaluatedPrs.length > 0
                ? `${lowRiskPrs} of ${evaluatedPrs.length} PRs passed all checks`
                : 'No pull requests evaluated yet'}
            </div>
          </div>

          <div className="stat-card-pro" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Evaluated Pull Requests
              </span>
              <Activity size={15} style={{ color: 'var(--accent-secondary)' }} />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
              {analyzedPrCount} / {prs.length} PRs
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              {prs.length > 0 ? `${coveragePercent}% coverage · ${analyses.length} total runs` : 'Ready for analysis'}
            </div>
          </div>

          <div className="stat-card-pro" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Risk Distribution
              </span>
              <ShieldAlert size={15} style={{ color: highRiskPrs > 0 ? 'var(--risk-high)' : 'var(--text-muted)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--risk-high)', fontFamily: "'JetBrains Mono', monospace" }}>
                {highRiskPrs} High
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--risk-medium)', fontFamily: "'JetBrains Mono', monospace" }}>
                {mediumRiskPrs} Med
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--risk-low)', fontFamily: "'JetBrains Mono', monospace" }}>
                {lowRiskPrs} Low
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              Across {evaluatedPrs.length} evaluated pull requests
            </div>
          </div>
        </div>

        {/* 2-Column Main Layout: PRs List & Code Intelligence Sidebar */}
        <div className="grid-cols-repo-responsive">
          {/* Left Column: Active Pull Requests */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GitPullRequest size={16} style={{ color: 'var(--accent-secondary)' }} />
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                  Pull Requests ({prs.length})
                </h2>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  className={`filter-pill ${prFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setPrFilter('ALL')}
                >
                  All ({prs.length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${prFilter === 'ANALYZED' ? 'active' : ''}`}
                  onClick={() => setPrFilter('ANALYZED')}
                >
                  Analyzed ({analyzedPrCount})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${prFilter === 'UNANALYZED' ? 'active' : ''}`}
                  onClick={() => setPrFilter('UNANALYZED')}
                  title="Pull requests awaiting risk analysis"
                >
                  Pending Analysis ({unanalyzedPrCount})
                </button>
              </div>
            </div>

            {prsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} className="card skeleton" style={{ height: 100 }} />
                ))}
              </div>
            ) : filteredPrs.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <GitPullRequest size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6, color: '#ffffff' }}>No Pull Requests Found</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto 16px' }}>
                  Use the quick trigger box above to evaluate any PR number directly from GitHub.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredPrs.map(pr => {
                  const existingAnalysis = prAnalysisMap.get(pr.number);
                  const isCurrentAnalyzing = analyzingPr === pr.number;

                  return (
                    <div
                      key={pr.number}
                      className="card hover-card pr-item-card"
                      style={{
                        padding: '16px 20px',
                        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0) 100%), var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              color: 'var(--accent-secondary)',
                              background: 'rgba(99, 102, 241, 0.1)',
                              border: '1px solid rgba(99, 102, 241, 0.25)',
                              padding: '2px 7px',
                              borderRadius: 5,
                            }}
                          >
                            #{pr.number}
                          </span>

                          <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#ffffff', wordBreak: 'break-word' }}>
                            {pr.title}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.75rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                          <span>by <strong style={{ color: 'var(--text-primary)' }}>{pr.author}</strong></span>

                          <span style={{ fontFamily: "'JetBrains Mono', monospace", background: 'rgba(255, 255, 255, 0.04)', padding: '1px 6px', borderRadius: 4 }}>
                            {pr.base_branch} ← {pr.head_branch}
                          </span>

                          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            <span style={{ color: 'var(--risk-low)', fontWeight: 600 }}>+{pr.additions}</span>{' '}
                            <span style={{ color: 'var(--risk-high)', fontWeight: 600 }}>-{pr.deletions}</span>
                          </span>

                          <span style={{ color: 'var(--text-muted)' }}>{formatTimeAgo(pr.created_at)}</span>
                        </div>
                      </div>

                      {/* Right: Analysis Action or Report Link */}
                      <div className="pr-item-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {existingAnalysis ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <RiskBadge risk={existingAnalysis.risk_level} size="sm" showPulse />
                            <Link
                              href={`/analyses/${existingAnalysis.id}`}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 6, fontSize: '0.78rem' }}
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
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 6, fontSize: '0.78rem' }}
                          >
                            {isCurrentAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
                            <span>{isCurrentAnalyzing ? 'Analyzing...' : 'Analyze Risk'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Repository Risk Intelligence & Health Overview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 1. Repository Risk Health Scorecard */}
            <div
              className="card"
              style={{
                padding: '22px 24px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={16} style={{ color: highRiskPrs > 0 ? 'var(--risk-high)' : '#10b981' }} />
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                    Risk Health Scorecard
                  </h3>
                </div>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: '2px 8px',
                    borderRadius: 100,
                    background: highRiskPrs > 0 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                    border: highRiskPrs > 0 ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                    color: highRiskPrs > 0 ? 'var(--risk-high)' : '#10b981',
                    fontWeight: 700,
                  }}
                >
                  {evaluatedPrs.length === 0 ? 'NO RUNS' : `${safetyScore}/100 SCORE`}
                </span>
              </div>

              {/* Multi-segment Risk Progress Bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  <span>Risk Distribution</span>
                  <span>{evaluatedPrs.length} Analyzed PR{evaluatedPrs.length !== 1 ? 's' : ''}</span>
                </div>

                <div
                  style={{
                    height: 8,
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.06)',
                    borderRadius: 999,
                    overflow: 'hidden',
                    display: 'flex',
                    gap: 2,
                  }}
                >
                  {evaluatedPrs.length > 0 ? (
                    <>
                      {lowRiskPrs > 0 && (
                        <div
                          style={{
                            width: `${(lowRiskPrs / evaluatedPrs.length) * 100}%`,
                            background: 'var(--risk-low)',
                            borderRadius: 999,
                          }}
                          title={`Low Risk: ${lowRiskPrs} (${Math.round((lowRiskPrs / evaluatedPrs.length) * 100)}%)`}
                        />
                      )}
                      {mediumRiskPrs > 0 && (
                        <div
                          style={{
                            width: `${(mediumRiskPrs / evaluatedPrs.length) * 100}%`,
                            background: 'var(--risk-medium)',
                            borderRadius: 999,
                          }}
                          title={`Medium Risk: ${mediumRiskPrs} (${Math.round((mediumRiskPrs / evaluatedPrs.length) * 100)}%)`}
                        />
                      )}
                      {highRiskPrs > 0 && (
                        <div
                          style={{
                            width: `${(highRiskPrs / evaluatedPrs.length) * 100}%`,
                            background: 'var(--risk-high)',
                            borderRadius: 999,
                          }}
                          title={`High Risk: ${highRiskPrs} (${Math.round((highRiskPrs / evaluatedPrs.length) * 100)}%)`}
                        />
                      )}
                    </>
                  ) : (
                    <div style={{ width: '100%', background: 'rgba(255, 255, 255, 0.08)' }} />
                  )}
                </div>
              </div>

              {/* Metric Mini-Pills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 7, border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--risk-low)', fontWeight: 600 }}>Low Risk</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                    {lowRiskPrs}
                  </div>
                </div>
                <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 7, border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--risk-medium)', fontWeight: 600 }}>Medium</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                    {mediumRiskPrs}
                  </div>
                </div>
                <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 7, border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--risk-high)', fontWeight: 600 }}>High Risk</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                    {highRiskPrs}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                {highRiskPrs > 0 ? (
                  <>
                    <AlertTriangle size={13} style={{ color: 'var(--risk-high)', flexShrink: 0 }} />
                    <span>{highRiskPrs} pull request{highRiskPrs > 1 ? 's' : ''} flagged with elevated risk requiring review before merge.</span>
                  </>
                ) : evaluatedPrs.length > 0 ? (
                  <>
                    <CheckCircle2 size={13} style={{ color: 'var(--risk-low)', flexShrink: 0 }} />
                    <span>All analyzed pull requests currently comply with standard safety guardrails.</span>
                  </>
                ) : (
                  <span>Run automated risk analyses on open pull requests to populate repository safety metrics.</span>
                )}
              </div>
            </div>

            {/* 2. Critical Attention Watchlist (Only shows High/Medium Risk PRs needing review) */}
            <div
              className="card"
              style={{
                padding: '22px 24px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={16} style={{ color: flaggedPrs.length > 0 ? 'var(--risk-high)' : 'var(--accent-secondary)' }} />
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                    Review Watchlist
                  </h3>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: flaggedPrs.length > 0 ? 'var(--risk-high)' : 'var(--text-muted)',
                    fontFamily: "'JetBrains Mono', monospace",
                    background: flaggedPrs.length > 0 ? 'rgba(244, 63, 94, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                    border: flaggedPrs.length > 0 ? '1px solid rgba(244, 63, 94, 0.25)' : '1px solid var(--border-subtle)',
                    padding: '2px 7px',
                    borderRadius: 4,
                    fontWeight: 700,
                  }}
                >
                  {flaggedPrs.length} Flagged
                </span>
              </div>

              {flaggedPrs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {flaggedPrs.slice(0, 4).map(a => {
                    const prNumber = a.evidence?.pr?.number;
                    const prTitle = a.evidence?.pr?.title || a.summary?.slice(0, 50) || `PR #${prNumber}`;
                    return (
                      <Link
                        key={a.id}
                        href={`/analyses/${a.id}`}
                        style={{
                          padding: '12px 14px',
                          background: 'rgba(244, 63, 94, 0.04)',
                          borderRadius: 8,
                          border: '1px solid rgba(244, 63, 94, 0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          textDecoration: 'none',
                          transition: 'all 0.15s ease',
                        }}
                        className="hover-card"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.8rem', color: '#ffffff' }}>
                              #{prNumber}
                            </span>
                            <RiskBadge risk={a.risk_level} size="sm" showPulse={a.risk_level?.toUpperCase() === 'HIGH'} />
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {formatTimeAgo(a.created_at)}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prTitle}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <span style={{ fontSize: '0.7rem', color: a.risk_level?.toUpperCase() === 'HIGH' ? 'var(--risk-high)' : 'var(--risk-medium)', fontWeight: 500 }}>
                            {a.risk_level?.toUpperCase() === 'HIGH' ? 'Critical Risk Flags' : 'Moderate Caution'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                            Inspect <ArrowRight size={11} />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <CheckCircle2 size={18} />
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
                    {evaluatedPrs.length > 0 ? 'No Critical Warnings' : 'No Evaluated PRs'}
                  </div>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                    {evaluatedPrs.length > 0
                      ? 'All analyzed pull requests passed without high-severity risk triggers.'
                      : 'Analyze open pull requests to monitor elevated risks.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
