'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs-nav" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', transition: 'color 0.2s' }} className="breadcrumb-link" title="Dashboard">
        <Home size={14} />
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={index} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ChevronRight size={12} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
            {item.href && !isLast ? (
              <Link href={item.href} style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }} className="breadcrumb-link">
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ) : (
              <span style={{ color: isLast ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isLast ? 600 : 400, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
