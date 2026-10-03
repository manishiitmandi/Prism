'use client';

import React, { useState } from 'react';

interface UserAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  username?: string | null;
  size?: number;
  borderRadius?: number | string;
  style?: React.CSSProperties;
}

export default function UserAvatar({
  avatarUrl,
  name,
  username,
  size = 32,
  borderRadius = '50%',
  style = {},
}: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);

  const displayName = name || username || 'U';
  // Compute initials (e.g. "Manish Kumar" -> "MK")
  const parts = displayName.trim().split(/\s+/);
  const initials = parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : displayName.slice(0, 2).toUpperCase();

  if (avatarUrl && !hasError) {
    return (
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setHasError(true)}
        style={{
          width: size,
          height: size,
          borderRadius,
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
          ...style,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius,
        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size >= 48 ? '1.25rem' : size >= 32 ? '0.85rem' : '0.68rem',
        fontWeight: 700,
        color: '#ffffff',
        flexShrink: 0,
        userSelect: 'none',
        boxShadow: size >= 48 ? '0 4px 16px rgba(99, 102, 241, 0.3)' : undefined,
        ...style,
      }}
    >
      {initials}
    </div>
  );
}
