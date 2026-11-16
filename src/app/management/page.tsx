import { redirect } from 'next/navigation';
import { buildStaffLoginUrl } from '@/lib/authRoutes';

interface ManagementPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const dynamic = 'force-dynamic';

export default async function ManagementPage({ searchParams }: ManagementPageProps) {
  const resolvedParams = await searchParams;
  const flatParams: Record<string, string> = {};

  for (const [key, value] of Object.entries(resolvedParams)) {
    if (typeof value === 'string') {
      flatParams[key] = value;
    } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
      flatParams[key] = value[0];
    }
  }

  const destination = buildStaffLoginUrl(flatParams);
  redirect(destination);
}
