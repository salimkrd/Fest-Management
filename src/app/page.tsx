import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'INSPIRATH | Official Results & Championship',
  description: 'Official public festival results, released posters, and team championship standings for INSPIRATH.',
};

// The public results homepage now owns the canonical root URL.
export { default } from './public/page';
