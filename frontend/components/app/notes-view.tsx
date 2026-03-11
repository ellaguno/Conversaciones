'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MarkdownEditor } from './markdown-editor';

interface SessionFile {
  filename: string;
  date: string;
  title: string;
}

interface PatientData {
  id: string;
  name: string;
  sessionNumber: number;
  sessions: SessionFile[];
  profile: string | null;
  generalSummary: string | null;
  agenda: string | null;
  treatmentPlan: string | null;
  recurringThemes: string | null;
  progress: string | null;
}

type NoteTab = 'sesiones' | 'perfil' | 'resumen' | 'plan' | 'temas' | 'progreso' | 'agenda';

const TABS: { key: NoteTab; label: string; icon: string }[] = [
  { key: 'sesiones', label: 'Sesiones', icon: '📋' },
  { key: 'perfil', label: 'Perfil', icon: '👤' },
  { key: 'resumen', label: 'Resumen', icon: '📝' },
  { key: 'plan', label: 'Plan', icon: '🎯' },
  { key: 'temas', label: 'Temas', icon: '🔄' },
  { key: 'progreso', label: 'Progreso', icon: '📈' },
  { key: 'agenda', label: 'Agenda', icon: '📅' },
];

const TAB_NOTE_TYPE: Record<NoteTab, string> = {
  sesiones: 'session',
  perfil: 'profile',
  resumen: 'generalSummary',
  plan: 'treatmentPlan',
  temas: 'recurringThemes',
  progreso: 'progress',
  agenda: 'agenda',
};

