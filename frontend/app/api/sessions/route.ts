import { NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SESSIONS_BASE = join(process.cwd(), '..', 'agent', 'sessions');

export const revalidate = 0;

interface PatientData {
  id: string;
  name: string;
  sessionNumber: number;
  sessions: { filename: string; date: string; title: string }[];
  profile: string | null;
  generalSummary: string | null;
  agenda: string | null;
  treatmentPlan: string | null;
  recurringThemes: string | null;
  progress: string | null;
}

function readPatient(patientDir: string, patientId: string): PatientData {
  const result: PatientData = {
    id: patientId,
    name: patientId,
    sessionNumber: 1,
    sessions: [],
    profile: null,
    generalSummary: null,
    agenda: null,
    treatmentPlan: null,
    recurringThemes: null,
    progress: null,
  };

  // Read profile
  const profilePath = join(patientDir, 'perfil.md');
  if (existsSync(profilePath)) {
    result.profile = readFileSync(profilePath, 'utf-8');
    const nameMatch = result.profile.match(/Nombre:\s*\*{0,2}\s*(.+?)(?:\n|\(|\*)/);
    if (nameMatch) {
      result.name = nameMatch[1].trim();
    }
  }

  // Read general summary
  const summaryPath = join(patientDir, 'resumen_general.md');
  if (existsSync(summaryPath)) {
    result.generalSummary = readFileSync(summaryPath, 'utf-8');
  }

  // Read agenda
  const agendaPath = join(patientDir, 'agenda.md');
  if (existsSync(agendaPath)) {
    result.agenda = readFileSync(agendaPath, 'utf-8');
  }

  // Read treatment plan
  const planPath = join(patientDir, 'conclusiones', 'plan_terapeutico.md');
  if (existsSync(planPath)) {
    result.treatmentPlan = readFileSync(planPath, 'utf-8');
  }

  // Read recurring themes
  const themesPath = join(patientDir, 'conclusiones', 'temas_recurrentes.md');
  if (existsSync(themesPath)) {
    result.recurringThemes = readFileSync(themesPath, 'utf-8');
  }

  // Read progress
  const progressPath = join(patientDir, 'conclusiones', 'progreso.md');
  if (existsSync(progressPath)) {
    result.progress = readFileSync(progressPath, 'utf-8');
  }

  // Read session list
  const sesionesDir = join(patientDir, 'sesiones');
  if (existsSync(sesionesDir)) {
    const files = readdirSync(sesionesDir)
      .filter((f) => f.endsWith('.md'))
      .sort();
    result.sessionNumber = files.length + 1;
    result.sessions = files.map((f) => {
      const match = f.match(/(\d{4}-\d{2}-\d{2})_sesion_(\d+)/);
      return {
        filename: f,
        date: match ? match[1] : '',
        title: `Sesion ${match ? parseInt(match[2]) : '?'}`,
      };
    });
  }

  return result;
}

export async function GET() {
  try {
    if (!existsSync(SESSIONS_BASE)) {
      return NextResponse.json({ patients: [] });
    }

    const dirs = readdirSync(SESSIONS_BASE).filter((d) => {
      const full = join(SESSIONS_BASE, d);
      try {
        return readdirSync(full).length > 0;
      } catch {
        return false;
      }
    });

    const patients = dirs.map((d) => readPatient(join(SESSIONS_BASE, d), d));

    return NextResponse.json({ patients });
  } catch (error) {
    console.error('Error reading sessions:', error);
    return NextResponse.json({ patients: [] });
  }
}
