'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface TreeNode {
  id: string;
  titulo: string;
  estado: 'pendiente' | 'en_progreso' | 'cubierto' | 'profundizar' | 'saltado' | string;
  // true → state was fixed by the human via this editor; the post-session
  // analysis and the chars-based heuristic both leave it alone.
  estado_manual?: boolean;
  preguntas_clave?: string[];
  resumen?: string;
  razon_profundizar?: string;
  sesiones?: number[];
  hijos?: TreeNode[];
  motivo_alta?: string;
}

export interface Tree {
  version?: number;
  modo?: string;
  updated_at?: string | null;
  raiz: TreeNode;
}

const STATES: TreeNode['estado'][] = [
  'pendiente',
  'en_progreso',
  'cubierto',
  'profundizar',
  'saltado',
];

const STATE_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  cubierto: 'Cubierto',
  profundizar: 'Profundizar',
  saltado: 'Saltado',
};

const STATE_COLOR: Record<string, string> = {
  pendiente: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  en_progreso: 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100',
  cubierto: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100',
  profundizar: 'bg-indigo-200 text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100',
  saltado: 'bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-400',
};

function emptyTree(modo: string): Tree {
  return {
    version: 1,
    modo,
    updated_at: null,
    raiz: {
      id: 'r',
      titulo: 'Entrevista',
      estado: 'pendiente',
      preguntas_clave: [],
      resumen: '',
      sesiones: [],
      hijos: [],
    },
  };
}

function nextChildId(parentId: string, parent: TreeNode): string {
  const count = (parent.hijos || []).length + 1;
  return parentId === 'r' ? String(count) : `${parentId}.${count}`;
}

function cloneTree(t: Tree): Tree {
  return JSON.parse(JSON.stringify(t));
}

function updateNode(node: TreeNode, id: string, fn: (n: TreeNode) => void): boolean {
  if (node.id === id) {
    fn(node);
    return true;
  }
  for (const c of node.hijos || []) {
    if (updateNode(c, id, fn)) return true;
  }
  return false;
}

function deleteNode(node: TreeNode, id: string): boolean {
  if (!node.hijos) return false;
  const idx = node.hijos.findIndex((c) => c.id === id);
  if (idx >= 0) {
    node.hijos.splice(idx, 1);
    return true;
  }
  for (const c of node.hijos) {
    if (deleteNode(c, id)) return true;
  }
  return false;
}

interface NodeViewProps {
  node: TreeNode;
  isRoot: boolean;
  expanded: Set<string>;
  toggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<TreeNode>) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
}

