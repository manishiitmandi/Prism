'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { X } from 'lucide-react';
import SignInCard from './SignInCard';

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal } = useAuth();

  if (!isAuthModalOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(5, 6, 12, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={closeAuthModal}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 460,
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={closeAuthModal}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            zIndex: 10,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 8,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          title="Close dialog"
        >
          <X size={16} />
        </button>

        <SignInCard onSuccess={closeAuthModal} isModal />
      </div>
    </div>
  );
}
