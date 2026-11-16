import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'INSPIRATH | Fest Management',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
  return children;
}
