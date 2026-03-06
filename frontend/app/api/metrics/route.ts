import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const METRICS_FILE = join(process.cwd(), '..', 'agent', 'metrics.json');

export const revalidate = 0;

export async function GET() {
  try {
    if (!existsSync(METRICS_FILE)) {
      return NextResponse.json({
        total_tokens: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_cost_usd: 0,
        llm_calls: 0,
        tts_characters: 0,
        stt_audio_seconds: 0,
      });
    }
    const data = JSON.parse(readFileSync(METRICS_FILE, 'utf-8'));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ total_tokens: 0, total_cost_usd: 0 });
  }
}
