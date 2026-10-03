'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  GitPullRequest,
  GitBranch,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  Cpu,
  Search,
  CheckCircle2,
  AlertTriangle,
  Play,
  Loader2,
  Lock,
  Globe,
  Database,
  Terminal,
  Activity,
  Zap,
  Check,
  X,
  Code2,
  ChevronRight,
  FileCode,
  Users,
} from 'lucide-react';

// Preset mock PR data for instant interactive simulation
const SIMULATOR_PRESETS = [
  {
    id: 'auth-bypass',
    tag: 'CRITICAL SECURITY',
    tagColor: 'var(--risk-high)',
    title: 'refactor(auth): bypass token expiration in refresh rotation',
    repo: 'acme-corp/identity-service',
    prNumber: 412,
    author: 'alex-dev',
    branch: 'fix/token-rotation → main',
    filesChanged: 14,
    additions: 412,
    deletions: 89,
    riskScore: 88,
    riskLevel: 'HIGH',
    summary:
      'Critical architectural flaw: Token refresh routine fails to validate JWT expiration against revoked token blacklist. 6 downstream public API services are exposed to unauthorized session hijacking.',
    verdict: 'BLOCK MERGE — Requires urgent security patch before deployment',
    pillars: {
      architecture: { score: 92, label: 'Breaking contract across 6 downstream API endpoints' },
      security: { score: 94, label: 'Unchecked token expiration & revocation bypass' },
      complexity: { score: 78, label: 'High cyclomatic complexity in middleware chain' },
      tests: { score: 32, label: 'No regression unit tests added for expired token failure mode' },
    },
    blastRadius: [
      { name: '/api/v1/billing/checkout', type: 'Public API', impact: 'Direct Exposure' },
      { name: '/api/v1/users/profile', type: 'Public API', impact: 'Direct Exposure' },
      { name: 'AuthGuardMiddleware', type: 'Core Middleware', impact: 'Broken Contract' },
      { name: 'SessionTokenStore', type: 'Data Store', impact: 'Stale Sessions' },
      { name: 'AuditLogEmitter', type: 'Telemetry', impact: 'Missing Event Logs' },
    ],
    remediations: [
      'Reinstate expiration timestamp check in `rotateRefreshToken()` at line 142.',
      'Query the Redis token revocation store before issuing fresh access tokens.',
      'Add end-to-end integration tests asserting 401 Unauthorized for expired tokens.',
    ],
  },
  {
    id: 'db-migration',
    tag: 'DATABASE MIGRATION',
    tagColor: 'var(--risk-medium)',
    title: 'migration: rename tier_id to subscription_tier_id on users table',
    repo: 'acme-corp/core-billing',
    prNumber: 289,
    author: 'sarah-eng',
    branch: 'feat/tier-naming → main',
    filesChanged: 8,
    additions: 190,
    deletions: 45,
    riskScore: 64,
    riskLevel: 'MEDIUM',
    summary:
      'Database migration introduces exclusive table lock on 2.4M user records without concurrent index support. Downstream payment webhook handlers will experience database connection timeouts during rolling rollout.',
    verdict: 'NEEDS ATTENTION — Apply dual-write migration pattern to eliminate downtime',
    pillars: {
      architecture: { score: 74, label: 'Breaking schema column rename on primary entity' },
      security: { score: 25, label: 'No sensitive credentials or access controls impacted' },
      complexity: { score: 62, label: 'Multi-step distributed state migration required' },
      tests: { score: 78, label: 'Schema tests exist but lack zero-downtime rolling test' },
    },
    blastRadius: [
      { name: 'StripeWebhookHandler', type: 'Webhook Worker', impact: 'Connection Timeout Risk' },
      { name: 'SubscriptionResolver', type: 'GraphQL Query', impact: 'Field Deprecation Warning' },
      { name: 'BillingExportJob', type: 'Nightly Cron', impact: 'Column Not Found Risk' },
    ],
    remediations: [
      'Use expand-and-contract pattern: add `subscription_tier_id` first, keep `tier_id` as alias.',
      'Add `CONCURRENTLY` flag to avoid table exclusive locks in production.',
    ],
  },
  {
    id: 'cache-refactor',
    tag: 'LOW RISK OPTIMIZATION',
    tagColor: 'var(--risk-low)',
    title: 'perf(cache): lru eviction strategy & comprehensive unit suite',
    repo: 'acme-corp/cache-layer',
    prNumber: 154,
    author: 'elena-tech',
    branch: 'perf/lru-cache → main',
    filesChanged: 4,
    additions: 85,
    deletions: 30,
    riskScore: 12,
    riskLevel: 'LOW',
    summary:
      'Internal performance refactoring with 98% unit test coverage. No exported interfaces or public function signatures altered. Memory utilization benchmarked at 24% reduction with zero behavioral regressions.',
    verdict: 'SAFE TO MERGE — Automated checks passed with high confidence',
    pillars: {
      architecture: { score: 10, label: 'Internal encapsulation preserved; zero contract changes' },
      security: { score: 5, label: 'No external network or user input pathways touched' },
      complexity: { score: 18, label: 'Clean algorithm structure with O(1) eviction' },
      tests: { score: 98, label: 'Exhaustive edge-case unit tests and memory leak assertions' },
    },
    blastRadius: [
      { name: 'LocalCacheStore', type: 'Internal Helper', impact: 'Non-breaking Refactor' },
      { name: 'CacheMetricsCollector', type: 'Telemetry', impact: 'Enhanced Metrics' },
    ],
    remediations: [
      'All automated quality and security checks passed cleanly. Ready for immediate merge.',
    ],
  },
];

