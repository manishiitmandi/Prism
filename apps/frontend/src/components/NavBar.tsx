'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Layers,
  FolderGit2,
  GitPullRequest,
  Sparkles,
} from 'lucide-react';
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

  // Determine badge styling
  const badgeUpper = badge?.toUpperCase() || '';
  const isHighRisk = badgeUpper === 'HIGH' || badgeUpper.includes('HIGH');
  const isMediumRisk = badgeUpper === 'MEDIUM' || badgeUpper.includes('MEDIUM');
  const isLowRisk = badgeUpper === 'LOW' || badgeUpper.includes('LOW');

  let badgeClass = 'nav-context-default';
  let badgeLabel = badge || 'ENGINE';

  if (isHighRisk) {
    badgeClass = 'nav-context-high';
    badgeLabel = 'HIGH RISK';
  } else if (isMediumRisk) {
    badgeClass = 'nav-context-medium';
    badgeLabel = 'MEDIUM RISK';
  } else if (isLowRisk) {
    badgeClass = 'nav-context-low';
    badgeLabel = 'LOW RISK';
  }

  return (
    <nav className="nav-header" suppressHydrationWarning>
      <div className="nav-container" suppressHydrationWarning>
        {/* Left: Brand Identity & Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <Link href="/" className="nav-brand-group" suppressHydrationWarning>
            {/* Custom Faceted Refracting Geometric Prism Mark */}
            <div className="nav-prism-mark" title="PRism AI Pull Request Risk Analyzer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="prism-glass" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#c084fc" />
                    <stop offset="60%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                  <linearGradient id="prism-ray-blue" x1="12" y1="11" x2="21" y2="19" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                  <linearGradient id="prism-ray-pink" x1="12" y1="11" x2="3" y2="19" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#f472b6" />
                  </linearGradient>
                </defs>
                {/* Outer Glass Prism Triangle */}
                <polygon
                  points="12,3 21.5,19.5 2.5,19.5"
                  stroke="url(#prism-glass)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  fill="rgba(108, 99, 255, 0.16)"
                />
                {/* Central Refracted Ray Beam */}
                <line x1="12" y1="3" x2="12" y2="19.5" stroke="#ffffff" strokeWidth="1.4" strokeOpacity="0.85" />
                {/* Spectral Dispersions */}
                <line x1="12" y1="10.5" x2="21" y2="19.5" stroke="url(#prism-ray-blue)" strokeWidth="1.4" strokeOpacity="0.85" />
                <line x1="12" y1="10.5" x2="3" y2="19.5" stroke="url(#prism-ray-pink)" strokeWidth="1.4" strokeOpacity="0.85" />
                {/* Focal Core Spark */}
                <circle cx="12" cy="10.5" r="1.8" fill="#ffffff" />
              </svg>
            </div>

            {/* Wordmark */}
            <span className="nav-brand-title">
              PR<span className="nav-brand-gradient">ism</span>
            </span>
          </Link>

          {/* Context Divider & Subtitle */}
          {subtitle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span className="nav-brand-divider">/</span>
              <span className="nav-brand-subtitle" title={subtitle}>
                {subtitle}
              </span>
            </div>
          )}

          {/* Active Context / Risk Badge */}
          {badge && (
            <span className={`nav-context-pill ${badgeClass}`}>
              {(isHighRisk || isMediumRisk || isLowRisk) && <span className="nav-context-dot" />}
              <span>{badgeLabel}</span>
            </span>
          )}
        </div>

        {/* Center: Segmented Frosted Glass Navigation Track */}
        <div className="nav-segmented-track" suppressHydrationWarning>
          <Link
            href="/"
            className={`nav-segmented-item ${pathname === '/' ? 'active' : ''}`}
          >
            <Layers size={13} />
            <span>Workspace</span>
          </Link>

          <Link
            href="/#repositories"
            className={`nav-segmented-item ${pathname.startsWith('/repositories') ? 'active' : ''}`}
          >
            <FolderGit2 size={13} />
            <span>Repositories</span>
          </Link>

          <Link
            href="/#recent-analyses"
            className={`nav-segmented-item ${pathname.startsWith('/analyses') ? 'active' : ''}`}
          >
            <GitPullRequest size={13} />
            <span>Analyses</span>
          </Link>
        </div>

        {/* Right: Engine Telemetry Beacon & GitHub Link */}
        <div className="nav-right-group" suppressHydrationWarning>
          {/* Realtime Engine Telemetry Beacon */}
          <div
            className="nav-telemetry-capsule"
            title={
              isOnline === false
                ? 'PRism Backend API is currently offline'
                : `PRism Code Intelligence Engine ${version} · Systems Operational`
            }
          >
            <div className="nav-beacon-wrapper">
              <span className={`nav-beacon-dot ${isOnline === false ? 'offline' : 'online'}`} />
              <span className={`nav-beacon-ping ${isOnline === false ? 'offline' : 'online'}`} />
            </div>

            <div className="nav-telemetry-text">
              <span style={{ color: isOnline === false ? 'var(--risk-high)' : 'var(--text-primary)', fontWeight: 600 }}>
                {isOnline === null ? 'Connecting...' : isOnline ? `Core ${version}` : 'API Offline'}
              </span>
              <span className="nav-telemetry-sep">·</span>
              <span className="nav-telemetry-tag">{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>

          {/* Authentic GitHub Button */}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-github-btn"
            title="PRism on GitHub"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span className="nav-github-label">GitHub</span>
            <span className="nav-github-star-pill">★ Star</span>
          </a>

          {/* Quick Action Button */}
          <Link
            href="/#repositories"
            className="nav-action-btn"
            title="Analyze a Pull Request"
          >
            <Sparkles size={13} />
            <span>Analyze PR</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
