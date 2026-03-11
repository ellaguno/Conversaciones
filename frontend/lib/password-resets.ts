import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const RESETS_FILE = join(process.cwd(), '..', 'password-resets.json');
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

interface ResetToken {
  userId: string;
  token: string;
  expiresAt: string;
}

function readTokens(): ResetToken[] {
  if (!existsSync(RESETS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(RESETS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeTokens(tokens: ResetToken[]): void {
  writeFileSync(RESETS_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
}

export function createResetToken(userId: string): string {
  const tokens = readTokens().filter((t) => new Date(t.expiresAt) > new Date());
  // Remove existing tokens for this user
  const filtered = tokens.filter((t) => t.userId !== userId);
  const token = randomUUID();
  filtered.push({
    userId,
    token,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
  });
  writeTokens(filtered);
  return token;
}

export function validateAndConsumeToken(token: string): string | null {
  const tokens = readTokens();
  const idx = tokens.findIndex((t) => t.token === token && new Date(t.expiresAt) > new Date());
  if (idx === -1) return null;
  const userId = tokens[idx].userId;
  tokens.splice(idx, 1);
  writeTokens(tokens);
  return userId;
}
