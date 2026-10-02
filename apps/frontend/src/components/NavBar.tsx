'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, GitPullRequest, FolderGit2, Layers, Cpu, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';

interface NavBarProps {
  subtitle?: string;
  badge?: string;
}

export default function NavBar({ subtitle, badge }: NavBarProps) {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string>('v0.1.0');

  useEffect(() => {
    let mounted = true;
    api.health()
      .then(res => {
        if (mounted) {
          setIsOnline(true);
          if (res.version) setVersion(`v${res.version}`);
        }
      })
      .catch(() => {
        if (mounted) setIsOnline(false);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <nav className="nav-header" suppressHydrationWarning>
      <div className="container nav-container" suppressHydrationWarning>
        {/* Left: Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }} suppressHydrationWarning>
          <Link href="/" className="nav-brand-link" suppressHydrationWarning>
            <div className="nav-logo-icon" suppressHydrationWarning>
              <Cpu size={18} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="nav-brand-title">PRism</span>
                <span
                  style={{
                    background: 'var(--accent-glow)',
                    color: 'var(--accent-secondary)',
                    border: '1px solid rgba(108,99,255,0.25)',
                    borderRadius: 4,
                    padding: '1px 6px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}
                >
                  {badge || 'ENGINE'}
                </span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1 }}>
                {subtitle || 'AI PR Risk & RAG Engine'}
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="nav-links-group" style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 16 }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: '0.825rem',
                fontWeight: 500,
                color: pathname === '/' ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: pathname === '/' ? 'var(--bg-elevated)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Layers size={14} />
              <span>Workspace</span>
            </Link>

            <Link
              href="/#repositories"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: '0.825rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <FolderGit2 size={14} />
              <span>Repositories</span>
            </Link>

            <Link
              href="/#recent-analyses"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: '0.825rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <GitPullRequest size={14} />
              <span>Analyses</span>
            </Link>
          </div>
        </div>

        {/* Right: Engine Health Indicator & Architecture Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }} suppressHydrationWarning>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 100,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
            }}
            title={isOnline === false ? 'Backend API is currently offline' : `PRism Core ${version} connected with pgvector`}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: isOnline === false ? 'var(--risk-high)' : 'var(--risk-low)',
                boxShadow: isOnline === false
                  ? '0 0 6px var(--risk-high)'
                  : '0 0 6px var(--risk-low)',
              }}
            />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem' }}>
              {isOnline === null ? (
                'Connecting...'
              ) : isOnline ? (
                <>
                  <span>Core {version}</span>
                  <span className="nav-status-details"> · pgvector</span>
                </>
              ) : (
                'Offline'
              )}
            </span>
          </div>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              textDecoration: 'none',
              padding: '4px 8px',
            }}
          >
            <span className="nav-status-details">GitHub</span>
            <ArrowUpRight size={12} />
          </a>
        </div>
      </div>
    </nav>
  );
}
