'use client';

import Link from 'next/link';
import { ArrowUpRight, Download, Globe, Layers3, ShieldCheck, Sparkles, Palette, Users } from 'lucide-react';
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
      <div className="mx-auto w-full max-w-[1600px] space-y-5 pb-8 sm:space-y-6">
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-blue-50 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-blue-700">
                <Sparkles className="h-3.5 w-3.5" /> Festival Media Studio
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Result Poster Templates</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Build a reusable poster design once, then release it for every officially published competition result. Draft changes stay private until you publish them.
              </p>
            </div>
            <Link
              href="/public/posters"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-auto"
            >
              <Globe className="h-4 w-4" /> Preview public gallery <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative mt-6 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3.5">
              <span className="rounded-lg bg-white p-2 text-blue-700 shadow-sm"><Palette className="h-4 w-4" /></span>
              <div><p className="text-xs font-bold text-slate-800">Design once</p><p className="mt-0.5 text-[11px] text-slate-500">Reusable layouts</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3.5">
              <span className="rounded-lg bg-white p-2 text-emerald-700 shadow-sm"><ShieldCheck className="h-4 w-4" /></span>
              <div><p className="text-xs font-bold text-slate-800">Release safely</p><p className="mt-0.5 text-[11px] text-slate-500">Draft and public versions</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3.5">
              <span className="rounded-lg bg-white p-2 text-violet-700 shadow-sm"><Users className="h-4 w-4" /></span>
              <div><p className="text-xs font-bold text-slate-800">Use across results</p><p className="mt-0.5 text-[11px] text-slate-500">One release for all competitions</p></div>
            </div>
          </div>
        </header>

        <section aria-labelledby="poster-workflow-heading" className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="poster-workflow-heading" className="text-base font-bold text-slate-950">Publishing workflow</h2>
              <p className="mt-1 text-xs text-slate-500">A shared library of poster templates for all published competitions.</p>
            </div>
            <span className="text-[11px] font-medium text-slate-400">3 simple steps</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {workflow.map(step => {
              const Icon = step.icon;
              return (
                <article key={step.number} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-[.15em] text-slate-400">STEP {step.number}</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{step.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-900">Safe publishing</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              Save template edits as a draft without changing the current public design. Choose <strong>Update Released Template</strong> when the new version is ready, or <strong>Withdraw</strong> to remove it from the gallery. Releasing a template does not publish competition results or change scores, grades, or points.
            </p>
          </div>
        </div>

        <section aria-labelledby="poster-editor-heading" className="min-w-0 space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="poster-editor-heading" className="text-base font-bold text-slate-950">Template editor</h2>
              <p className="mt-1 text-xs text-slate-500">Design, edit layers, preview, save, release and manage saved templates.</p>
            </div>
            <span className="text-[11px] font-medium text-slate-400">Canvas · Layers · Public release</span>
          </div>
          <PosterTemplateEditor />
        </section>
      </div>
    </AdminLayout>
  );
}
