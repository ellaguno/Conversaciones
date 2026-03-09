import { NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { auth } from '@/lib/auth';
import { getUserDataDir } from '@/lib/data-paths';
import { rateLimit } from '@/lib/rate-limit';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const MAX_DURATION_MINUTES = 30;
// Deepgram nova-3 pre-recorded: ~$0.0043/min
const COST_PER_MINUTE = 0.0043;
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB generous limit for 30min audio

const ALLOWED_MIME_PREFIXES = ['audio/', 'video/'];

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`transcribe:${ip}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en un minuto.' }, { status: 429 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    if (!DEEPGRAM_API_KEY) {
      return NextResponse.json({ error: 'Deepgram API key no configurada' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('audio') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se envio archivo de audio' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Archivo demasiado grande (max 500MB)' }, { status: 400 });
    }

    const isAllowed = ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix));
    if (!isAllowed && file.type !== '') {
      return NextResponse.json(
        { error: `Tipo de archivo no soportado: ${file.type}` },
        { status: 400 }
      );
    }

    const audioBuffer = Buffer.from(await file.arrayBuffer());

    // Call Deepgram pre-recorded API
    const dgUrl = new URL('https://api.deepgram.com/v1/listen');
    dgUrl.searchParams.set('model', 'nova-3');
    dgUrl.searchParams.set('language', 'es');
    dgUrl.searchParams.set('smart_format', 'true');
    dgUrl.searchParams.set('punctuate', 'true');
    dgUrl.searchParams.set('paragraphs', 'true');
    dgUrl.searchParams.set('diarize', 'true');
    dgUrl.searchParams.set('utterances', 'true');

    const dgResponse = await fetch(dgUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': file.type || 'audio/mpeg',
      },
      body: audioBuffer,
    });

    if (!dgResponse.ok) {
      const errText = await dgResponse.text();
      console.error('Deepgram error:', dgResponse.status, errText);
      return NextResponse.json(
        { error: `Error de Deepgram: ${dgResponse.status}` },
        { status: 502 }
      );
    }

    const dgResult = await dgResponse.json();

    // Extract duration and check limit
    const durationSeconds = dgResult.metadata?.duration || 0;
    const durationMinutes = durationSeconds / 60;

    if (durationMinutes > MAX_DURATION_MINUTES) {
      return NextResponse.json(
        { error: `Audio excede el limite de ${MAX_DURATION_MINUTES} minutos (${durationMinutes.toFixed(1)} min)` },
        { status: 400 }
      );
    }

    const cost = durationMinutes * COST_PER_MINUTE;

    // Build formatted transcript
    const channel = dgResult.results?.channels?.[0];
    const paragraphs = channel?.alternatives?.[0]?.paragraphs?.paragraphs || [];
    const utterances = dgResult.results?.utterances || [];
    const plainTranscript = channel?.alternatives?.[0]?.transcript || '';

    // Format with speaker diarization
    const formattedLines: string[] = [];
    let currentSpeaker = -1;

    if (utterances.length > 0) {
      // Use utterances for better speaker-segmented output
      for (const utt of utterances) {
        const speaker = utt.speaker;
        const timestamp = formatTime(utt.start);
        if (speaker !== currentSpeaker) {
          currentSpeaker = speaker;
          formattedLines.push('');
          formattedLines.push(`**Hablante ${speaker + 1}** [${timestamp}]`);
        }
        formattedLines.push(utt.transcript);
      }
    } else if (paragraphs.length > 0) {
      // Fallback to paragraphs
      for (const para of paragraphs) {
        const speaker = para.speaker;
        if (speaker !== currentSpeaker) {
          currentSpeaker = speaker;
          formattedLines.push('');
          formattedLines.push(`**Hablante ${speaker + 1}**`);
        }
        for (const sent of para.sentences || []) {
          formattedLines.push(sent.text);
        }
      }
    } else {
      formattedLines.push(plainTranscript);
    }

    const formattedTranscript = formattedLines.join('\n').trim();

    // Save transcription to user's data directory
    const userId = session.user.id;
    const transcriptionsDir = join(getUserDataDir(userId), 'transcriptions');
    if (!existsSync(transcriptionsDir)) {
      mkdirSync(transcriptionsDir, { recursive: true });
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50);
    const mdFilename = `${dateStr}_${timeStr}_${safeName}.md`;

    const mdContent = [
      `# Transcripcion: ${file.name}`,
      `**Fecha:** ${now.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      `**Duracion:** ${formatTime(durationSeconds)}`,
      `**Hablantes detectados:** ${countSpeakers(utterances, paragraphs)}`,
      `**Costo estimado:** $${cost.toFixed(4)} USD`,
      '',
      '---',
      '',
      formattedTranscript,
    ].join('\n');

    writeFileSync(join(transcriptionsDir, mdFilename), mdContent, 'utf-8');

    return NextResponse.json({
      transcript: formattedTranscript,
      duration: durationSeconds,
      durationFormatted: formatTime(durationSeconds),
      speakers: countSpeakers(utterances, paragraphs),
      cost: cost,
      filename: mdFilename,
    });
  } catch (error) {
    console.error('Transcribe error:', error);
    return NextResponse.json({ error: 'Error procesando transcripcion' }, { status: 500 });
  }
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function countSpeakers(
  utterances: { speaker: number }[],
  paragraphs: { speaker: number }[]
): number {
  const speakers = new Set<number>();
  for (const u of utterances) speakers.add(u.speaker);
  if (speakers.size === 0) {
    for (const p of paragraphs) speakers.add(p.speaker);
  }
  return Math.max(speakers.size, 1);
}
