'use client';

import Link from 'next/link';
import { GitPullRequest, GitBranch, ExternalLink, Clock, User, Layers, CheckCircle2 } from 'lucide-react';
import { Analysis } from '@/lib/api';
import RiskBadge from '@/components/RiskBadge';
import StatusBadge from '@/components/StatusBadge';
import { formatDuration, formatTimeAgo } from '@/lib/utils';

interface AnalysisHeaderProps {
  analysis: Analysis;
}

export default function AnalysisHeader({ analysis }: AnalysisHeaderProps) {
  const pr = analysis.evidence?.pr;
  const repo = analysis.evidence?.repository;

  const prNumber = pr?.number ?? (analysis.pull_request_id ? `#${analysis.pull_request_id.slice(0, 6)}` : null);
  const prTitle = pr?.title || analysis.summary?.split('\n')[0] || `Pull Request Analysis`;
  const author = pr?.author || 'Contributor';
  const additions = pr?.additions ?? analysis.changed_files_data?.reduce((acc, f) => acc + (f.added_lines || 0), 0) ?? 0;
  const deletions = pr?.deletions ?? analysis.changed_files_data?.reduce((acc, f) => acc + (f.removed_lines || 0), 0) ?? 0;
  const changedFilesCount = analysis.changed_files_data?.length ?? (pr as any)?.changed_files ?? 0;

  const githubPrUrl = pr?.html_url || (repo ? `https://github.com/${repo.full_name || `${repo.owner}/${repo.name}`}/pull/${pr?.number}` : null);

  return (
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
        {/* Left: PR Identity */}
        <div style={{ flex: '1 1 500px', minWidth: 0 }}>
          {/* Repo & Meta Line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            {repo && (
              <Link
                href={`/repositories/${repo.name}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--accent-secondary)',
                  textDecoration: 'none',
                }}
              >
                <Layers size={13} />
                <span>{repo.full_name || `${repo.owner}/${repo.name}`}</span>
              </Link>
            )}

            <span style={{ color: 'var(--border)' }}>/</span>

            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
              }}
            >
              PR #{pr?.number || '—'}
            </span>

            {githubPrUrl && (
              <a
                href={githubPrUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  textDecoration: 'none',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
                className="hover-bright"
              >
                <span>View on GitHub</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: '1.45rem',
              fontWeight: 700,
              lineHeight: 1.3,
              marginBottom: 12,
              color: 'var(--text-primary)',
              wordBreak: 'break-word',
            }}
          >
            {prTitle}
          </h1>

          {/* Metadata badges row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {/* Author */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <User size={13} style={{ color: 'var(--text-muted)' }} />
              <span>{author}</span>
            </div>

            {/* Branches */}
            {(pr?.base_branch || pr?.head_branch) && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>
                <GitBranch size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)' }}>{pr.base_branch || 'main'}</span>
                <span>←</span>
                <span style={{ color: 'var(--accent-secondary)' }}>{pr.head_branch}</span>
              </div>
            )}

            {/* Diff Stats */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--risk-low)', fontWeight: 600 }}>+{additions}</span>
              <span style={{ color: 'var(--risk-high)', fontWeight: 600 }}>-{deletions}</span>
              <span style={{ color: 'var(--text-muted)' }}>in {changedFilesCount} {changedFilesCount === 1 ? 'file' : 'files'}</span>
            </div>

            {/* Created / Elapsed */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              <Clock size={12} />
              <span>{formatTimeAgo(analysis.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Right: Risk Level & Status Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            minWidth: 200,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Risk Assessment
            </span>
            <RiskBadge risk={analysis.risk_level} size="lg" showPulse />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
            <StatusBadge status={analysis.status} size="sm" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
              <span>Time:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatDuration(analysis.duration_seconds)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
