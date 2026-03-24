import { headers } from 'next/headers';
import { getAppConfig } from '@/lib/utils';
import { DemoSeguros } from './demo-seguros';

export default async function Page() {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);

  return <DemoSeguros appConfig={appConfig} />;
}
