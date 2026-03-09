import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const PROJECT_ROOT = join(process.cwd(), '..');
const DATA_DIR = join(PROJECT_ROOT, 'data');

function sanitizeId(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return safe || 'default';
}

export function getUserDataDir(userId: string): string {
  const safe = sanitizeId(userId);
  const dir = join(DATA_DIR, safe);
  // Verify resolved path stays within DATA_DIR
  if (!resolve(dir).startsWith(resolve(DATA_DIR))) {
    throw new Error('Invalid user ID');
  }
  return dir;
}

export function getUserSessionsDir(userId: string): string {
  return join(getUserDataDir(userId), 'sessions');
}

export function getUserConversationsDir(userId: string): string {
  return join(getUserDataDir(userId), 'conversations');
}

export function getUserMetricsFile(userId: string): string {
  return join(getUserDataDir(userId), 'metrics.json');
}

export function ensureUserDirs(userId: string): void {
  const dirs = [
    getUserDataDir(userId),
    getUserSessionsDir(userId),
    getUserConversationsDir(userId),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export function isPathSafeForUser(filePath: string, userId: string): boolean {
  return resolve(filePath).startsWith(resolve(getUserDataDir(userId)));
}
