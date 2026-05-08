// Filesystem layout for Pláticas:
//   /data/platicas/{platica_id}/
//     manifest.json
//     guion.json
//     slides.pdf
//     slides/001.png, 002.png, ...
//
// Pláticas are not nested under userId — ownership lives in manifest.owner_user_id
// and is enforced by the API routes. The id is a nanoid; paths are sanitized
// before resolution to keep callers from escaping the platicas root.
import { execFile } from 'child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { promisify } from 'util';
import type { PlaticaGuion, PlaticaListItem, PlaticaManifest } from './platica-schema';

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = join(process.cwd(), '..');
const DATA_DIR = join(PROJECT_ROOT, 'data');
const PLATICAS_DIR = join(DATA_DIR, 'platicas');

function sanitizePlaticaId(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) throw new Error('Invalid platica id');
  return safe;
}

export function getPlaticasRoot(): string {
  if (!existsSync(PLATICAS_DIR)) {
    mkdirSync(PLATICAS_DIR, { recursive: true });
  }
  return PLATICAS_DIR;
}

export function getPlaticaDir(platicaId: string): string {
  const safe = sanitizePlaticaId(platicaId);
  const dir = join(PLATICAS_DIR, safe);
  if (!resolve(dir).startsWith(resolve(PLATICAS_DIR))) {
    throw new Error('Invalid platica path');
  }
  return dir;
}

export function platicaExists(platicaId: string): boolean {
  try {
    return existsSync(join(getPlaticaDir(platicaId), 'manifest.json'));
  } catch {
    return false;
  }
}

export function readManifest(platicaId: string): PlaticaManifest | null {
  const p = join(getPlaticaDir(platicaId), 'manifest.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as PlaticaManifest;
  } catch {
    return null;
  }
}

export function writeManifest(platicaId: string, manifest: PlaticaManifest): void {
  const dir = getPlaticaDir(platicaId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
}

export function readGuion(platicaId: string): PlaticaGuion | null {
  const p = join(getPlaticaDir(platicaId), 'guion.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as PlaticaGuion;
  } catch {
    return null;
  }
}

export function writeGuion(platicaId: string, guion: PlaticaGuion): void {
  const dir = getPlaticaDir(platicaId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'guion.json'), JSON.stringify(guion, null, 2), 'utf-8');
}

export function writePdf(platicaId: string, pdfBuffer: Buffer): string {
  const dir = getPlaticaDir(platicaId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const pdfPath = join(dir, 'slides.pdf');
  writeFileSync(pdfPath, pdfBuffer);
  return pdfPath;
}

export function getSlidePath(platicaId: string, slideNumber: number): string {
  const dir = getPlaticaDir(platicaId);
  const padded = String(slideNumber).padStart(3, '0');
  return join(dir, 'slides', `${padded}.png`);
}

export function deletePlatica(platicaId: string): void {
  const dir = getPlaticaDir(platicaId);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function listPlaticasForUser(userId: string): PlaticaListItem[] {
  const root = getPlaticasRoot();
  const items: PlaticaListItem[] = [];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }
  for (const entry of entries) {
    const m = readManifest(entry);
    if (!m) continue;
    if (m.owner_user_id !== userId) continue;
    items.push({
      id: m.id,
      title: m.title,
      personality_key: m.personality_key,
      slide_count: m.slide_count,
      created_at: m.created_at,
      advance_mode: m.advance_mode,
    });
  }
  items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return items;
}

// pdfinfo and pdftoppm are part of poppler-utils. Verified at /usr/bin/.
// pdfinfo output line: "Pages:           N"
export async function countPdfPages(pdfPath: string): Promise<number> {
  const { stdout } = await execFileAsync('pdfinfo', [pdfPath]);
  for (const line of stdout.split('\n')) {
    const m = line.match(/^Pages:\s+(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  throw new Error('No se pudo determinar el número de páginas del PDF');
}

// Renders each PDF page to slides/NNN.png. pdftoppm with -scale-to-x 1920
// keeps aspect ratio and produces ~1920px wide PNGs (height auto). The native
// output is named root-1.png, root-2.png — we rename to 001.png, 002.png.
export async function renderPdfToPngs(platicaId: string, pdfPath: string): Promise<number> {
  const dir = getPlaticaDir(platicaId);
  const slidesDir = join(dir, 'slides');
  if (!existsSync(slidesDir)) mkdirSync(slidesDir, { recursive: true });
  // Clean any prior renders so we don't mix counts on re-upload.
  for (const f of readdirSync(slidesDir)) {
    if (f.endsWith('.png')) rmSync(join(slidesDir, f));
  }
  const rootName = 'page';
  await execFileAsync('pdftoppm', [
    '-png',
    '-scale-to-x',
    '1920',
    '-scale-to-y',
    '-1',
    pdfPath,
    join(slidesDir, rootName),
  ]);
  // Rename root-1.png → 001.png, etc. pdftoppm uses -1, -01, or -001 zero-padding
  // depending on total page count; handle all by extracting the trailing number.
  const produced = readdirSync(slidesDir).filter(
    (f) => f.startsWith(rootName) && f.endsWith('.png')
  );
  let count = 0;
  for (const f of produced) {
    const m = f.match(/-(\d+)\.png$/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    const padded = String(n).padStart(3, '0');
    const oldPath = join(slidesDir, f);
    const newPath = join(slidesDir, `${padded}.png`);
    if (oldPath !== newPath) {
      writeFileSync(newPath, readFileSync(oldPath));
      rmSync(oldPath);
    }
    count++;
  }
  return count;
}
