import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { auth } from '@/lib/auth';
import { getUserMetricsFile } from '@/lib/data-paths';

export const revalidate = 0;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const userId = session.user.id;
    const metricsFile = getUserMetricsFile(userId);

    if (!existsSync(metricsFile)) {
      return NextResponse.json({
        total_tokens: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_cost_usd: 0,
        llm_cost_usd: 0,
        tts_cost_usd: 0,
        stt_cost_usd: 0,
        llm_calls: 0,
        tts_characters: 0,
        stt_audio_seconds: 0,
      });
    }
    const data = JSON.parse(readFileSync(metricsFile, 'utf-8'));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ total_tokens: 0, total_cost_usd: 0 });
  }
}
