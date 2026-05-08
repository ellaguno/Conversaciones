'use client';

// Edición de una plática existente. Reusa los mismos campos del formulario de
// creación. El PDF se puede reemplazar (re-renderiza slides, ajusta slide_count
// y rellena/trunca bloques); cada slide individual también se puede sustituir
// por una imagen subida (PNG/JPG/WebP). Cada bloque del guion se edita en una
// tarjeta independiente con su slide preview a la derecha.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CARTESIA_VOICES_ES } from '@/lib/personalities-config';
import type { AdvanceMode, GuionBlock, PlaticaGuion, PlaticaManifest } from '@/lib/platica-schema';

const PRESENTER_PERSONALITIES: { key: string; label: string }[] = [
  { key: 'tato', label: 'Tato — Vecino cálido' },
  { key: 'ia_honesta', label: 'I.A. Honesta' },
  { key: 'instructor_historia', label: 'Profesor de Historia' },
  { key: 'coach_oratoria', label: 'Coach de Oratoria' },
];

const ADVANCE_MODE_DESCRIPTIONS: Record<AdvanceMode, { label: string; help: string }> = {
  hybrid: {
    label: 'Híbrido (recomendado)',
    help: 'Avanza solo cuando termina el slide; pausa si la audiencia pregunta. Evita silencios largos.',
  },
  on_cue: {
    label: 'Por señal',
    help: 'Termina cada slide y se queda quieto hasta que alguien diga "sigamos" o equivalente. Acepta silencios.',
  },
  auto: {
    label: 'Automático',
    help: 'Avanza solo en cuanto termina. Evita silencios.',
  },
};