function NodeView({
  node,
  isRoot,
  expanded,
  toggle,
  onUpdate,
  onAddChild,
  onDelete,
}: NodeViewProps) {
  const isOpen = expanded.has(node.id);
  const hasChildren = (node.hijos || []).length > 0;
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(node.titulo);

  useEffect(() => {
    if (!editingTitle) setTitleDraft(node.titulo);
  }, [node.titulo, editingTitle]);

  const commitTitle = () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== node.titulo) {
      onUpdate(node.id, { titulo: trimmed });
    }
  };

  return (
    <li className="border-l border-zinc-200 pl-3 dark:border-zinc-700">
      <div className="flex items-start gap-2 py-1">
        <button
          onClick={() => toggle(node.id)}
          className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          aria-label={isOpen ? 'Colapsar' : 'Expandir'}
        >
          {hasChildren ? (isOpen ? '▼' : '▶') : '·'}
        </button>
        <span className="pt-1 font-mono text-xs text-zinc-400">[{node.id}]</span>
        {editingTitle ? (
          <input
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') {
                setTitleDraft(node.titulo);
                setEditingTitle(false);
              }
            }}
            className="flex-1 border-b border-zinc-400 bg-transparent px-1 text-sm focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="flex-1 text-left text-sm hover:underline"
          >
            {node.titulo || '(sin título)'}
          </button>
        )}
        <select
          value={node.estado}
          onChange={(e) => onUpdate(node.id, { estado: e.target.value, estado_manual: true })}
          className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_COLOR[node.estado] || ''}`}
        >
          {STATES.map((s) => (
            <option key={s} value={s}>
              {STATE_LABEL[s] || s}
            </option>
          ))}
        </select>
        {node.estado_manual ? (
          <button
            onClick={() => onUpdate(node.id, { estado_manual: false })}
            title="Estado fijado a mano — clic para liberar (el sistema retomará control automático según contenido)"
            className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-100"
          >
            🔒
          </button>
        ) : (
          <span
            title="Estado automático — se actualiza según el contenido y el análisis post-sesión"
            className="text-[10px] text-zinc-400"
          >
            ⚙
          </span>
        )}
        <button
          onClick={() => onAddChild(node.id)}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          title="Agregar subtema"
        >
          + sub
        </button>
        {!isRoot && (
          <button
            onClick={() => {
              if (confirm(`¿Eliminar el nodo "${node.titulo}" y todos sus hijos?`)) {
                onDelete(node.id);
              }
            }}
            className="text-xs text-red-500 hover:text-red-700"
            title="Eliminar nodo"
          >
            ×
          </button>
        )}
      </div>
      {isOpen && (
        <>
          {(node.preguntas_clave || []).length > 0 && (
            <div className="mb-1 ml-6 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium">Preguntas:</span>{' '}
              {(node.preguntas_clave || []).join(' · ')}
            </div>
          )}
          {node.razon_profundizar && (
            <div className="mb-1 ml-6 text-xs text-indigo-700 italic dark:text-indigo-300">
              ↻ {node.razon_profundizar}
            </div>
          )}
          {node.resumen && (
            <div className="mb-1 ml-6 max-w-xl text-xs text-zinc-600 dark:text-zinc-300">
              {node.resumen}
            </div>
          )}
          {hasChildren && (
            <ul className="ml-3">
              {(node.hijos || []).map((c) => (
                <NodeView
                  key={c.id}
                  node={c}
                  isRoot={false}
                  expanded={expanded}
                  toggle={toggle}
                  onUpdate={onUpdate}
                  onAddChild={onAddChild}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}

interface TreeEditorProps {
  initialTree: Tree | null;
  modo: string;
  interviewId: string;
}

export function TreeEditor({ initialTree, modo, interviewId }: TreeEditorProps) {
  const [tree, setTree] = useState<Tree>(() => initialTree || emptyTree(modo));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(initialTree?.updated_at || null);

  const expanded = useMemo(() => new Set<string>(['r']), []);
  const [, setTick] = useState(0);
  const force = useCallback(() => setTick((t) => t + 1), []);
  const toggle = useCallback(
    (id: string) => {
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      force();
    },
    [expanded, force]
  );

  const onUpdate = useCallback((id: string, patch: Partial<TreeNode>) => {
    setTree((prev) => {
      const next = cloneTree(prev);
      updateNode(next.raiz, id, (n) => {
        Object.assign(n, patch);
      });
      return next;
    });
    setDirty(true);
  }, []);

  const onAddChild = useCallback(
    (parentId: string) => {
      const titulo = prompt('Título del subtema:');
      if (!titulo || !titulo.trim()) return;
      setTree((prev) => {
        const next = cloneTree(prev);
        updateNode(next.raiz, parentId, (parent) => {
          const id = nextChildId(parentId, parent);
          parent.hijos = parent.hijos || [];
          parent.hijos.push({
            id,
            titulo: titulo.trim(),
            estado: 'pendiente',
            preguntas_clave: [],
            resumen: '',
            sesiones: [],
            hijos: [],
          });
          expanded.add(parentId);
        });
        return next;
      });
      setDirty(true);
    },
    [expanded]
  );

  const onDelete = useCallback((id: string) => {
    setTree((prev) => {
      const next = cloneTree(prev);
      deleteNode(next.raiz, id);
      return next;
    });
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/entrevistas/${encodeURIComponent(interviewId)}/arbol`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tree),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Error ${res.status}`);
      }
      setDirty(false);
      setSavedAt(new Date().toISOString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [interviewId, tree]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-mono text-xs tracking-wide text-zinc-500 uppercase">
          Árbol de temas {tree.modo ? `(${tree.modo})` : ''}
        </h3>
        <div className="flex items-center gap-3">
          {savedAt && !dirty && (
            <span className="text-xs text-zinc-400">
              Guardado: {new Date(savedAt).toLocaleString()}
            </span>
          )}
          {dirty && <span className="text-xs text-amber-600 dark:text-amber-300">Sin guardar</span>}
          {error && <span className="text-xs text-red-500">{error}</span>}
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? 'Guardando…' : 'Guardar árbol'}
          </button>
        </div>
      </div>
      {(!tree.raiz.hijos || tree.raiz.hijos.length === 0) && (
        <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
          El árbol está vacío. El análisis lo generará automáticamente después de la primera sesión
          de intake, o puedes empezar agregando ramas aquí mismo.
        </p>
      )}
      <ul className="text-sm">
        <NodeView
          node={tree.raiz}
          isRoot
          expanded={expanded}
          toggle={toggle}
          onUpdate={onUpdate}
          onAddChild={onAddChild}
          onDelete={onDelete}
        />
      </ul>
    </div>
  );
}
