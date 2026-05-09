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
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'fs';
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

export const SLIDE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;
export type SlideExtension = (typeof SLIDE_EXTENSIONS)[number];

export const SLIDE_MIME_TYPES: Record<SlideExtension, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

// Default render path (PNG); kept for the pdftoppm pipeline. Per-slide replacements
// may write a different extension — use findSlidePath to resolve at read time.
export function getSlidePath(platicaId: string, slideNumber: number): string {
  const dir = getPlaticaDir(platicaId);
  const padded = String(slideNumber).padStart(3, '0');
  return join(dir, 'slides', `${padded}.png`);
}

// Resolves whichever extension is currently on disk for this slide. Returns null
// if no file exists. PNG is checked first since pdftoppm writes PNG.
export function findSlidePath(
  platicaId: string,
  slideNumber: number
): { path: string; ext: SlideExtension } | null {
  const dir = getPlaticaDir(platicaId);
  const padded = String(slideNumber).padStart(3, '0');
  for (const ext of SLIDE_EXTENSIONS) {
    const p = join(dir, 'slides', `${padded}.${ext}`);
    if (existsSync(p)) return { path: p, ext };
  }
  return null;
}

// Replaces the image for a single slide. Removes any existing extension variant
// for this slide, then writes the new file with the supplied extension.
export function writeSlideImage(
  platicaId: string,
  slideNumber: number,
  buffer: Buffer,
  ext: SlideExtension
): void {
  const dir = getPlaticaDir(platicaId);
  const slidesDir = join(dir, 'slides');
  if (!existsSync(slidesDir)) mkdirSync(slidesDir, { recursive: true });
  const padded = String(slideNumber).padStart(3, '0');
  // Drop any prior variant so only one image per slide exists on disk.
  for (const e of SLIDE_EXTENSIONS) {
    const p = join(slidesDir, `${padded}.${e}`);
    if (existsSync(p)) rmSync(p);
  }
  writeFileSync(join(slidesDir, `${padded}.${ext}`), buffer);
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
    // El usuario ve sus propias pláticas y las que estén marcadas como
    // shared (compartidas con todos los usuarios autenticados).
    const isOwner = m.owner_user_id === userId;
    const isShared = m.shared === true;
    if (!isOwner && !isShared) continue;
    items.push({
      id: m.id,
      title: m.title,
      personality_key: m.personality_key,
      slide_count: m.slide_count,
      created_at: m.created_at,
      advance_mode: m.advance_mode,
      owner_user_id: m.owner_user_id,
      shared: isShared,
    });
  }
  // Ordena propias primero, luego por fecha desc dentro de cada grupo, para
  // que tu trabajo no quede sepultado bajo lo compartido por otros.
  items.sort((a, b) => {
    const aMine = a.owner_user_id === userId ? 0 : 1;
    const bMine = b.owner_user_id === userId ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;
    return b.created_at.localeCompare(a.created_at);
  });
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
  // Clean any prior renders / per-slide replacements so we don't mix counts
  // on re-upload. Sweeps every supported slide extension, not just PNG.
  for (const f of readdirSync(slidesDir)) {
    if (SLIDE_EXTENSIONS.some((e) => f.endsWith(`.${e}`))) {
      rmSync(join(slidesDir, f));
    }
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

// ─── Reorganización estructural de slides ──────────────────────────────────
// Las siguientes funciones renombran archivos en /slides/ atómicamente para
// soportar insertar / borrar / reordenar slides desde el editor. Se usan
// renombrados a nombres temporales en dos pasos para evitar clobbering cuando
// la nueva posición colisiona con un nombre existente (ej. 002 ↔ 003 en swap).

function slidesDir(platicaId: string): string {
  return join(getPlaticaDir(platicaId), 'slides');
}

function paddedName(n: number, ext: SlideExtension): string {
  return `${String(n).padStart(3, '0')}.${ext}`;
}

// Mueve la imagen del slide `from` al slot `to`. Si `to` ya existe, debe estar
// vacío antes de llamar (o usar tmpName / two-pass). No verifica colisiones.
function renameSlideFile(platicaId: string, from: number, to: number): void {
  const found = findSlidePath(platicaId, from);
  if (!found) return;
  const dir = slidesDir(platicaId);
  const dst = join(dir, paddedName(to, found.ext));
  renameSync(found.path, dst);
}

// Sube todos los slides desde `fromSlide` (inclusive) hasta `lastSlide` en una
// posición. Recorre en orden descendente para no clobbering. Usado por insert.
function shiftSlidesUp(platicaId: string, fromSlide: number, lastSlide: number): void {
  for (let s = lastSlide; s >= fromSlide; s--) {
    renameSlideFile(platicaId, s, s + 1);
  }
}

// Baja todos los slides desde `fromSlide` (inclusive) hasta `lastSlide` una
// posición. Recorre en orden ascendente. Usado por delete.
function shiftSlidesDown(platicaId: string, fromSlide: number, lastSlide: number): void {
  for (let s = fromSlide; s <= lastSlide; s++) {
    renameSlideFile(platicaId, s, s - 1);
  }
}

// Aplica una permutación arbitraria a los slides en disco. `order[i]` = el
// número de slide ORIGINAL que debe quedar en la posición (i+1) después de la
// reorganización. Implementado como rename a nombres temporales (.tmp_NNN) y
// luego rename a los nombres finales — evita clobbering en cualquier permutación.
export function reorderSlideFiles(platicaId: string, order: number[]): void {
  const dir = slidesDir(platicaId);
  if (!existsSync(dir)) return;
  // Snapshot: capturar (path original, ext) para cada slide ANTES de tocar disco.
  const snapshot = new Map<number, { path: string; ext: SlideExtension }>();
  for (let s = 1; s <= order.length; s++) {
    const found = findSlidePath(platicaId, s);
    if (found) snapshot.set(s, found);
  }
  // Pase 1: mover cada original a un nombre temporal único basado en su número.
  for (const [origNum, info] of snapshot) {
    const tmp = join(dir, `__reorder_${origNum}.${info.ext}`);
    renameSync(info.path, tmp);
    info.path = tmp;
  }
  // Pase 2: mover cada temporal a su destino final.
  for (let i = 0; i < order.length; i++) {
    const newSlide = i + 1;
    const oldSlide = order[i];
    const info = snapshot.get(oldSlide);
    if (!info) continue;
    const dst = join(dir, paddedName(newSlide, info.ext));
    renameSync(info.path, dst);
  }
}

// Inserta una imagen en `position` (1..oldCount+1). Sube todo lo que estaba en
// position..oldCount una posición y escribe la nueva imagen como `position`.
export function insertSlideAt(
  platicaId: string,
  position: number,
  buffer: Buffer,
  ext: SlideExtension,
  oldCount: number
): void {
  const dir = slidesDir(platicaId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (position < 1 || position > oldCount + 1) {
    throw new Error(`position fuera de rango: ${position} (1..${oldCount + 1})`);
  }
  if (position <= oldCount) {
    shiftSlidesUp(platicaId, position, oldCount);
  }
  writeFileSync(join(dir, paddedName(position, ext)), buffer);
}

// Borra el slide en `position` y baja una posición a todos los slides
// posteriores. Asume oldCount es el conteo ANTES del borrado.
export function deleteSlideAt(platicaId: string, position: number, oldCount: number): void {
  if (position < 1 || position > oldCount) {
    throw new Error(`position fuera de rango: ${position} (1..${oldCount})`);
  }
  const found = findSlidePath(platicaId, position);
  if (found) rmSync(found.path);
  if (position < oldCount) {
    shiftSlidesDown(platicaId, position + 1, oldCount);
  }
}
