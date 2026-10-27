'use client';

import Link from 'next/link';
import { ArrowUpRight, Download, Globe, Image as ImageIcon, Layers3, ShieldCheck } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PosterTemplateEditor } from '@/components/domain/PosterTemplateEditor';

const workflow = [
  { number: '01', title: 'Design one reusable template', description: 'Build the layout once. Use the sample preview while designing, or select a published competition to check the same design with real winners.', icon: Layers3 },
  { number: '02', title: 'Release the template', description: 'Choose Release Template to make this design available in the public gallery. One release applies to every published competition; no per-result release is needed.', icon: Globe },
  { number: '03', title: 'Visitors choose and download', description: 'The public Results page shows results only. Download Poster opens the template gallery for that competition, where visitors preview and download their preferred design as PNG.', icon: Download },
];

export default function MediaManagementPage() {
  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-blue-600"><ImageIcon className="h-3.5 w-3.5" /> Media Studio</div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Global Result Poster Templates</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">Create and publish reusable poster designs once. Every released template can be used with every officially published competition result.</p>
          </div>
          <Link href="/public/posters" target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700 sm:self-center">
            Preview public gallery <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </header>

        <section aria-labelledby="poster-workflow-heading" className="space-y-3">
          <div>
            <h2 id="poster-workflow-heading" className="text-sm font-bold text-slate-900">How poster publishing works</h2>
            <p className="mt-1 text-xs text-slate-500">One shared template library — not one poster release per competition.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {workflow.map(step => {
              const Icon = step.icon;
              return <article key={step.number} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold tracking-widest text-slate-400">STEP {step.number}</span><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></span></div>
                <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{step.description}</p>
              </article>;
            })}
          </div>
        </section>

        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          <div>
            <p className="text-xs font-bold text-emerald-900">Safe publishing</p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-800">Save template edits as a draft without changing the current public design. Use <strong>Update Released Template</strong> when you are ready to publish the new version, or <strong>Withdraw</strong> to remove it from the public gallery. Releasing a template does not publish competition results or change scores, grades, or points.</p>
          </div>
        </div>

        <section aria-labelledby="poster-editor-heading" className="space-y-3">
          <div>
            <h2 id="poster-editor-heading" className="text-sm font-bold text-slate-900">Template editor</h2>
            <p className="mt-1 text-xs text-slate-500">Design, save, preview, release, update, and withdraw reusable poster templates below.</p>
          </div>
          <PosterTemplateEditor />
        </section>
      </div>
    </AdminLayout>
  );
}
