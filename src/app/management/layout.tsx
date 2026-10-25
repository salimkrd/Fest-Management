import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'INSPIRATH | Fest Management Portal',
  description: 'Management hub for authorized festival administrators, team managers, judges, and participants.',
};

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
  return children;
}
