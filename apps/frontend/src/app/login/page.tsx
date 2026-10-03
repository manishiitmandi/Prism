'use client';

import React, { useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import SignInCard from '@/components/auth/SignInCard';
import { Shield, ArrowLeft } from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading } = useAuth();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'signin';

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#07090e',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Ambient Radial Lights */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70vw',
          height: '600px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.08) 50%, transparent 75%)',
          pointerEvents: 'none',
          filter: 'blur(80px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-10%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
          filter: 'blur(90px)',
        }}
      />

      {/* Minimalist Top Header */}
      <header
        style={{
          padding: '20px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Shield size={18} />
          </div>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em' }}>
            PRism
          </span>
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--accent-secondary)',
              background: 'rgba(99, 102, 241, 0.12)',
              padding: '2px 7px',
              borderRadius: 6,
              border: '1px solid rgba(99, 102, 241, 0.25)',
            }}
          >
            V0.1
          </span>
        </Link>

        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            padding: '6px 12px',
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 20px 48px',
          zIndex: 10,
        }}
      >
        <div style={{ width: '100%', maxWidth: 460 }}>
          <SignInCard initialMode={initialMode} onSuccess={() => router.push('/dashboard')} />
        </div>
      </main>

      {/* Minimal Footer */}
      <footer
        style={{
          padding: '16px 24px',
          textAlign: 'center',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          zIndex: 10,
        }}
      >
        PRism Intelligence Platform · End-to-end pull request risk telemetry &amp; code understanding
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#07090e' }} />}>
      <LoginContent />
    </Suspense>
  );
}
