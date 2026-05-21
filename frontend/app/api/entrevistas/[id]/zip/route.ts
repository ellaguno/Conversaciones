import { NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import JSZip from 'jszip';
import { join, resolve } from 'path';
import { auth } from '@/lib/auth';
import { getUserDataDir, getUserSessionsDir } from '@/lib/data-paths';
import { rateLimit } from '@/lib/rate-limit';

export const revalidate = 0;

interface RouteCtx {
  params: Promise<{ id: string }>;
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

/** Recursively add a directory's files to the zip under `prefix/...`. */
function addDirToZip(zip: JSZip, baseDir: string, prefix: string) {
  if (!existsSync(baseDir)) return;
  for (const entry of readdirSync(baseDir)) {
    const full = join(baseDir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    const arcname = prefix ? `${prefix}/${entry}` : entry;
    if (st.isDirectory()) {
      addDirToZip(zip, full, arcname);
    } else if (st.isFile()) {
      try {
        zip.file(arcname, readFileSync(full));
      } catch {
        // skip unreadable files
      }
    }
  }
}

export async function GET(req: Request, ctx: RouteCtx) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`ent-zip:${ip}`, 10, 60_000)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { id: rawId } = await ctx.params;
    const id = safeId(rawId);
    if (!id) {
      return NextResponse.json({ error: 'id invalido' }, { status: 400 });
    }

    const userDataDir = getUserDataDir(session.user.id);
    const interviewDir = join(getUserSessionsDir(session.user.id), id);

    if (!resolve(interviewDir).startsWith(resolve(userDataDir))) {
      return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
    }
    if (!existsSync(interviewDir)) {
      return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    }

    const zip = new JSZip();

    // 1. The interview directory verbatim (perfil/agenda/resumen/árbol/sesiones/conocimiento).
    addDirToZip(zip, interviewDir, id);

    // 2. The raw conversation logs for Elena. They're stored per-personality, not
    //    per-interview, so we include all of them under `transcripciones-elena/`.
    //    A README disambiguates for the user.
    const transcriptsDir = join(userDataDir, 'conversations', 'entrevistadora');
    if (existsSync(transcriptsDir)) {
      addDirToZip(zip, transcriptsDir, 'transcripciones-elena');
    }

    zip.file(
      'README.txt',
      [
        `Entrevista: ${id}`,
        `Generado: ${new Date().toISOString()}`,
        '',
        `Contenido:`,
        `  ${id}/                          — todos los archivos de esta entrevista`,
        `    perfil.md                     — perfil del entrevistado`,
        `    resumen_general.md            — resumen acumulado`,
        `    agenda.md                     — próximas sesiones`,
        `    arbol_temas.json              — árbol jerárquico de temas`,
        `    entrevista_config.json        — modo + nombre + frecuencia`,
        `    sesiones/                     — notas estructuradas por sesión`,
        `    conclusiones/`,
        `      pendientes.md               — qué falta cubrir / profundizar`,
        `      conocimiento/               — conocimiento destilado por rama`,
        ``,
        `  transcripciones-elena/          — transcripciones EN CRUDO de TODAS`,
        `                                    tus entrevistas con Elena (los logs`,
        `                                    se guardan por personalidad, no por`,
        `                                    entrevista — filtra por fecha).`,
        '',
      ].join('\n')
    );

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const filename = `entrevista-${id}-${new Date().toISOString().slice(0, 10)}.zip`;
    return new NextResponse(new Uint8Array(zipBuf), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error generating zip:', error);
    return NextResponse.json({ error: 'Error generando zip' }, { status: 500 });
  }
}
