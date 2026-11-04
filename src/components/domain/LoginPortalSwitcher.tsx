'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Users2, Gavel, IdCard, ArrowUpRight } from 'lucide-react';

const portals = [
  { href: '/admin/login', label: 'Admin', description: 'Festival control', icon: ShieldCheck },
  { href: '/team/login', label: 'Team Manager', description: 'Team workspace', icon: Users2 },
  { href: '/judge/login', label: 'Judge', description: 'Marking access', icon: Gavel },
  { href: '/participant/login', label: 'Participant', description: 'Personal portal', icon: IdCard },
];

export function LoginPortalSwitcher() {
  const pathname = usePathname();

  return (
    <nav aria-label="Other login portals" className="mt-7">
      <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
        Other portals
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {portals.map(({ href, label, description, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`group flex min-w-0 items-center gap-2 rounded-xl border px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${active ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white text-blue-600' : 'bg-slate-100 text-slate-500 group-hover:text-blue-600'}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold">{label}</span>
                <span className="block truncate text-[9px] text-slate-400">{description}</span>
              </span>
              {!active && <ArrowUpRight className="ml-auto hidden h-3 w-3 shrink-0 text-slate-300 sm:block" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
