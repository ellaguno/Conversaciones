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
import {
  type AdvanceMode,
  DEFAULT_PRESENTER,
  type GuionBlock,
  type OverlayCorner,
  type PlaticaGuion,
  type PlaticaManifest,
  type PresenterGender,
  type PresenterVisualizer,
  type SlideTransition,
} from '@/lib/platica-schema';

const OVERLAY_CORNER_OPTIONS: { value: OverlayCorner; label: string }[] = [
  { value: 'top-right', label: 'Arriba derecha (default)' },
  { value: 'top-left', label: 'Arriba izquierda' },
  { value: 'bottom-right', label: 'Abajo derecha' },
  { value: 'bottom-left', label: 'Abajo izquierda' },
];

const VISUALIZER_OPTIONS: { value: PresenterVisualizer; label: string }[] = [
  { value: 'aura', label: 'Aura (default)' },
  { value: 'wave', label: 'Onda' },
  { value: 'bar', label: 'Barras' },
  { value: 'grid', label: 'Cuadrícula' },
  { value: 'radial', label: 'Radial' },
];

const TRANSITION_OPTIONS: { value: SlideTransition; label: string; help: string }[] = [
  { value: 'none', label: 'Sin efecto', help: 'Corte directo, instantáneo.' },
  { value: 'fade', label: 'Fade (recomendado)', help: 'Disolvencia suave entre slides.' },
  {
    value: 'slide_left',
    label: 'Deslizar a la izquierda',
    help: 'El nuevo slide entra por la derecha.',
  },
  {
    value: 'slide_right',
    label: 'Deslizar a la derecha',
    help: 'El nuevo slide entra por la izquierda.',
  },
  { value: 'slide_up', label: 'Deslizar hacia arriba', help: 'El nuevo slide sube desde abajo.' },
  { value: 'zoom', label: 'Zoom', help: 'El nuevo slide aparece haciendo zoom in.' },
];

