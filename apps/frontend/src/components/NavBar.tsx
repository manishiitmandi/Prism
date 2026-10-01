'use client';

import Link from 'next/link';

interface NavBarProps {
  subtitle?: string;
  badge?: string;
}

export default function NavBar({ subtitle, badge }: NavBarProps) {
  return (
    <nav className="nav-header" suppressHydrationWarning>
      <div className="container nav-container" suppressHydrationWarning>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} suppressHydrationWarning>
          <Link href="/" className="nav-brand-link" suppressHydrationWarning>
            <div className="nav-logo-icon" suppressHydrationWarning>P</div>
            <span className="nav-brand-title" suppressHydrationWarning>PRism</span>
          </Link>
          {badge && (
            <span
              style={{
                background: 'var(--accent-glow)',
                color: 'var(--accent-secondary)',
                border: '1px solid rgba(108,99,255,0.2)',
                borderRadius: 100,
                padding: '1px 8px',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
              suppressHydrationWarning
            >
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }} suppressHydrationWarning>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }} suppressHydrationWarning>
              {subtitle}
            </span>
          </div>
        )}
      </div>
    </nav>
  );
}
