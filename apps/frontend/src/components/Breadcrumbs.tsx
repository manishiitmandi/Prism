'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  const { isAuthenticated } = useAuth();
  const homeHref = isAuthenticated ? '/dashboard' : '/';

  function resolveHref(href?: string): string | undefined {
    if (!href) return undefined;
    if (href === '/#repositories') {
      return isAuthenticated ? '/dashboard#repositories' : '/dashboard';
    }
    return href;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="breadcrumbs-nav"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        marginBottom: 20,
      }}
    >
      <Link
        href={homeHref}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          color: 'var(--text-muted)',
          transition: 'color 0.2s',
        }}
        className="breadcrumb-link"
        title={isAuthenticated ? 'Dashboard' : 'Home'}
      >
        <Home size={14} />
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const resolvedHref = resolveHref(item.href);

        return (
          <div key={index} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ChevronRight size={12} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
            {resolvedHref && !isLast ? (
              <Link
                href={resolvedHref}
                style={{
                  color: 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  textDecoration: 'none',
                }}
                className="breadcrumb-link"
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ) : (
              <span
                style={{
                  color: isLast ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isLast ? 600 : 400,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
