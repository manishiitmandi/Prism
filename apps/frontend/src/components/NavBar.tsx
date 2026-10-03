'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Layers,
  FolderGit2,
  GitPullRequest,
  Sparkles,
  LogIn,
  LogOut,
  LayoutDashboard,
  ChevronDown,
  User as UserIcon,
  Activity,
  ShieldAlert,
  ArrowRight,
  Star,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import UserAvatar from '@/components/UserAvatar';

interface NavBarProps {
  subtitle?: string;
  badge?: string;
}

export default function NavBar({ subtitle, badge }: NavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, openAuthModal, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [starCount, setStarCount] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('https://api.github.com/repos/manishiitmandi/Prism')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && typeof data.stargazers_count === 'number') {
          setStarCount(data.stargazers_count);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
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
          {user ? (
            <>
              <Link
                href="/dashboard"
                className={`nav-segmented-item ${pathname === '/dashboard' ? 'active' : ''}`}
              >
                <LayoutDashboard size={13} />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/dashboard#repositories"
                className="nav-segmented-item"
              >
                <FolderGit2 size={13} />
                <span>Connected Repos</span>
              </Link>
              <Link
                href="/dashboard#analyses"
                className="nav-segmented-item"
              >
                <GitPullRequest size={13} />
                <span>Risk Reports</span>
              </Link>
              <Link
                href="/#simulator"
                className="nav-segmented-item"
              >
                <Sparkles size={13} />
                <span>Simulator</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/#features"
                className="nav-segmented-item"
              >
                <Layers size={13} />
                <span>Features</span>
              </Link>
              <Link
                href="/#simulator"
                className="nav-segmented-item"
              >
                <Sparkles size={13} />
                <span>Live Simulator</span>
              </Link>
              <Link
                href="/#how-it-works"
                className="nav-segmented-item"
              >
                <Activity size={13} />
                <span>How It Works</span>
              </Link>
              <Link
                href="/#metrics"
                className="nav-segmented-item"
              >
                <ShieldAlert size={13} />
                <span>Risk Metrics</span>
              </Link>
            </>
          )}
        </div>

        {/* Right: GitHub Link & Auth Profile */}
        <div className="nav-right-group" suppressHydrationWarning>

          {/* Authentic GitHub Button */}
          <a
            href="https://github.com/manishiitmandi/Prism"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-github-btn"
            title="Star manishiitmandi/Prism on GitHub"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span className="nav-github-label">GitHub</span>
            <span className="nav-github-star-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Star size={10} fill="currentColor" />
              <span>Star</span>
              {starCount !== null && starCount > 0 && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
                    paddingLeft: 4,
                    marginLeft: 2,
                    fontWeight: 600,
                  }}
                >
                  {starCount}
                </span>
              )}
            </span>
          </a>

          {/* Auth Controls: User Dropdown or Sign In Button */}
          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 10px 4px 5px',
                  borderRadius: 100,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                }}
              >
                <UserAvatar
                  avatarUrl={user.avatar_url}
                  name={user.name}
                  username={user.username}
                  size={22}
                  borderRadius="50%"
                />
                <span>{user.name?.split(' ')[0] || user.username}</span>
                <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
              </button>

              {showUserMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 210,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 6,
                    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7), 0 0 20px rgba(99, 102, 241, 0.12)',
                    zIndex: 1000,
                    animation: 'slideUp 0.15s ease',
                  }}
                >
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <UserAvatar
                      avatarUrl={user.avatar_url}
                      name={user.name}
                      username={user.username}
                      size={32}
                      borderRadius="50%"
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.name || user.username}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        @{user.username} · {user.auth_provider}
                      </div>
                    </div>
                  </div>

                  <Link
                    href="/dashboard"
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      fontSize: '0.78rem',
                      textDecoration: 'none',
                    }}
                    className="hover-card"
                  >
                    <LayoutDashboard size={14} style={{ color: 'var(--accent-secondary)' }} />
                    <span>My Dashboard</span>
                  </Link>

                  <button
                    type="button"
                    onClick={async () => {
                      setShowUserMenu(false);
                      await logout();
                      router.push('/');
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      color: 'var(--risk-high)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      textAlign: 'left',
                    }}
                    className="hover-card"
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link
                href="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 13px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
                className="hover-card"
              >
                <LogIn size={13} style={{ color: 'var(--text-secondary)' }} />
                <span>Sign In</span>
              </Link>
              <Link
                href="/login?mode=register"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  border: '1px solid rgba(167, 139, 250, 0.4)',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  boxShadow: '0 2px 14px rgba(99, 102, 241, 0.35)',
                  transition: 'all 0.15s ease',
                }}
                className="hover-bright"
              >
                <span>Get Started</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
