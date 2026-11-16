'use client';

import React from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, Award, BadgeCheck, BookOpen,
  CalendarCheck, CalendarDays, Check, CheckCircle2, ChevronDown,
  CircleHelp, Clock3, Copy, Download, FileText, Gavel, GraduationCap,
  Home, Landmark, MapPin, MessageSquareText, RotateCcw, Scale, Search,
  SearchX, ShieldCheck, Share2, Star, Trophy,
} from 'lucide-react';

const iconMap = {
  calendar_month: CalendarDays, location_on: MapPin, verified: BadgeCheck,
  leaderboard: Trophy, trophy: Trophy, manage_search: Search, search: Search,
  search_off: SearchX, rate_review: MessageSquareText, arrow_forward: ArrowRight,
  menu_book: BookOpen, badge: BadgeCheck, gavel: Gavel, schedule: Clock3,
  expand_more: ChevronDown, restart_alt: RotateCcw, error: AlertCircle,
  verified_user: ShieldCheck, balance: Scale, military_tech: Trophy,
  arrow_back: ArrowLeft, home: Home, event_available: CalendarCheck,
  check: Check, content_copy: Copy, share: Share2, picture_as_pdf: FileText,
  school: GraduationCap, temple_buddhist: Landmark, workspace_premium: Award,
  stars: Star, download: Download, check_circle: CheckCircle2,
} as const;

interface PublicIconProps { name: string; className?: string; size?: number; }

/** SVG-only icon set for public pages; does not depend on font ligatures. */
export function PublicIcon({ name, className, size }: PublicIconProps) {
  const Icon = iconMap[name as keyof typeof iconMap] || CircleHelp;
  const parsedSize = className?.match(/text-\[(\d+(?:\.\d+)?)px\]/)?.[1];
  return <Icon aria-hidden="true" focusable="false" className={className}
    size={size ?? (parsedSize ? Number(parsedSize) : 20)} strokeWidth={1.9} />;
}

/** Display the configured festival range without timezone shifts or sample dates. */
export function formatPublicFestivalDates(start?: string, end?: string): string {
  const dayNumber = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const time = Date.UTC(year, month - 1, day);
    return new Date(time).toISOString().slice(0, 10) === value ? time : null;
  };
  const from = start ? dayNumber(start) : null;
  const to = end ? dayNumber(end) : null;
  if (from == null && to == null) return 'Dates to be announced';
  if (from != null && to != null && to < from) return 'Dates to be announced';
  const full = (time: number) => new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(time));
  if (from == null || to == null) return full(from ?? to!);
  const a = new Date(from), b = new Date(to);
  if (a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()) {
    const monthYear = new Intl.DateTimeFormat('en-IN', {
      month: 'short', year: 'numeric', timeZone: 'UTC'
    }).format(a);
    return `${a.getUTCDate()}–${b.getUTCDate()} ${monthYear}`;
  }
  return `${full(from)} – ${full(to)}`;
}
