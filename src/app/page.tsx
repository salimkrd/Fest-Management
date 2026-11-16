import './public/public.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Official Festival Results & Championship',
  description: 'Official published festival results, competition scorecards, and team championship standings.',
};

// The public results homepage now owns the canonical root URL.
export { default } from './public/page';
