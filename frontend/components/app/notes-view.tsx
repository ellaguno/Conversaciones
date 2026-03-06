'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

type NoteTab =
  | 'sesiones'
  | 'perfil'
  | 'resumen'
  | 'plan'
  | 'temas'
  | 'progreso'
  | 'agenda';

const TABS: { key: NoteTab; label: string; icon: string }[] = [
  { key: 'sesiones', label: 'Sesiones', icon: '📋' },
  { key: 'perfil', label: 'Perfil', icon: '👤' },
  { key: 'resumen', label: 'Resumen', icon: '📝' },
  { key: 'plan', label: 'Plan', icon: '🎯' },
  { key: 'temas', label: 'Temas', icon: '🔄' },
  { key: 'progreso', label: 'Progreso', icon: '📈' },
  { key: 'agenda', label: 'Agenda', icon: '📅' },
];

function MarkdownContent({ content, title }: { content: string; title?: string }) {
  const cleaned = content.replace(/^```markdown\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return (
    <article className="notes-markdown">
      {title && <h2 className="notes-title">{title}</h2>}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 mt-6 text-xl font-bold text-foreground border-b border-border pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-5 text-lg font-bold text-foreground flex items-center gap-2">
              <span className="inline-block h-5 w-1 rounded-full bg-purple-500" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-base font-semibold text-foreground">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-3 text-sm leading-relaxed text-foreground/80">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 ml-1 space-y-1.5 text-sm text-foreground/80">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 ml-1 list-decimal space-y-1.5 pl-4 text-sm text-foreground/80">
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
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          hr: () => <hr className="my-4 border-border" />,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-3 border-purple-400 bg-purple-50 dark:bg-purple-950/20 py-2 pl-4 pr-3 rounded-r-lg text-sm italic text-foreground/70">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
              {children}
            </thead>
          ),
          td: ({ children }) => (
            <td className="border-t border-border px-3 py-2 text-foreground/80">{children}</td>
          ),
          th: ({ children }) => <th className="px-3 py-2 text-left">{children}</th>,
          // Render checkbox-style task items
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
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <div className="mb-3 text-4xl opacity-30">📄</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ChevronLeft({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

interface NotesViewProps {
  onBack: () => void;
  onStartSession: () => void;
}

export function NotesView({ onBack, onStartSession }: NotesViewProps) {
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(null);
  const [activeTab, setActiveTab] = useState<NoteTab>('sesiones');
  const [sessionContent, setSessionContent] = useState<string | null>(null);
  const [viewingSession, setViewingSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/sessions')
      .then((r) => r.json())
      .then((data) => {
        setPatients(data.patients || []);
        if (data.patients?.length === 1) {
          setSelectedPatient(data.patients[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Scroll to top when changing tabs or viewing a session
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [activeTab, viewingSession]);

  const handleViewSession = async (filename: string) => {
    try {
      const res = await fetch(`/api/sessions/${filename}`);
      const data = await res.json();
      setSessionContent(data.content);
      setViewingSession(filename);
    } catch {
      setSessionContent('Error al cargar la nota.');
      setViewingSession(filename);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background text-muted-foreground">
        <p className="text-sm">Cargando...</p>
      </div>
    );
  }

  // Patient list view
  if (!selectedPatient) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-lg px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Pacientes</h2>
            <button
              onClick={onBack}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Volver
            </button>
          </div>

          {patients.length === 0 ? (
            <EmptyState message="No hay pacientes registrados. Inicia una sesion con la Dra. Ana." />
          ) : (
            <div className="flex flex-col gap-2">
              {patients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatient(p)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-purple-400 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40 text-lg">
                    👤
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.sessions.length} {p.sessions.length === 1 ? 'sesion' : 'sesiones'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tab content
  const tabContent: Record<NoteTab, React.ReactNode> = {
    sesiones: (
      <div className="flex flex-col gap-2">
        {selectedPatient.sessions.length === 0 ? (
          <EmptyState message="No hay sesiones registradas." />
        ) : (
          [...selectedPatient.sessions].reverse().map((s) => (
            <button
              key={s.filename}
              onClick={() => handleViewSession(s.filename)}
              className="group flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3.5 text-left transition-all hover:border-purple-400 hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 text-xs font-bold text-purple-700 dark:text-purple-300">
                  {s.title.replace('Sesion ', '#')}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.date}</p>
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
    ),
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

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Fixed header */}
      <header className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={patients.length > 1 ? () => setSelectedPatient(null) : onBack}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              title="Volver"
            >
              <ChevronLeft />
            </button>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">{selectedPatient.name}</h2>
              <p className="text-[11px] text-muted-foreground">
                {selectedPatient.sessions.length} sesiones &middot; Proxima: #{selectedPatient.sessionNumber}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onStartSession}
              className="rounded-full bg-purple-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-purple-700 transition-colors"
            >
              Iniciar sesion
            </button>
            <button
              onClick={onBack}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Inicio
            </button>
          </div>
        </div>
      </header>

      {/* Fixed tabs */}
      <nav className="flex-shrink-0 border-b border-border bg-background px-4 py-2">
        <div className="mx-auto flex max-w-2xl gap-1 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setViewingSession(null);
              }}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
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
      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-5 pb-16">
          {viewingSession && sessionContent ? (
            <div>
              <button
                onClick={() => setViewingSession(null)}
                className="mb-4 flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors"
              >
                <ChevronLeft size={14} />
                Volver a sesiones
              </button>
              <MarkdownContent content={sessionContent} />
            </div>
          ) : (
            tabContent[activeTab]
          )}
        </div>
      </div>
    </div>
  );
}
