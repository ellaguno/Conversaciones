import { headers } from 'next/headers';
import { App } from '@/components/app/app';
import { getAppConfig } from '@/lib/utils';

interface PageProps {
  params: Promise<{ patientId: string }>;
}

export default async function PsicologaPatientPage({ params }: PageProps) {
  const { patientId } = await params;

  // Sanitize patient ID (same logic as backend)
  const safePatientId = patientId
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 60);

  if (!safePatientId) {
    const { notFound } = await import('next/navigation');
    notFound();
  }

  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return (
    <App appConfig={appConfig} initialPersonality="psicologo" initialPatientId={safePatientId} />
  );
}
