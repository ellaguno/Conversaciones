import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SETTINGS_FILE = join(process.cwd(), '..', 'settings.json');

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  fromAddress: string;
  secure: boolean;
}

export interface GoogleOAuthSettings {
  clientId: string;
  clientSecret: string;
}

export interface AppSettings {
  smtp: SmtpSettings;
  googleOAuth: GoogleOAuthSettings;
  analysisModel: string;
  requireApproval: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  smtp: { host: '', port: 587, user: '', password: '', fromAddress: '', secure: false },
  googleOAuth: { clientId: '', clientSecret: '' },
  analysisModel: 'anthropic/claude-opus-4.6',
  requireApproval: true,
};

export function readSettings(): AppSettings {
  if (!existsSync(SETTINGS_FILE)) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const data = JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'));
    return {
      smtp: { ...DEFAULT_SETTINGS.smtp, ...data.smtp },
      googleOAuth: { ...DEFAULT_SETTINGS.googleOAuth, ...data.googleOAuth },
      analysisModel: data.analysisModel || DEFAULT_SETTINGS.analysisModel,
      requireApproval: data.requireApproval ?? DEFAULT_SETTINGS.requireApproval,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings: AppSettings): void {
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

export function isSmtpConfigured(): boolean {
  const s = readSettings().smtp;
  return !!(s.host && s.port && s.user && s.password && s.fromAddress);
}

export function isGoogleOAuthConfigured(): boolean {
  const g = readSettings().googleOAuth;
  return !!(g.clientId && g.clientSecret);
}
