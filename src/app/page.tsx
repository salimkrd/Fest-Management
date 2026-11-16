import './public/public.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "INSPIRAATH 2026 — Ma'din Suffa Campus, Vavoor",
  description: "Official public festival results, ratified scorecards, and team championship standings for INSPIRAATH 2026 at Ma'din Suffa Campus, Vavoor.",
};

// The public results homepage now owns the canonical root URL.
export { default } from './public/page';