export default function EditarPlaticaPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [manifest, setManifest] = useState<PlaticaManifest | null>(null);
  const [blocks, setBlocks] = useState<GuionBlock[] | null>(null);
  const [glossaryText, setGlossaryText] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Per-slide cache-bust versions. We bump the value for a slide after replacing
  // its image so the <img> refetches instead of using the 1-hour cached PNG.
  const [slideVersions, setSlideVersions] = useState<Record<number, number>>({});
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch(`/api/platicas/${id}`, { credentials: 'include' })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
        return body;
      })
      .then((data) => {
        const m = data.manifest as PlaticaManifest;
        const g = data.guion as PlaticaGuion;
        setManifest(m);
        setBlocks(g.blocks);
        setGlossaryText(m.glossary ? JSON.stringify(m.glossary, null, 2) : '');
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  const updateManifest = (patch: Partial<PlaticaManifest>) => {
    setManifest((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateBlock = (idx: number, patch: Partial<GuionBlock>) => {
    setBlocks((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const bumpSlideVersion = (slide: number) => {
    setSlideVersions((prev) => ({ ...prev, [slide]: (prev[slide] ?? 0) + 1 }));
  };

  // Handler para subir un PDF de reemplazo. Confirma con el usuario si el
  // conteo de slides cambia, ya que eso recorta o agrega bloques al guion.
  const handlePdfReupload = async (file: File) => {
    if (!manifest) return;
    setPdfNotice(null);
    setError(null);
    if (file.type && file.type !== 'application/pdf') {
      setError(`tipo de archivo inválido: ${file.type}`);
      return;
    }
    setPdfBusy(true);
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      const r = await fetch(`/api/platicas/${id}/pdf`, {
        method: 'PUT',
        credentials: 'include',
        body: fd,
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      const newManifest = body.manifest as PlaticaManifest;
      const newGuion = body.guion as PlaticaGuion;
      setManifest(newManifest);
      setBlocks(newGuion.blocks);
      // Invalida el caché de TODOS los slides — todas las imágenes son nuevas.
      const fresh: Record<number, number> = {};
      const t = Date.now();
      for (let s = 1; s <= newManifest.slide_count; s++) fresh[s] = t;
      setSlideVersions(fresh);
      const change = body.change as
        | { old_slide_count: number; new_slide_count: number; padded: number; dropped: number }
        | undefined;
      if (change) {
        const parts: string[] = [];
        parts.push(`${change.old_slide_count} → ${change.new_slide_count} slides`);
        if (change.padded) parts.push(`${change.padded} bloque(s) agregado(s)`);
        if (change.dropped) parts.push(`${change.dropped} bloque(s) eliminado(s)`);
        setPdfNotice(`PDF reemplazado: ${parts.join(' · ')}.`);
      } else {
        setPdfNotice('PDF reemplazado.');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPdfBusy(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manifest || !blocks) return;
    setError(null);

    let glossary: Record<string, string> | undefined;
    if (glossaryText.trim()) {
      try {
        const parsed = JSON.parse(glossaryText);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          setError('El glosario debe ser un objeto JSON.');
          return;
        }
        glossary = parsed;
      } catch {
        setError('El glosario no es JSON válido.');
        return;
      }
    } else {
      glossary = undefined;
    }

    // Recompute start_sec from durations to keep them consistent.
    let acc = 0;
    const cleanedBlocks = blocks.map((b) => {
      const out = { ...b, start_sec: acc };
      acc += Math.max(0, Number(b.duration_sec) || 0);
      return out;
    });

    const manifestPatch = {
      title: manifest.title,
      personality_key: manifest.personality_key,
      audience_profile: manifest.audience_profile,
      narrative_tone: manifest.narrative_tone,
      advance_mode: manifest.advance_mode,
      voice_id: manifest.voice_id || undefined,
      model: manifest.model || undefined,
      glossary,
      story_arcs: manifest.story_arcs,
      key_moments: manifest.key_moments,
    };

    setSaving(true);
    try {
      const r = await fetch(`/api/platicas/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifest: manifestPatch,
          guion: { blocks: cleanedBlocks },
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setSavedAt(Date.now());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="bg-background text-foreground min-h-svh">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <Link href="/platicas" className="text-muted-foreground hover:text-foreground text-xs">
            ← Pláticas
          </Link>
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {loadError}
          </div>
        </div>
      </div>
    );
  }
  if (!manifest || !blocks) {
    return (
      <div className="bg-background text-foreground min-h-svh">
        <div className="text-muted-foreground mx-auto max-w-2xl px-4 py-8 text-sm">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-svh">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/platicas" className="text-muted-foreground hover:text-foreground text-xs">
              ← Pláticas
            </Link>
            <h1 className="mt-2 text-2xl font-bold">Editar plática</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {manifest.slide_count} slides — puedes reemplazar el PDF completo o sustituir slides
              individualmente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePdfReupload(f);
              }}
            />
            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              disabled={pdfBusy}
              className="border-border hover:bg-accent rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {pdfBusy ? 'Procesando PDF…' : 'Reemplazar PDF'}
            </button>
            {savedAt && Date.now() - savedAt < 4000 && (
              <div className="rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                ✓ Guardado
              </div>
            )}
          </div>
        </div>

        {pdfNotice && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            {pdfNotice}
          </div>
        )}

        <form onSubmit={submit} className="space-y-5">
          <Field label="Título" required>
            <input
              type="text"
              value={manifest.title}
              onChange={(e) => updateManifest({ title: e.target.value })}
              required
              className="input"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Personalidad del presentador" required>
              <select
                value={manifest.personality_key}
                onChange={(e) => updateManifest({ personality_key: e.target.value })}
                className="input"
              >
                {PRESENTER_PERSONALITIES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
                {/* Si el manifest tiene una personality que no está en la lista,
                    la mostramos como opción extra para no perder el valor. */}
                {!PRESENTER_PERSONALITIES.some((p) => p.key === manifest.personality_key) && (
                  <option value={manifest.personality_key}>
                    {manifest.personality_key} (custom)
                  </option>
                )}
              </select>
            </Field>
            <Field label="Voz (opcional)">
              <select
                value={manifest.voice_id ?? ''}
                onChange={(e) => updateManifest({ voice_id: e.target.value || undefined })}
                className="input"
              >
                <option value="">— voz default de la personalidad —</option>
                {CARTESIA_VOICES_ES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Modelo de IA (OpenRouter, opcional)"
            help="Si lo dejas en blanco, se usa el modelo configurado en la personalidad. Solo cámbialo si sabes lo que haces."
          >
            <input
              type="text"
              value={manifest.model ?? ''}
              onChange={(e) => updateManifest({ model: e.target.value || undefined })}
              placeholder="ej. google/gemini-2.0-flash-001, anthropic/claude-haiku-4.5, deepseek/deepseek-v3.2-exp"
              className="input font-mono text-xs"
            />
          </Field>

          <Field label="Modo de avance" required>
            <div className="space-y-2">
              {(['hybrid', 'on_cue', 'auto'] as AdvanceMode[]).map((m) => {
                const info = ADVANCE_MODE_DESCRIPTIONS[m];
                const checked = (manifest.advance_mode ?? 'hybrid') === m;
                return (
                  <label
                    key={m}
                    className={`border-border flex cursor-pointer gap-3 rounded-lg border p-3 ${
                      checked ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="advance_mode"
                      value={m}
                      checked={checked}
                      onChange={() => updateManifest({ advance_mode: m })}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-semibold">{info.label}</div>
                      <div className="text-muted-foreground text-xs">{info.help}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </Field>

          <Field label="Perfil de la audiencia" required>
            <textarea
              value={manifest.audience_profile}
              onChange={(e) => updateManifest({ audience_profile: e.target.value })}
              required
              rows={3}
              className="input"
            />
          </Field>

          <Field label="Tono narrativo" required>
            <textarea
              value={manifest.narrative_tone}
              onChange={(e) => updateManifest({ narrative_tone: e.target.value })}
              required
              rows={3}
              className="input"
            />
          </Field>

          <Field
            label="Glosario (opcional)"
            help='Objeto JSON: { "término": "explicación coloquial" }'
          >
            <textarea
              value={glossaryText}
              onChange={(e) => setGlossaryText(e.target.value)}
              rows={3}
              className="input font-mono text-xs"
              placeholder='{"modelo": "como un cocinero entrenado"}'
            />
          </Field>

          <div className="border-border rounded-xl border p-4">
            <div className="mb-3 text-sm font-semibold">Bloques del guion ({blocks.length})</div>
            <div className="space-y-3">
              {blocks.map((b, i) => (
                <BlockEditor
                  key={i}
                  block={b}
                  onChange={(patch) => updateBlock(i, patch)}
                  platicaId={id}
                  slideVersion={slideVersions[b.slide] ?? 0}
                  onSlideReplaced={() => bumpSlideVersion(b.slide)}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/platicas')}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground rounded-full px-5 py-2 font-mono text-xs font-bold tracking-wider uppercase disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>

        <style jsx>{`
          :global(.input) {
            width: 100%;
            border-radius: 0.5rem;
            border: 1px solid var(--border);
            background: var(--background);
            color: var(--foreground);
            padding: 0.5rem 0.75rem;
            font-size: 0.875rem;
          }
          :global(.input:focus) {
            outline: 2px solid var(--primary);
            outline-offset: -1px;
          }
        `}</style>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {help && <p className="text-muted-foreground mb-1.5 text-xs">{help}</p>}
      {children}
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
  platicaId,
  slideVersion,
  onSlideReplaced,
}: {
  block: GuionBlock;
  onChange: (patch: Partial<GuionBlock>) => void;
  platicaId: string;
  slideVersion: number;
  onSlideReplaced: () => void;
}) {
  const tpText = block.talking_points.join('\n');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ?v= solo si ya se reemplazó esta diapositiva — evita romper el caché del
  // primer load.
  const slideSrc =
    slideVersion > 0
      ? `/api/platicas/${platicaId}/slides/${block.slide}?v=${slideVersion}`
      : `/api/platicas/${platicaId}/slides/${block.slide}`;

  const handleImagePick = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await fetch(`/api/platicas/${platicaId}/slides/${block.slide}`, {
        method: 'PUT',
        credentials: 'include',
        body: fd,
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      onSlideReplaced();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="border-border bg-card rounded-lg border p-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Slide {block.slide}</div>
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              duración (seg)
              <input
                type="number"
                min={10}
                max={600}
                value={block.duration_sec}
                onChange={(e) => onChange({ duration_sec: parseInt(e.target.value, 10) || 60 })}
                className="input w-20 px-2 py-1 text-xs"
              />
            </label>
          </div>
          <input
            type="text"
            value={block.summary}
            onChange={(e) => onChange({ summary: e.target.value })}
            className="input text-sm font-medium"
            placeholder="Resumen corto del slide"
          />
          <textarea
            value={block.speaker_notes}
            onChange={(e) => onChange({ speaker_notes: e.target.value })}
            rows={3}
            className="input text-sm"
            placeholder="Lo que el presentador dice"
          />
          <textarea
            value={tpText}
            onChange={(e) =>
              onChange({
                talking_points: e.target.value
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            rows={2}
            className="input text-xs"
            placeholder="Talking points (uno por línea)"
          />
        </div>

        <div className="sm:w-72 sm:shrink-0">
          <div className="border-border bg-muted/30 relative overflow-hidden rounded-md border">
            {/* Aspect ratio fijo 16:9 — coincide con la mayoría de slides
                exportados a PDF. Si el slide tiene otra proporción, object-contain
                respeta la imagen original. */}
            <div className="relative aspect-video w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slideSrc}
                alt={`Slide ${block.slide}`}
                className="absolute inset-0 h-full w-full object-contain"
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white">
                  Subiendo…
                </div>
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImagePick(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="border-border hover:bg-accent mt-2 w-full rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50"
          >
            {uploading ? 'Subiendo…' : 'Reemplazar imagen'}
          </button>
          {uploadError && (
            <div className="mt-1 text-xs text-red-600 dark:text-red-400">{uploadError}</div>
          )}
        </div>
      </div>
    </div>
  );
}