function parseGitHubPrUrl(input: string): { owner: string; name: string; prNumber: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)/i
  );
  if (urlMatch) {
    return { owner: urlMatch[1], name: urlMatch[2], prNumber: parseInt(urlMatch[3], 10) };
  }
  const shortMatch =
    trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)#(\d+)$/i) ||
    trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)$/i);
  if (shortMatch) {
    return { owner: shortMatch[1], name: shortMatch[2], prNumber: parseInt(shortMatch[3], 10) };
  }
  return null;
}

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  // Interactive Simulator State
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const activePreset = SIMULATOR_PRESETS[activePresetIndex];

  // Live URL Analysis State
  const [prUrl, setPrUrl] = useState('');
  const [analyzingLive, setAnalyzingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  async function handleLiveAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setLiveError(null);

    const parsed = parseGitHubPrUrl(prUrl);
    if (!parsed) {
      setLiveError('Please enter a valid GitHub PR link (e.g. https://github.com/fastapi/fastapi/pull/16159 or fastapi/fastapi#16159).');
      return;
    }

    setAnalyzingLive(true);
    try {
      const repo = await api.createRepository(parsed.owner, parsed.name);
      const res = await api.triggerAnalysis(repo.id, parsed.prNumber);
      router.push(`/analyses/${res.id}`);
    } catch (err: unknown) {
      setLiveError(err instanceof Error ? err.message : 'Failed to analyze pull request');
      setAnalyzingLive(false);
    }
  }

  return (
    <div className="page-wrapper" style={{ minHeight: '100vh', background: '#080a11', color: '#f8fafc' }}>
      <NavBar subtitle="AI Code Intelligence" />

      {/* ─── Hero Section ──────────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          paddingTop: '80px',
          paddingBottom: '90px',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {/* Ambient Radial Lights */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '85vw',
            maxWidth: '1200px',
            height: '650px',
            background:
              'radial-gradient(circle, rgba(99, 102, 241, 0.16) 0%, rgba(168, 85, 247, 0.08) 40%, transparent 70%)',
            filter: 'blur(90px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '30%',
            right: '-10%',
            width: '450px',
            height: '450px',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, transparent 70%)',
            filter: 'blur(90px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div className="container" style={{ position: 'relative', zIndex: 1, maxWidth: '1000px' }}>
          {/* Top Announcement Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 100,
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(167, 139, 250, 0.35)',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.2)',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#c084fc',
              marginBottom: 24,
            }}
          >
            <Sparkles size={14} style={{ color: '#38bdf8' }} />
            <span>AI-Powered Pull Request Risk Intelligence</span>
            <span style={{ opacity: 0.4 }}>•</span>
            <span style={{ color: '#38bdf8' }}>Next-Gen Code Governance</span>
          </div>

          {/* Main Headline */}
          <h1
            style={{
              fontSize: 'clamp(2.5rem, 5.8vw, 4.4rem)',
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: '-0.035em',
              color: '#ffffff',
              marginBottom: 22,
            }}
          >
            Merge with Total Confidence.{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block',
              }}
            >
              Zero Breaking Regressions.
            </span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 'clamp(1rem, 1.3vw, 1.25rem)',
              color: '#94a3b8',
              maxWidth: '780px',
              margin: '0 auto 36px',
              lineHeight: 1.6,
            }}
          >
            PRism automatically analyzes git diffs, traces downstream blast radiuses, catches security
            vulnerabilities, and evaluates architectural regressions before code ever hits production.
          </p>

          {/* Dual Action CTAs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              flexWrap: 'wrap',
              marginBottom: 56,
            }}
          >
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '13px 28px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    border: '1px solid rgba(167, 139, 250, 0.4)',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 6px 24px rgba(99, 102, 241, 0.45), 0 0 12px rgba(168, 85, 247, 0.3)',
                    transition: 'all 0.2s ease',
                  }}
                  className="hover-bright"
                >
                  <Layers size={18} />
                  <span>Go to My Dashboard</span>
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="#simulator"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '13px 26px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  className="hover-card"
                >
                  <Sparkles size={16} style={{ color: '#c084fc' }} />
                  <span>Test Live Simulator ↓</span>
                </a>
              </>
            ) : (
              <>
                <Link
                  href="/login?mode=register"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '13px 28px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    border: '1px solid rgba(167, 139, 250, 0.4)',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 6px 24px rgba(99, 102, 241, 0.45), 0 0 12px rgba(168, 85, 247, 0.3)',
                    transition: 'all 0.2s ease',
                  }}
                  className="hover-bright"
                >
                  <span>Start Free Analysis</span>
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/login"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '13px 24px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  className="hover-card"
                >
                  <span>Sign In</span>
                </Link>
                <a
                  href="#simulator"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.88rem',
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    padding: '10px 14px',
                  }}
                  className="hover-bright"
                >
                  <Sparkles size={14} style={{ color: '#c084fc' }} />
                  <span>Try Interactive Demo ↓</span>
                </a>
              </>
            )}
          </div>

          {/* Social Proof / Metric Pill Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              padding: '14px 20px',
              borderRadius: 16,
              background: 'rgba(18, 22, 38, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
                &lt; 3s
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>AST &amp; Semantic Audit Latency</div>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', fontFamily: "'JetBrains Mono', monospace" }}>
                4 Pillars
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Multi-Vector Risk Matrix</div>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#c084fc', fontFamily: "'JetBrains Mono', monospace" }}>
                Zero
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>False Alarm Semantic Deduplication</div>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', fontFamily: "'JetBrains Mono', monospace" }}>
                100%
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>GitHub Webhook Automation</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Interactive Live PR Risk Simulator Section ────────────────── */}
      <section
        id="simulator"
        style={{
          padding: '70px 0 90px',
          background: 'linear-gradient(180deg, rgba(13, 16, 26, 0.9) 0%, rgba(8, 10, 17, 1) 100%)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          position: 'relative',
        }}
      >
        <div className="container" style={{ maxWidth: '1100px' }}>
          {/* Section Heading */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#38bdf8',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Interactive Playground
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', marginTop: 6, marginBottom: 12 }}>
              Experience the PRism Risk Engine in Real-Time
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.94rem', maxWidth: '650px', margin: '0 auto' }}>
              Select a simulated real-world pull request scenario below, or paste any public GitHub pull request link to
              witness deep AST blast radius and risk scoring.
            </p>
          </div>

          {/* Simulator Scenario Switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 26,
            }}
          >
            {SIMULATOR_PRESETS.map((preset, idx) => {
              const isActive = activePresetIndex === idx;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setActivePresetIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 18px',
                    borderRadius: 10,
                    background: isActive ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${isActive ? 'rgba(167, 139, 250, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: isActive ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    boxShadow: isActive ? '0 0 20px rgba(99, 102, 241, 0.3)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: preset.tagColor,
                      boxShadow: `0 0 8px ${preset.tagColor}`,
                    }}
                  />
                  <span>{preset.tag}</span>
                  <span style={{ fontSize: '0.72rem', opacity: 0.6, fontFamily: "'JetBrains Mono', monospace" }}>
                    ({preset.riskScore}/100)
                  </span>
                </button>
              );
            })}
          </div>

          {/* Interactive Live Input Bar for Any GitHub PR */}
          <form
            onSubmit={handleLiveAnalyze}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 14,
              background: 'rgba(18, 22, 38, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
              maxWidth: '820px',
              margin: '0 auto 36px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8, color: '#38bdf8' }}>
              <GitPullRequest size={18} />
            </div>
            <input
              type="text"
              placeholder="Or test your own PR: https://github.com/owner/repo/pull/123 or owner/repo#45"
              value={prUrl}
              onChange={e => setPrUrl(e.target.value)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.88rem',
                outline: 'none',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
            <button
              type="submit"
              disabled={analyzingLive}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 18px',
                borderRadius: 9,
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 12px rgba(99, 102, 241, 0.4)',
              }}
            >
              {analyzingLive ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Auditing PR...</span>
                </>
              ) : (
                <>
                  <Play size={13} fill="currentColor" />
                  <span>Analyze Live PR</span>
                </>
              )}
            </button>
          </form>

          {liveError && (
            <div
              style={{
                maxWidth: '820px',
                margin: '-20px auto 30px',
                padding: '10px 16px',
                borderRadius: 10,
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: 'var(--risk-high)',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{liveError}</span>
            </div>
          )}

          {/* Active Preset Display Card (The PRism Risk Intelligence HUD) */}
          <div
            style={{
              borderRadius: 20,
              background: 'linear-gradient(180deg, rgba(22, 27, 44, 0.95) 0%, rgba(13, 16, 28, 0.98) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.15)',
              overflow: 'hidden',
            }}
          >
            {/* Top Accent Strip */}
            <div
              style={{
                height: 3,
                width: '100%',
                background:
                  activePreset.riskLevel === 'HIGH'
                    ? 'linear-gradient(90deg, #f43f5e 0%, #fb7185 100%)'
                    : activePreset.riskLevel === 'MEDIUM'
                    ? 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'
                    : 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
              }}
            />

            {/* Simulated PR Meta Bar */}
            <div
              style={{
                padding: '20px 28px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
                background: 'rgba(0, 0, 0, 0.25)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      color: activePreset.tagColor,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    #{activePreset.prNumber}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>
                    {activePreset.repo}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>•</span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>by @{activePreset.author}</span>
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  {activePreset.title}
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#94a3b8',
                    display: 'flex',
                    gap: 10,
                  }}
                >
                  <span style={{ color: '#10b981' }}>+{activePreset.additions}</span>
                  <span style={{ color: '#f43f5e' }}>-{activePreset.deletions}</span>
                  <span>{activePreset.filesChanged} files</span>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 100,
                    background:
                      activePreset.riskLevel === 'HIGH'
                        ? 'rgba(244, 63, 94, 0.15)'
                        : activePreset.riskLevel === 'MEDIUM'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(16, 185, 129, 0.15)',
                    border: `1px solid ${
                      activePreset.riskLevel === 'HIGH'
                        ? 'rgba(244, 63, 94, 0.4)'
                        : activePreset.riskLevel === 'MEDIUM'
                        ? 'rgba(245, 158, 11, 0.4)'
                        : 'rgba(16, 185, 129, 0.4)'
                    }`,
                    color: activePreset.tagColor,
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    letterSpacing: '0.04em',
                  }}
                >
                  {activePreset.riskLevel === 'HIGH' ? (
                    <ShieldAlert size={14} />
                  ) : activePreset.riskLevel === 'MEDIUM' ? (
                    <AlertTriangle size={14} />
                  ) : (
                    <ShieldCheck size={14} />
                  )}
                  <span>{activePreset.riskScore} / 100 {activePreset.riskLevel} RISK</span>
                </div>
              </div>
            </div>

            {/* Core Breakdown Grid */}
            <div style={{ padding: '28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
              {/* Left Column: Summary & 4-Pillar Matrix */}
              <div>
                <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Executive Risk Summary
                </h4>
                <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: 20 }}>
                  {activePreset.summary}
                </p>

                {/* 4 Pillars Progress Sliders */}
                <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
                  Multi-Vector Risk Breakdown
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {Object.entries(activePreset.pillars).map(([key, val]) => {
                    const color =
                      val.score >= 70 ? '#f43f5e' : val.score >= 40 ? '#f59e0b' : '#10b981';
                    return (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                          <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#ffffff' }}>
                            {key} Risk
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color }}>
                            {val.score}%
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 10, background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${val.score}%`,
                              borderRadius: 10,
                              background: color,
                              boxShadow: `0 0 10px ${color}`,
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 3 }}>
                          {val.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Blast Radius & Actionable Remediations */}
              <div>
                <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Downstream Blast Radius ({activePreset.blastRadius.length} Items Affected)
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {activePreset.blastRadius.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Code2 size={14} style={{ color: '#38bdf8' }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff', fontFamily: "'JetBrains Mono', monospace" }}>
                          {item.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{item.type}</span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background:
                              item.impact === 'Direct Exposure'
                                ? 'rgba(244, 63, 94, 0.2)'
                                : 'rgba(255, 255, 255, 0.08)',
                            color: item.impact === 'Direct Exposure' ? 'var(--risk-high)' : '#cbd5e1',
                          }}
                        >
                          {item.impact}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* AI Merge Verdict Box */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 12,
                    background:
                      activePreset.riskLevel === 'HIGH'
                        ? 'rgba(244, 63, 94, 0.1)'
                        : activePreset.riskLevel === 'MEDIUM'
                        ? 'rgba(245, 158, 11, 0.1)'
                        : 'rgba(16, 185, 129, 0.1)',
                    border: `1px solid ${
                      activePreset.riskLevel === 'HIGH'
                        ? 'rgba(244, 63, 94, 0.3)'
                        : activePreset.riskLevel === 'MEDIUM'
                        ? 'rgba(245, 158, 11, 0.3)'
                        : 'rgba(16, 185, 129, 0.3)'
                    }`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Sparkles size={16} style={{ color: activePreset.tagColor }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff' }}>
                      Automated Merge Verdict
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: activePreset.tagColor, marginBottom: 8 }}>
                    {activePreset.verdict}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {activePreset.remediations.map((r, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.78rem', color: '#cbd5e1' }}>
                        <ChevronRight size={13} style={{ color: activePreset.tagColor, flexShrink: 0, marginTop: 2 }} />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Core Architecture & Features Bento Grid ───────────────────── */}
      <section
        id="features"
        style={{
          padding: '90px 0',
          position: 'relative',
        }}
      >
        <div className="container" style={{ maxWidth: '1100px' }}>
          <div style={{ textAlign: 'center', marginBottom: 54 }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#c084fc',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Enterprise Engineering Capabilities
            </span>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#ffffff', marginTop: 8, marginBottom: 14 }}>
              Why World-Class Teams Rely on PRism
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.96rem', maxWidth: '640px', margin: '0 auto' }}>
              Standard linters analyze syntax in isolation. PRism understands architectural dependencies, downstream
              consumers, and security blast radiuses across your entire git repository.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {/* Bento Card 1 */}
            <div
              style={{
                padding: '30px',
                borderRadius: 18,
                background: 'rgba(18, 22, 38, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(99, 102, 241, 0.18)',
                  border: '1px solid rgba(167, 139, 250, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#c084fc',
                  marginBottom: 18,
                }}
              >
                <Layers size={22} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginBottom: 10 }}>
                Downstream Blast Radius Mapping
              </h3>
              <p style={{ fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.6 }}>
                Traces every imported symbol, microservice contract, and database query touched by a pull request to
                visualize the cascading impact before deploying.
              </p>
            </div>

            {/* Bento Card 2 */}
            <div
              style={{
                padding: '30px',
                borderRadius: 18,
                background: 'rgba(18, 22, 38, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(56, 189, 248, 0.18)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                  marginBottom: 18,
                }}
              >
                <Cpu size={22} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginBottom: 10 }}>
                AST &amp; LLM Semantic Hybrid
              </h3>
              <p style={{ fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.6 }}>
                Fuses deterministic Abstract Syntax Tree parsing with generative code intelligence to eliminate false
                positives while detecting subtle business logic regressions.
              </p>
            </div>

            {/* Bento Card 3 */}
            <div
              style={{
                padding: '30px',
                borderRadius: 18,
                background: 'rgba(18, 22, 38, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(244, 63, 94, 0.18)',
                  border: '1px solid rgba(244, 63, 94, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--risk-high)',
                  marginBottom: 18,
                }}
              >
                <ShieldAlert size={22} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginBottom: 10 }}>
                Proactive Security &amp; CVE Interceptor
              </h3>
              <p style={{ fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.6 }}>
                Intercepts hardcoded secrets, dangerous SQL queries, deserialization bugs, and vulnerable dependency
                version bumps directly in the pull request diff.
              </p>
            </div>

            {/* Bento Card 4 */}
            <div
              style={{
                padding: '30px',
                borderRadius: 18,
                background: 'rgba(18, 22, 38, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.18)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                  marginBottom: 18,
                }}
              >
                <Zap size={22} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginBottom: 10 }}>
                Zero CI Friction Integration
              </h3>
              <p style={{ fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.6 }}>
                Connects via GitHub webhooks or OAuth in 60 seconds. Provides GitHub Status Checks and automated inline PR
                review comments without slowing down developers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works (3 Steps) ────────────────────────────────────── */}
      <section
        id="how-it-works"
        style={{
          padding: '80px 0',
          background: 'rgba(13, 16, 26, 0.6)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div className="container" style={{ maxWidth: '1000px' }}>
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#38bdf8',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Streamlined Workflow
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', marginTop: 8 }}>
              From Pull Request to Confident Merge in Seconds
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            <div
              style={{
                padding: '24px',
                borderRadius: 16,
                background: 'rgba(18, 22, 38, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#6366f1',
                  marginBottom: 10,
                }}
              >
                STEP 01
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>
                Connect Repository
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.5 }}>
                Track public open-source repos or link your team&apos;s private GitHub repositories with one click.
              </p>
            </div>

            <div
              style={{
                padding: '24px',
                borderRadius: 16,
                background: 'rgba(18, 22, 38, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#a855f7',
                  marginBottom: 10,
                }}
              >
                STEP 02
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>
                Sub-Second Deep Analysis
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.5 }}>
                PRism maps symbol diffs, evaluates security vulnerabilities, and models the complete blast radius.
              </p>
            </div>

            <div
              style={{
                padding: '24px',
                borderRadius: 16,
                background: 'rgba(18, 22, 38, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#10b981',
                  marginBottom: 10,
                }}
              >
                STEP 03
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>
                Review &amp; Merge Safely
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.5 }}>
                Inspect prioritized risks on your personal dashboard, review inline GitHub comments, and merge without
                fear.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Comparison Matrix Table ───────────────────────────────────── */}
      <section
        id="metrics"
        style={{
          padding: '80px 0 90px',
        }}
      >
        <div className="container" style={{ maxWidth: '960px' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#10b981',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              The Next Evolution
            </span>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', marginTop: 8 }}>
              Traditional Linters vs. PRism Code Intelligence
            </h2>
          </div>

          <div
            style={{
              borderRadius: 18,
              background: 'rgba(18, 22, 38, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0, 0, 0, 0.3)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 600 }}>Capability</th>
                  <th style={{ padding: '16px 20px', color: '#cbd5e1', fontWeight: 600 }}>Legacy Linters &amp; SAST</th>
                  <th style={{ padding: '16px 20px', color: '#c084fc', fontWeight: 800 }}>PRism AI Platform</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: '#ffffff' }}>Downstream Blast Radius</td>
                  <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <X size={14} style={{ color: 'var(--risk-high)' }} />
                      <span>None (File-scoped only)</span>
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: 700 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Check size={14} style={{ color: '#10b981' }} />
                      <span>Full cross-repo dependency graph</span>
                    </span>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: '#ffffff' }}>Semantic Code Understanding</td>
                  <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <X size={14} style={{ color: 'var(--risk-high)' }} />
                      <span>Regex &amp; static rules only</span>
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: 700 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Check size={14} style={{ color: '#10b981' }} />
                      <span>Deep contextual LLM + AST reasoning</span>
                    </span>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: '#ffffff' }}>Actionable Merge Verdicts</td>
                  <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <X size={14} style={{ color: 'var(--risk-high)' }} />
                      <span>Hundreds of noise alerts</span>
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: 700 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Check size={14} style={{ color: '#10b981' }} />
                      <span>Clear GO / NO-GO executive index</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: '#ffffff' }}>Setup &amp; Onboarding</td>
                  <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={14} style={{ color: 'var(--risk-medium)' }} />
                      <span>Heavy CI YAML configuration</span>
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: 700 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Check size={14} style={{ color: '#10b981' }} />
                      <span>Instant zero-config setup (60s)</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Bottom Call-to-Action Banner ──────────────────────────────── */}
      <section style={{ padding: '40px 0 100px' }}>
        <div className="container" style={{ maxWidth: '960px' }}>
          <div
            style={{
              padding: '50px 36px',
              borderRadius: 24,
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(168, 85, 247, 0.12) 100%)',
              border: '1px solid rgba(167, 139, 250, 0.35)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 50px rgba(99, 102, 241, 0.2)',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <h2 style={{ fontSize: '2.4rem', fontWeight: 900, color: '#ffffff', marginBottom: 12 }}>
              Ready to Secure Your Pull Requests?
            </h2>
            <p style={{ color: '#cbd5e1', fontSize: '1rem', maxWidth: '580px', margin: '0 auto 28px', lineHeight: 1.6 }}>
              Join engineering leaders and developers who merge faster with zero regressions. Start tracking repositories
              in under a minute.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '13px 28px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 4px 20px rgba(99, 102, 241, 0.45)',
                  }}
                  className="hover-bright"
                >
                  <Layers size={17} />
                  <span>Open Your Dashboard</span>
                  <ArrowRight size={15} />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login?mode=register"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '13px 30px',
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                      color: '#ffffff',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      boxShadow: '0 4px 20px rgba(99, 102, 241, 0.45)',
                    }}
                    className="hover-bright"
                  >
                    <span>Create Free Account</span>
                    <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/login"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '13px 24px',
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#ffffff',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                    className="hover-card"
                  >
                    <span>Sign In</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}
