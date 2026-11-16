import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Staff Portal | INSPIRATH',
  description: 'Authorized Staff Access Gateway',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function StaffLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
