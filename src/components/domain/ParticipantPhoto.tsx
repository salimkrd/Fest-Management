'use client';

import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

/**
 * Extracts clean uppercase initials from a participant's full name.
 * e.g. "Nihad Mohammed" -> "NM", "Faris" -> "FA", "" -> ""
 */
export function getParticipantInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Checks whether a URL is the deprecated external stock portrait placeholder that
 * should be rejected in favor of a genuine participant photo or neutral accreditation placeholder.
 */
export function isStockPhotoPlaceholder(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  return clean.includes('1534528741775-53994a69daeb');
}

export interface ParticipantPhotoProps {
  photoUrl?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  shape?: 'circle' | 'rounded';
  className?: string;
  fallback?: 'auto' | 'silhouette' | 'initials' | 'combined';
  alt?: string;
}

export const ParticipantPhoto: React.FC<ParticipantPhotoProps> = ({
  photoUrl,
  name,
  size = 'lg',
  shape = 'circle',
  className = '',
  fallback = 'auto',
  alt
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [photoUrl]);

  const cleanUrl = photoUrl?.trim();
  const hasValidPhoto = Boolean(cleanUrl && !isStockPhotoPlaceholder(cleanUrl) && !imgError);
  const initials = getParticipantInitials(name);

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  let sizeClass = '';
  let iconSize = 'w-9 h-9';
  let textSize = 'text-xs';

  if (size === 'sm') {
    sizeClass = 'w-8 h-8';
    iconSize = 'w-4 h-4';
    textSize = 'text-[10px]';
  } else if (size === 'md') {
    sizeClass = 'w-16 h-16';
    iconSize = 'w-7 h-7';
    textSize = 'text-sm';
  } else if (size === 'lg') {
    sizeClass = 'w-24 h-24';
    iconSize = 'w-9 h-9';
    textSize = 'text-xs';
  } else if (size === 'xl') {
    sizeClass = 'w-32 h-32';
    iconSize = 'w-12 h-12';
    textSize = 'text-base';
  }

  if (hasValidPhoto) {
    return (
      <img
        src={cleanUrl}
        alt={alt || name || 'Participant photo'}
        className={`${sizeClass} ${shapeClass} object-cover ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  // Professional neutral silhouette or initials placeholder
  return (
    <div
      data-testid="participant-photo-fallback"
      role="img"
      aria-label={alt || `Photo placeholder for ${name || 'Participant'}`}
      className={`${sizeClass} ${shapeClass} bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 flex flex-col items-center justify-center select-none overflow-hidden ${className}`}
    >
      {fallback === 'silhouette' ? (
        <User
          data-testid="participant-silhouette"
          className={`${size === 'sm' ? 'w-4 h-4' : 'w-11 h-11'} text-slate-400`}
        />
      ) : fallback === 'initials' ? (
        <span
          data-testid="participant-initials"
          className={`font-black uppercase tracking-wider text-slate-700 ${size === 'sm' ? 'text-[11px]' : size === 'md' ? 'text-lg' : 'text-2xl'}`}
        >
          {initials || <User data-testid="participant-silhouette" className={`${iconSize} text-slate-400`} />}
        </span>
      ) : (
        // 'auto' or 'combined'
        size === 'sm' ? (
          initials ? (
            <span data-testid="participant-initials" className="font-bold text-[10px] uppercase text-slate-700">
              {initials}
            </span>
          ) : (
            <User data-testid="participant-silhouette" className="w-4 h-4 text-slate-400" />
          )
        ) : (
          <div className="flex flex-col items-center justify-center">
            <User data-testid="participant-silhouette" className={`${iconSize} text-slate-400`} />
            {initials ? (
              <span
                data-testid="participant-initials"
                className={`font-extrabold uppercase tracking-wider text-slate-600 mt-0.5 ${textSize}`}
              >
                {initials}
              </span>
            ) : null}
          </div>
        )
      )}
    </div>
  );
};