// Cartesia voice id → 'hombre' | 'mujer' (derivado del campo gender de
// CARTESIA_VOICES_ES) para autollenar el campo Género al elegir voz.
const VOICE_GENDER_MAP: Record<string, PresenterGender> = Object.fromEntries(
  CARTESIA_VOICES_ES.map((v) => [v.id, v.gender === 'F' ? 'mujer' : 'hombre'])
);

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
        // Pláticas legacy guardaban personality_key sin presenter_*. Prealimenta
        // los nuevos campos con el default (Tato) para que la UI tenga algo
        // editable; el manifest solo se actualiza al guardar.
        const seeded: PlaticaManifest = {
          ...m,
          presenter_name: m.presenter_name ?? DEFAULT_PRESENTER.name,
          presenter_gender: m.presenter_gender ?? DEFAULT_PRESENTER.gender,
          presenter_persona: m.presenter_persona ?? DEFAULT_PRESENTER.persona,
          voice_id: m.voice_id ?? DEFAULT_PRESENTER.voice_id,
        };
        setManifest(seeded);
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

  // Las operaciones estructurales (mover/borrar/insertar) tocan disco y
  // renumeran slides. Si hay edits pendientes en memoria, hay que persistirlos
  // antes para que el endpoint estructural no los pise. Esta función arma el
  // mismo payload que `submit` y lo envía silenciosamente.
  const persistCurrentEdits = async (): Promise<boolean> => {
    if (!manifest || !blocks) return false;
    let glossary: Record<string, string> | undefined;
    if (glossaryText.trim()) {
      try {
        const parsed = JSON.parse(glossaryText);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          setError('El glosario debe ser un objeto JSON.');
          return false;
        }
        glossary = parsed;
      } catch {
        setError('El glosario no es JSON válido.');
        return false;
      }
    }
    let acc = 0;
    const cleanedBlocks = blocks.map((b) => {
      const out = { ...b, start_sec: acc };
      acc += Math.max(0, Number(b.duration_sec) || 0);
      return out;
    });
    const manifestPatch = {
      title: manifest.title,
      personality_key: manifest.personality_key,
      presenter_name: manifest.presenter_name?.trim() || undefined,
      presenter_gender: manifest.presenter_gender,
      presenter_persona: manifest.presenter_persona?.trim() || undefined,
      audience_profile: manifest.audience_profile,
      narrative_tone: manifest.narrative_tone,
      advance_mode: manifest.advance_mode,
      slide_transition: manifest.slide_transition,
      presenter_overlay_corner: manifest.presenter_overlay_corner,
      presenter_visualizer: manifest.presenter_visualizer,
      voice_id: manifest.voice_id || undefined,
      model: manifest.model || undefined,
      glossary,
      story_arcs: manifest.story_arcs,
      key_moments: manifest.key_moments,
    };
    try {
      const r = await fetch(`/api/platicas/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest: manifestPatch, guion: { blocks: cleanedBlocks } }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${r.status}`);
        return false;
      }
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const refreshSlideVersions = (count: number) => {
    const fresh: Record<number, number> = {};
    const t = Date.now();
    for (let s = 1; s <= count; s++) fresh[s] = t;
    setSlideVersions(fresh);
  };

  const [structureBusy, setStructureBusy] = useState(false);

  // Mover bloque idx una posición arriba (-1) o abajo (+1). Persiste edits
  // pendientes, envía la permutación al backend, y reemplaza el estado local.
  const handleMove = async (idx: number, direction: -1 | 1) => {
    if (!blocks) return;
    const j = idx + direction;
    if (j < 0 || j >= blocks.length) return;
    setError(null);
    setStructureBusy(true);
    try {
      const ok = await persistCurrentEdits();
      if (!ok) return;
      const order = blocks.map((b) => b.slide);
      [order[idx], order[j]] = [order[j], order[idx]];
      const r = await fetch(`/api/platicas/${id}/order`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      const m = body.manifest as PlaticaManifest;
      setManifest((prev) => (prev ? { ...prev, ...m } : m));
      setBlocks((body.guion as PlaticaGuion).blocks);
      refreshSlideVersions(m.slide_count);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStructureBusy(false);
    }
  };

  // Borrar slide. Confirma con el usuario antes — la imagen se pierde.
  const handleDelete = async (idx: number) => {
    if (!blocks) return;
    const block = blocks[idx];
    if (!block) return;
    if (blocks.length <= 1) {
      setError('No puedes borrar el último slide.');
      return;
    }
    if (
      !confirm(
        `¿Borrar el slide ${block.slide}? La imagen se elimina y los slides posteriores se renumeran. Esta acción no se puede deshacer (a menos que vuelvas a subir el PDF original).`
      )
    ) {
      return;
    }
    setError(null);
    setStructureBusy(true);
    try {
      const ok = await persistCurrentEdits();
      if (!ok) return;
      const r = await fetch(`/api/platicas/${id}/slides/${block.slide}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      const m = body.manifest as PlaticaManifest;
      setManifest((prev) => (prev ? { ...prev, ...m } : m));
      setBlocks((body.guion as PlaticaGuion).blocks);
      refreshSlideVersions(m.slide_count);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStructureBusy(false);
    }
  };

  // Insertar slide en `position` (1..slide_count+1) con la imagen subida.
  const handleInsert = async (position: number, file: File) => {
    if (!manifest) return;
    setError(null);
    setStructureBusy(true);
    try {
      const ok = await persistCurrentEdits();
      if (!ok) return;
      const fd = new FormData();
      fd.append('position', String(position));
      fd.append('image', file);
      const r = await fetch(`/api/platicas/${id}/slides`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      const m = body.manifest as PlaticaManifest;
      setManifest((prev) => (prev ? { ...prev, ...m } : m));
      setBlocks((body.guion as PlaticaGuion).blocks);
      refreshSlideVersions(m.slide_count);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStructureBusy(false);
    }
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
      presenter_name: manifest.presenter_name?.trim() || undefined,
      presenter_gender: manifest.presenter_gender,
      presenter_persona: manifest.presenter_persona?.trim() || undefined,
      audience_profile: manifest.audience_profile,
      narrative_tone: manifest.narrative_tone,
      advance_mode: manifest.advance_mode,
      slide_transition: manifest.slide_transition,
      presenter_overlay_corner: manifest.presenter_overlay_corner,
      presenter_visualizer: manifest.presenter_visualizer,
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

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Nombre" required>
              <input
                type="text"
                value={manifest.presenter_name ?? ''}
                onChange={(e) => updateManifest({ presenter_name: e.target.value })}
                required
                className="input"
                placeholder="Tato"
              />
            </Field>
            <Field label="Género" required>
              <select
                value={manifest.presenter_gender ?? 'hombre'}
                onChange={(e) =>
                  updateManifest({ presenter_gender: e.target.value as PresenterGender })
                }
                className="input"
              >
                <option value="hombre">Hombre</option>
                <option value="mujer">Mujer</option>
              </select>
            </Field>
            <Field label="Voz">
              <select
                value={manifest.voice_id ?? ''}
                onChange={(e) => {
                  const newVoice = e.target.value || undefined;
                  // Cuando cambias voz, el género se realinea con la voz nueva
                  // para que las concordancias del LLM (presentador/presentadora)
                  // coincidan con cómo suena. El usuario puede sobrescribirlo.
                  const inferred = newVoice ? VOICE_GENDER_MAP[newVoice] : undefined;
                  updateManifest({
                    voice_id: newVoice,
                    ...(inferred ? { presenter_gender: inferred } : {}),
                  });
                }}
                className="input"
              >
                <option value="">— sin asignar —</option>
                {CARTESIA_VOICES_ES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Personalidad del presentador"
            required
            help="Texto que se inyecta como system prompt del agente. Define cómo habla, qué reglas sigue y su tono."
          >
            <textarea
              value={manifest.presenter_persona ?? ''}
              onChange={(e) => updateManifest({ presenter_persona: e.target.value })}
              required
              rows={10}
              className="input text-sm"
            />
          </Field>

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

          <Field
            label="Efecto de transición entre slides"
            help="Se aplica a TODOS los cambios de slide en la vista de proyección. (Por slide se podrá configurar después.)"
          >
            <select
              value={manifest.slide_transition ?? 'fade'}
              onChange={(e) =>
                updateManifest({ slide_transition: e.target.value as SlideTransition })
              }
              className="input"
            >
              {TRANSITION_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} — {t.help}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Visualizador del orador"
              help='Solo aplica en modo "Presentar todo en uno". Reactivo al estado del agente.'
            >
              <select
                value={manifest.presenter_visualizer ?? 'aura'}
                onChange={(e) =>
                  updateManifest({ presenter_visualizer: e.target.value as PresenterVisualizer })
                }
                className="input"
              >
                {VISUALIZER_OPTIONS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Esquina del visualizador"
              help='Posición del visualizador sobre el slide en modo "todo en uno".'
            >
              <select
                value={manifest.presenter_overlay_corner ?? 'top-right'}
                onChange={(e) =>
                  updateManifest({ presenter_overlay_corner: e.target.value as OverlayCorner })
                }
                className="input"
              >
                {OVERLAY_CORNER_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

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
            <div className="space-y-1">
              {blocks.map((b, i) => (
                <div key={`block-${i}`}>
                  <InsertSlideButton
                    position={i + 1}
                    disabled={structureBusy}
                    onInsert={handleInsert}
                  />
                  <BlockEditor
                    block={b}
                    index={i}
                    total={blocks.length}
                    busy={structureBusy}
                    onChange={(patch) => updateBlock(i, patch)}
                    onMove={(dir) => handleMove(i, dir)}
                    onToggleHidden={() => updateBlock(i, { hidden: !b.hidden })}
                    onDelete={() => handleDelete(i)}
                    platicaId={id}
                    slideVersion={slideVersions[b.slide] ?? 0}
                    onSlideReplaced={() => bumpSlideVersion(b.slide)}
                  />
                </div>
              ))}
              <InsertSlideButton
                position={blocks.length + 1}
                disabled={structureBusy}
                onInsert={handleInsert}
              />
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
  index,
  total,
  busy,
  onChange,
  onMove,
  onToggleHidden,
  onDelete,
  platicaId,
  slideVersion,
  onSlideReplaced,
}: {
  block: GuionBlock;
  index: number;
  total: number;
  busy: boolean;
  onChange: (patch: Partial<GuionBlock>) => void;
  onMove: (direction: -1 | 1) => void;
  onToggleHidden: () => void;
  onDelete: () => void;
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

  const isFirst = index === 0;
  const isLast = index === total - 1;
  const hidden = block.hidden === true;

  return (
    <div
      className={`border-border bg-card rounded-lg border p-3 ${
        hidden ? 'opacity-60' : ''
      } ${busy ? 'pointer-events-none' : ''}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">Slide {block.slide}</div>
              {hidden && (
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-amber-700 uppercase dark:text-amber-300">
                  Oculto
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onMove(-1)}
                disabled={isFirst || busy}
                title="Mover arriba"
                aria-label="Mover arriba"
                className="border-border hover:bg-accent rounded border px-2 py-1 text-xs disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onMove(1)}
                disabled={isLast || busy}
                title="Mover abajo"
                aria-label="Mover abajo"
                className="border-border hover:bg-accent rounded border px-2 py-1 text-xs disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={onToggleHidden}
                disabled={busy}
                title={hidden ? 'Mostrar slide' : 'Ocultar slide (saltar en presentación)'}
                aria-label={hidden ? 'Mostrar slide' : 'Ocultar slide'}
                className="border-border hover:bg-accent rounded border px-2 py-1 text-xs disabled:opacity-30"
              >
                {hidden ? '👁' : '🚫'}
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                title="Borrar slide"
                aria-label="Borrar slide"
                className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-600 hover:bg-red-500/10 disabled:opacity-30 dark:text-red-400"
              >
                🗑
              </button>
              <label className="text-muted-foreground ml-2 flex items-center gap-2 text-xs">
                seg
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={block.duration_sec}
                  onChange={(e) => onChange({ duration_sec: parseInt(e.target.value, 10) || 60 })}
                  className="input w-16 px-2 py-1 text-xs"
                />
              </label>
            </div>
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
          <MediaInput block={block} onChange={onChange} />
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

// Parser de URL de YouTube → {video_id, start_sec}. Acepta watch?v=, youtu.be,
// embed/, shorts/, o el ID pelado. Devuelve null si la URL no es de YouTube.
function parseYoutubeUrl(input: string): { video_id: string; start_sec?: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // ID pelado (11 chars).
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return { video_id: trimmed };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  let videoId: string | null = null;
  if (host === 'youtu.be') {
    videoId = url.pathname.slice(1).split('/')[0] || null;
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host.endsWith('.youtube.com')) {
    if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v');
    } else if (url.pathname.startsWith('/embed/')) {
      videoId = url.pathname.split('/')[2] || null;
    } else if (url.pathname.startsWith('/shorts/')) {
      videoId = url.pathname.split('/')[2] || null;
    }
  }
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  // Start time: ?t=30, ?t=30s, ?t=1m20s, ?start=30
  const t = url.searchParams.get('t') || url.searchParams.get('start');
  let startSec: number | undefined;
  if (t) {
    const m = t.match(/^(?:(\d+)m)?(\d+)s?$/);
    if (m) startSec = (parseInt(m[1] || '0', 10) || 0) * 60 + parseInt(m[2], 10);
    else if (/^\d+$/.test(t)) startSec = parseInt(t, 10);
  }
  return startSec !== undefined
    ? { video_id: videoId, start_sec: startSec }
    : { video_id: videoId };
}

function MediaInput({
  block,
  onChange,
}: {
  block: GuionBlock;
  onChange: (patch: Partial<GuionBlock>) => void;
}) {
  // Estado local del input de URL — solo refleja el media actual al primer
  // render. El usuario edita libremente y solo escribimos `media` cuando la
  // URL parsea bien (o cuando borra el input → media = undefined).
  const [text, setText] = useState<string>(() => {
    if (!block.media || block.media.type !== 'youtube') return '';
    return block.media.video_id ? `https://youtu.be/${block.media.video_id}` : '';
  });
  const [parseError, setParseError] = useState<string | null>(null);

  const apply = (raw: string) => {
    setText(raw);
    if (!raw.trim()) {
      setParseError(null);
      onChange({ media: undefined });
      return;
    }
    const parsed = parseYoutubeUrl(raw);
    if (!parsed) {
      setParseError('URL de YouTube no reconocida');
      return;
    }
    setParseError(null);
    onChange({
      media: {
        type: 'youtube',
        video_id: parsed.video_id,
        ...(parsed.start_sec !== undefined && { start_sec: parsed.start_sec }),
        autoplay: true,
      },
    });
  };

  const hasMedia = block.media?.type === 'youtube' && !!block.media.video_id;

  return (
    <div className="space-y-1">
      <label className="text-muted-foreground flex items-center gap-2 text-[11px]">
        <span className="font-mono tracking-wider uppercase">Video YouTube</span>
        {hasMedia && (
          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-700 dark:text-red-300">
            ▶ silencia al orador
          </span>
        )}
      </label>
      <input
        type="text"
        value={text}
        onChange={(e) => apply(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=… (vacío = sin video)"
        className="input text-xs"
      />
      {parseError && <div className="text-xs text-red-600 dark:text-red-400">{parseError}</div>}
    </div>
  );
}

// Insertar slide nuevo en una posición específica del guion. Aparece como una
// línea fina entre cada par de bloques (y al final). Al darle click, abre el
// selector de archivos; al elegir imagen, llama al endpoint de inserción.
function InsertSlideButton({
  position,
  disabled,
  onInsert,
}: {
  position: number;
  disabled: boolean;
  onInsert: (position: number, file: File) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div className="group flex justify-center py-1">
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            onInsert(position, f);
            if (ref.current) ref.current.value = '';
          }
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2 rounded-full px-3 py-0.5 text-xs opacity-40 transition-opacity group-hover:opacity-100 hover:opacity-100 disabled:opacity-20"
      >
        + Insertar slide en posición {position}
      </button>
    </div>
  );
}