// --- Markdown viewer with custom components ---
function MarkdownContent({ content, title }: { content: string; title?: string }) {
  const cleaned = content.replace(/^```markdown\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return (
    <article>
      {title && <h2 className="text-foreground mb-4 text-lg font-bold">{title}</h2>}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-foreground border-border mt-6 mb-4 border-b pb-2 text-xl font-bold">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-foreground mt-5 mb-3 flex items-center gap-2 text-lg font-bold">
              <span className="inline-block h-5 w-1 rounded-full bg-purple-500" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-foreground mt-4 mb-2 text-base font-semibold">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-foreground/80 mb-3 text-sm leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="text-foreground/80 mb-3 ml-1 space-y-1.5 text-sm">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="text-foreground/80 mb-3 ml-1 list-decimal space-y-1.5 pl-4 text-sm">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="flex items-start gap-2 leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />
              <span className="flex-1">{children}</span>
            </li>
          ),
          strong: ({ children }) => (
            <strong className="text-foreground font-semibold">{children}</strong>
          ),
          hr: () => <hr className="border-border my-4" />,
          blockquote: ({ children }) => (
            <blockquote className="text-foreground/70 my-3 rounded-r-lg border-l-3 border-purple-400 bg-purple-50 py-2 pr-3 pl-4 text-sm italic dark:bg-purple-950/20">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="border-border my-3 overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50 text-muted-foreground text-xs font-semibold uppercase">
              {children}
            </thead>
          ),
          td: ({ children }) => (
            <td className="border-border text-foreground/80 border-t px-3 py-2">{children}</td>
          ),
          th: ({ children }) => <th className="px-3 py-2 text-left">{children}</th>,
          input: (props) => {
            if (props.type === 'checkbox') {
              return (
                <span
                  className={`mr-2 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] ${
                    props.checked
                      ? 'border-purple-500 bg-purple-500 text-white'
                      : 'border-border bg-background'
                  }`}
                >
                  {props.checked && '✓'}
                </span>
              );
            }
            return <input {...props} />;
          },
        }}
      >
        {cleaned}
      </ReactMarkdown>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
      <div className="mb-3 text-4xl opacity-30">📄</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ChevronLeft({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="border-border bg-background w-full max-w-sm rounded-2xl border p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-foreground mb-4 text-sm">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="border-border text-muted-foreground hover:text-foreground rounded-lg border px-4 py-2 text-xs font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-700"
          >
            Borrar
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Action buttons for view mode ---
function NoteActions({
  onEdit,
  onDelete,
  onEmailTranscript,
  onEmailHomework,
  emailLoading,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onEmailTranscript?: () => void;
  onEmailHomework?: () => void;
  emailLoading?: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      {onEmailTranscript && (
        <button
          onClick={onEmailTranscript}
          disabled={emailLoading}
          className="border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          title="Enviar notas por correo"
        >
          {emailLoading ? '...' : '📧 Enviar'}
        </button>
      )}
      {onEmailHomework && (
        <button
          onClick={onEmailHomework}
          disabled={emailLoading}
          className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50 dark:border-green-900 dark:hover:bg-green-950/30"
          title="Enviar tareas por correo"
        >
          {emailLoading ? '...' : '📋 Tareas'}
        </button>
      )}
      <button
        onClick={onEdit}
        className="border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
        title="Editar"
      >
        Editar
      </button>
      <button
        onClick={onDelete}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
        title="Borrar"
      >
        Borrar
      </button>
    </div>
  );
}

// --- Main component ---
interface NotesViewProps {
  onBack: () => void;
  onStartSession: (patientId?: string) => void;
}

export function NotesView({ onBack, onStartSession }: NotesViewProps) {
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(null);
  const [activeTab, setActiveTab] = useState<NoteTab>('sesiones');
  const [sessionContent, setSessionContent] = useState<string | null>(null);
  const [viewingSession, setViewingSession] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{
    noteType: string;
    filename?: string;
  } | null>(null);
  const [confirmDeletePatient, setConfirmDeletePatient] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ text: string; error: boolean } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleSendEmail = async (type: 'transcript' | 'homework', recipientEmail?: string) => {
    if (!selectedPatient || !viewingSession) return;
    setEmailLoading(true);
    setEmailMsg(null);
    try {
      const res = await fetch('/api/sessions/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          sessionFilename: viewingSession,
          type,
          ...(recipientEmail && { recipientEmail }),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailMsg({
          text: type === 'homework' ? 'Tareas enviadas por correo' : 'Notas enviadas por correo',
          error: false,
        });
      } else {
        setEmailMsg({ text: data.error || 'Error al enviar', error: true });
      }
    } catch {
      setEmailMsg({ text: 'Error de conexion', error: true });
    }
    setEmailLoading(false);
    // Auto-clear message after 4s
    setTimeout(() => setEmailMsg(null), 4000);
  };

  const fetchData = useCallback(() => {
    fetch('/api/sessions')
      .then((r) => r.json())
      .then((data) => {
        const list: PatientData[] = data.patients || [];
        setPatients(list);
        setSelectedPatient((prev) => {
          if (prev) {
            // Preserve selection, update data
            const updated = list.find((p) => p.id === prev.id);
            return updated || (list.length > 0 ? list[0] : null);
          }
          return list.length > 0 ? list[0] : null;
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [activeTab, viewingSession, editing]);

  const handleViewSession = async (filename: string) => {
    try {
      const res = await fetch(
        `/api/sessions/${filename}?patientId=${encodeURIComponent(selectedPatient!.id)}`
      );
      const data = await res.json();
      setSessionContent(data.content);
      setViewingSession(filename);
      setEditing(false);
    } catch {
      setSessionContent('Error al cargar la nota.');
      setViewingSession(filename);
    }
  };

  const getNoteContent = (): string | null => {
    if (!selectedPatient) return null;
    const map: Record<NoteTab, string | null> = {
      sesiones: null,
      perfil: selectedPatient.profile,
      resumen: selectedPatient.generalSummary,
      plan: selectedPatient.treatmentPlan,
      temas: selectedPatient.recurringThemes,
      progreso: selectedPatient.progress,
      agenda: selectedPatient.agenda,
    };
    return map[activeTab];
  };

  const handleStartEdit = () => {
    const content = activeTab === 'sesiones' && viewingSession ? sessionContent : getNoteContent();
    if (content) {
      setEditContent(content);
      setEditing(true);
    }
  };

  const handleSave = async (markdown: string) => {
    const noteType = activeTab === 'sesiones' ? 'session' : TAB_NOTE_TYPE[activeTab];
    const body: Record<string, string> = {
      noteType,
      content: markdown,
      patientId: selectedPatient!.id,
    };
    if (activeTab === 'sesiones' && viewingSession) {
      body.filename = viewingSession;
    }

    try {
      await fetch('/api/sessions/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setEditing(false);
      // Reload data
      if (activeTab === 'sesiones' && viewingSession) {
        setSessionContent(markdown);
      }
      fetchData();
    } catch {
      alert('Error al guardar');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await fetch('/api/sessions/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...confirmDelete, patientId: selectedPatient!.id }),
      });
      setConfirmDelete(null);
      setEditing(false);
      if (confirmDelete.noteType === 'session') {
        setViewingSession(null);
        setSessionContent(null);
      }
      fetchData();
    } catch {
      alert('Error al borrar');
    }
  };

  const handleRequestDelete = () => {
    const noteType = activeTab === 'sesiones' ? 'session' : TAB_NOTE_TYPE[activeTab];
    const payload: { noteType: string; filename?: string } = { noteType };
    if (activeTab === 'sesiones' && viewingSession) {
      payload.filename = viewingSession;
    }
    setConfirmDelete(payload);
  };

  const handleDeletePatient = async () => {
    if (!confirmDeletePatient) return;
    try {
      await fetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: confirmDeletePatient }),
      });
      setConfirmDeletePatient(null);
      setSelectedPatient(null);
      fetchData();
    } catch {
      alert('Error al eliminar paciente');
    }
  };

  if (loading) {
    return (
      <div className="bg-background text-muted-foreground fixed inset-0 flex items-center justify-center">
        <p className="text-sm">Cargando...</p>
      </div>
    );
  }

  const handleCreatePatient = () => {
    if (!newPatientName.trim()) return;
    // Convert name to a safe directory id: lowercase, spaces to underscores
    const patientId = newPatientName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '');
    if (!patientId) return;
    setCreatingPatient(false);
    setNewPatientName('');
    // Start a session directly — the agent will create the patient directory on first session
    onStartSession(patientId);
  };

  // Patient list view
  if (!selectedPatient) {
    return (
      <div className="bg-background fixed inset-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-foreground text-xl font-bold">Pacientes</h2>
            <button
              onClick={onBack}
              className="border-border text-muted-foreground hover:text-foreground rounded-full border px-4 py-1.5 text-xs font-medium transition-colors"
            >
              Volver
            </button>
          </div>

          {/* New patient form */}
          {creatingPatient ? (
            <div className="mb-4 rounded-xl border-2 border-purple-300 bg-purple-50 p-4 dark:border-purple-700 dark:bg-purple-950/30">
              <p className="text-foreground mb-3 text-sm font-semibold">Nuevo paciente</p>
              <input
                type="text"
                value={newPatientName}
                onChange={(e) => setNewPatientName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePatient()}
                placeholder="Nombre del paciente"
                autoFocus
                className="border-border bg-background text-foreground placeholder:text-muted-foreground mb-3 w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreatePatient}
                  disabled={!newPatientName.trim()}
                  className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                >
                  Iniciar primera sesion
                </button>
                <button
                  onClick={() => {
                    setCreatingPatient(false);
                    setNewPatientName('');
                  }}
                  className="border-border text-muted-foreground hover:text-foreground rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreatingPatient(true)}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-purple-300 p-4 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/20"
            >
              <span className="text-lg">+</span>
              Nuevo paciente
            </button>
          )}

          {confirmDeletePatient && (
            <ConfirmDialog
              message={`¿Eliminar al paciente "${patients.find((p) => p.id === confirmDeletePatient)?.name || confirmDeletePatient}"? Los datos se conservaran como respaldo pero no seran visibles.`}
              onConfirm={handleDeletePatient}
              onCancel={() => setConfirmDeletePatient(null)}
            />
          )}

          {patients.length === 0 ? (
            <EmptyState message="No hay pacientes registrados. Crea uno nuevo para comenzar." />
          ) : (
            <div className="flex flex-col gap-2">
              {patients.map((p) => (
                <div
                  key={p.id}
                  className="border-border bg-card flex items-center gap-3 rounded-xl border p-4 transition-all hover:border-purple-400 hover:shadow-md"
                >
                  <button
                    onClick={() => setSelectedPatient(p)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-lg dark:bg-purple-900/40">
                      👤
                    </div>
                    <div>
                      <p className="text-foreground font-semibold">{p.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {p.sessions.length} {p.sessions.length === 1 ? 'sesion' : 'sesiones'}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => setConfirmDeletePatient(p.id)}
                    className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    title="Eliminar paciente"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Session list
  const sessionsList = (
    <div className="flex flex-col gap-2">
      {selectedPatient.sessions.length === 0 ? (
        <EmptyState message="No hay sesiones registradas." />
      ) : (
        [...selectedPatient.sessions].reverse().map((s) => (
          <button
            key={s.filename}
            onClick={() => handleViewSession(s.filename)}
            className="group border-border bg-background flex items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-all hover:border-purple-400 hover:shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-xs font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                {s.title.replace('Sesion ', '#')}
              </div>
              <div>
                <p className="text-foreground text-sm font-medium">{s.title}</p>
                <p className="text-muted-foreground text-xs">{s.date}</p>
              </div>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))
      )}
    </div>
  );

  // Tab content map (read mode)
  const tabViewContent: Record<NoteTab, React.ReactNode> = {
    sesiones: sessionsList,
    perfil: selectedPatient.profile ? (
      <MarkdownContent content={selectedPatient.profile} title="Perfil del paciente" />
    ) : (
      <EmptyState message="No hay perfil registrado." />
    ),
    resumen: selectedPatient.generalSummary ? (
      <MarkdownContent content={selectedPatient.generalSummary} title="Resumen general" />
    ) : (
      <EmptyState message="No hay resumen general." />
    ),
    plan: selectedPatient.treatmentPlan ? (
      <MarkdownContent content={selectedPatient.treatmentPlan} title="Plan terapeutico" />
    ) : (
      <EmptyState message="No hay plan terapeutico." />
    ),
    temas: selectedPatient.recurringThemes ? (
      <MarkdownContent content={selectedPatient.recurringThemes} title="Temas recurrentes" />
    ) : (
      <EmptyState message="No hay temas recurrentes registrados." />
    ),
    progreso: selectedPatient.progress ? (
      <MarkdownContent content={selectedPatient.progress} title="Progreso" />
    ) : (
      <EmptyState message="No hay registro de progreso." />
    ),
    agenda: selectedPatient.agenda ? (
      <MarkdownContent content={selectedPatient.agenda} title="Agenda de sesiones" />
    ) : (
      <EmptyState message="No hay agenda definida." />
    ),
  };

  // What to render in the content area
  let contentView: React.ReactNode;

  if (editing) {
    contentView = (
      <MarkdownEditor
        content={editContent}
        onSave={handleSave}
        onCancel={() => setEditing(false)}
      />
    );
  } else if (activeTab === 'sesiones' && viewingSession && sessionContent) {
    contentView = (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => {
              setViewingSession(null);
              setSessionContent(null);
            }}
            className="flex items-center gap-1 text-xs font-medium text-purple-600 transition-colors hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
          >
            <ChevronLeft size={14} />
            Volver a sesiones
          </button>
          <NoteActions
            onEdit={handleStartEdit}
            onDelete={handleRequestDelete}
            onEmailTranscript={() => handleSendEmail('transcript')}
            onEmailHomework={() => handleSendEmail('homework')}
            emailLoading={emailLoading}
          />
        </div>
        {emailMsg && (
          <p
            className={`mb-3 rounded-lg p-2 text-center text-xs ${
              emailMsg.error
                ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
                : 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400'
            }`}
          >
            {emailMsg.text}
          </p>
        )}
        <MarkdownContent content={sessionContent} />
      </div>
    );
  } else if (activeTab !== 'sesiones') {
    const content = getNoteContent();
    contentView = content ? (
      <div>
        <div className="mb-4 flex justify-end">
          <NoteActions onEdit={handleStartEdit} onDelete={handleRequestDelete} />
        </div>
        {tabViewContent[activeTab]}
      </div>
    ) : (
      tabViewContent[activeTab]
    );
  } else {
    contentView = tabViewContent[activeTab];
  }

  return (
    <div className="bg-background fixed inset-0 flex flex-col">
      {/* Confirm dialogs */}
      {confirmDelete && (
        <ConfirmDialog
          message="¿Estas seguro de que quieres borrar esta nota? Esta accion no se puede deshacer."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {confirmDeletePatient && (
        <ConfirmDialog
          message={`¿Eliminar al paciente "${selectedPatient.name}"? Los datos se conservaran como respaldo pero no seran visibles.`}
          onConfirm={handleDeletePatient}
          onCancel={() => setConfirmDeletePatient(null)}
        />
      )}

      {/* Fixed header */}
      <header className="border-border bg-background/95 flex-shrink-0 border-b px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={patients.length > 1 ? () => setSelectedPatient(null) : onBack}
              className="text-muted-foreground hover:bg-muted rounded-lg p-1.5 transition-colors"
              title="Volver"
            >
              <ChevronLeft />
            </button>
            <div>
              <h2 className="text-foreground text-base leading-tight font-bold">
                {selectedPatient.name}
              </h2>
              <p className="text-muted-foreground text-[11px]">
                {selectedPatient.sessions.length} sesiones &middot; Proxima: #
                {selectedPatient.sessionNumber}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onStartSession(selectedPatient.id)}
              className="rounded-full bg-purple-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-purple-700"
            >
              Iniciar sesion
            </button>
            <button
              onClick={() => setConfirmDeletePatient(selectedPatient.id)}
              className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
              title="Eliminar paciente"
            >
              Eliminar
            </button>
            <button
              onClick={onBack}
              className="border-border text-muted-foreground hover:text-foreground rounded-full border px-4 py-1.5 text-xs font-medium transition-colors"
            >
              Inicio
            </button>
          </div>
        </div>
      </header>

      {/* Fixed tabs */}
      <nav className="border-border bg-background flex-shrink-0 border-b px-4 py-2">
        <div className="scrollbar-none mx-auto flex max-w-2xl gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setViewingSession(null);
                setSessionContent(null);
                setEditing(false);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <span className="text-sm">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Scrollable content */}
      <div ref={contentRef} className={`flex-1 overflow-y-auto ${editing ? '' : ''}`}>
        <div className="mx-auto max-w-2xl px-4 py-5 pb-16">{contentView}</div>
      </div>
    </div>
  );
}
