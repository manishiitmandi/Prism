'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowUp,
  ShieldCheck,
  Terminal,
  Activity,
  Sparkles,
  Lock,
  GitPullRequest,
  Database,
  Cpu,
  Globe,
  Code2,
  CheckCircle2,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function Footer() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string>('v0.1.0');
  const currentYear = new Date().getFullYear();

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
    return () => {
      mounted = false;
    };
  }, []);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer
      style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'linear-gradient(180deg, #06080e 0%, #030408 100%)',
        position: 'relative',
        overflow: 'hidden',
        color: '#94a3b8',
      }}
    >
      {/* Ambient background glow accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '75%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.45), rgba(192, 132, 252, 0.45), transparent)',
          filter: 'blur(1px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -120,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 500,
          height: 240,
          background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div className="container" style={{ paddingTop: 64, paddingBottom: 40 }}>
        {/* Main 5-Column Grid */}
        <div
          className="footer-main-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
            gap: 36,
            marginBottom: 56,
          }}
        >
          {/* Column 1: Brand & Intelligence Engine */}
          <div>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                textDecoration: 'none',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 16px rgba(99, 102, 241, 0.25)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="prism-glass-footer" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#c084fc" />
                      <stop offset="60%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                  </defs>
                  <polygon
                    points="12,3 21.5,19.5 2.5,19.5"
                    stroke="url(#prism-glass-footer)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    fill="rgba(108, 99, 255, 0.16)"
                  />
                  <line x1="12" y1="3" x2="12" y2="19.5" stroke="#ffffff" strokeWidth="1.4" strokeOpacity="0.85" />
                  <circle cx="12" cy="10.5" r="1.8" fill="#ffffff" />
                </svg>
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                PR<span style={{ background: 'linear-gradient(135deg, #c084fc, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ism</span>
              </span>
            </Link>

            <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: 22, maxWidth: 300 }}>
              Autonomous AI pull request risk intelligence & downstream blast-radius analysis for mission-critical software engineering teams.
            </p>

            {/* Realtime Core Backend Status Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 9,
                padding: '6px 14px',
                borderRadius: 100,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.74rem',
                color: '#cbd5e1',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              }}
              title="FastAPI Intelligence Core Status"
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: isOnline === false ? '#ef4444' : '#10b981',
                  boxShadow: isOnline === false ? '0 0 8px #ef4444' : '0 0 8px #10b981',
                }}
              />
              <span style={{ fontWeight: 600, color: '#ffffff' }}>
                Core Engine {version}
              </span>
              <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
              <span style={{ color: isOnline === false ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                {isOnline === null ? 'Connecting...' : isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Column 2: Product & Capabilities */}
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>
              Product
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11, fontSize: '0.84rem' }}>
              <li>
                <a href="/#simulator" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.15s' }} className="hover-bright">
                  Interactive Simulator
                </a>
              </li>
              <li>
                <a href="/#features" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.15s' }} className="hover-bright">
                  Blast Radius Graph
                </a>
              </li>
              <li>
                <a href="/#features" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.15s' }} className="hover-bright">
                  AST Call Tracing
                </a>
              </li>
              <li>
                <a href="/#how-it-works" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.15s' }} className="hover-bright">
                  Automated Guardrails
                </a>
              </li>
              <li>
                <Link href="/dashboard" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.15s' }} className="hover-bright">
                  Personal Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Analysis Architecture */}
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>
              Architecture
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11, fontSize: '0.84rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Cpu size={13} style={{ color: '#60a5fa' }} />
                <span>Tree-sitter AST Parser</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Database size={13} style={{ color: '#c084fc' }} />
                <span>NetworkX Call Graphs</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Terminal size={13} style={{ color: '#34d399' }} />
                <span>FastAPI Async Engine</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Code2 size={13} style={{ color: '#fbbf24' }} />
                <span>Multi-file Diff Ingestion</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={13} style={{ color: '#f472b6' }} />
                <span>Sub-second PR Synthesis</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Security & Privacy */}
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>
              Security & Trust
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11, fontSize: '0.84rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={13} style={{ color: '#10b981' }} />
                <span>Zero Write-Access Policy</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={13} style={{ color: '#10b981' }} />
                <span>256-bit Token Encryption</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={13} style={{ color: '#10b981' }} />
                <span>Ephemeral AST Inspection</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Globe size={13} style={{ color: '#38bdf8' }} />
                <span>Read-Only GitHub OAuth</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={13} style={{ color: '#c084fc' }} />
                <span>Isolated Sandbox Workers</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright, Compliance, and Back-to-Top */}
        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            paddingTop: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            fontSize: '0.78rem',
            color: '#64748b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span>© {currentYear} PRism Intelligence Inc. All rights reserved.</span>
            <span style={{ opacity: 0.4 }}>•</span>
            <span>Architected for high-velocity software engineering teams.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#10b981', fontWeight: 600 }}>
              <ShieldCheck size={13} />
              <span>Zero Code Retention Guaranteed</span>
            </span>

            <button
              type="button"
              onClick={scrollToTop}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              className="hover-bright"
              title="Scroll back to top"
            >
              <span>Back to top</span>
              <ArrowUp size={12} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
