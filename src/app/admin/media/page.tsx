'use client';

import Link from 'next/link';
import { ArrowUpRight, Image as ImageIcon } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PosterTemplateEditor } from '@/components/domain/PosterTemplateEditor';

export default function MediaManagementPage() {
  return <AdminLayout><div className="mx-auto max-w-[1600px] space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-blue-600"><ImageIcon className="h-3.5 w-3.5" />Media studio</div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Result Poster Studio</h1><p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">Create reusable result poster templates. Add your artwork, arrange winner details, and release posters for everyone to view and download.</p></div>
      <Link href="/public/posters" target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-blue-400">Public poster gallery<ArrowUpRight className="h-3.5 w-3.5" /></Link>
    </div>
    <PosterTemplateEditor />
  </div></AdminLayout>;
}
