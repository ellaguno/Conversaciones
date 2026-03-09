import { compareSync, hashSync } from 'bcryptjs';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ensureUserDirs } from './data-paths';

const USERS_FILE = join(process.cwd(), '..', 'users.json');
const BCRYPT_ROUNDS = 10;

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export type UserPublic = Omit<UserRecord, 'passwordHash'>;

function readUsers(): UserRecord[] {
  if (!existsSync(USERS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(USERS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeUsers(users: UserRecord[]): void {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

/**
 * Initialize users.json with a seed admin if it doesn't exist.
 * Migrates from auth-config.json / env vars for backward compatibility.
 */
export function initUsersIfNeeded(): void {
  if (existsSync(USERS_FILE)) {
    const users = readUsers();
    if (users.length > 0) return;
  }

  // Read existing password from auth-config.json or env
  let adminPassword = process.env.AUTH_ADMIN_PASSWORD || 'admin';
  const authConfigFile = join(process.cwd(), '..', 'auth-config.json');
  if (existsSync(authConfigFile)) {
    try {
      const data = JSON.parse(readFileSync(authConfigFile, 'utf-8'));
      if (data.password) adminPassword = data.password;
    } catch {}
  }

  const adminUser: UserRecord = {
    id: 'admin',
    username: process.env.AUTH_ADMIN_USER || 'admin',
    passwordHash: hashSync(adminPassword, BCRYPT_ROUNDS),
    displayName: 'Administrador',
    role: 'admin',
    createdAt: new Date().toISOString(),
  };

  writeUsers([adminUser]);
  ensureUserDirs('admin');
}

export function getUsers(): UserPublic[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return readUsers().map(({ passwordHash, ...rest }) => rest);
}

export function getUserById(id: string): UserRecord | undefined {
  return readUsers().find((u) => u.id === id);
}

export function getUserByUsername(username: string): UserRecord | undefined {
  return readUsers().find((u) => u.username === username);
}

export function verifyPassword(plaintext: string, hash: string): boolean {
  return compareSync(plaintext, hash);
}

export function createUser(data: {
  username: string;
  password: string;
  displayName: string;
  role?: 'admin' | 'user';
}): UserPublic {
  const users = readUsers();

  // Check uniqueness
  if (users.some((u) => u.username === data.username)) {
    throw new Error('El nombre de usuario ya existe');
  }

  // Generate id from username (slug)
  const id = data.username
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');
  if (!id) throw new Error('Nombre de usuario invalido');
  if (users.some((u) => u.id === id)) {
    throw new Error('El ID de usuario ya existe');
  }

  const newUser: UserRecord = {
    id,
    username: data.username,
    passwordHash: hashSync(data.password, BCRYPT_ROUNDS),
    displayName: data.displayName,
    role: data.role || 'user',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeUsers(users);
  ensureUserDirs(id);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...publicUser } = newUser;
  return publicUser;
}

export function updateUser(
  id: string,
  data: { displayName?: string; password?: string; role?: 'admin' | 'user' }
): void {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error('Usuario no encontrado');

  if (data.displayName !== undefined) {
    users[idx].displayName = data.displayName;
  }
  if (data.password) {
    users[idx].passwordHash = hashSync(data.password, BCRYPT_ROUNDS);
  }
  if (data.role !== undefined) {
    // Prevent removing the last admin
    if (users[idx].role === 'admin' && data.role !== 'admin') {
      const adminCount = users.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        throw new Error('No se puede quitar el rol de admin al ultimo administrador');
      }
    }
    users[idx].role = data.role;
  }

  writeUsers(users);
}

export function deleteUser(id: string): void {
  const users = readUsers();
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error('Usuario no encontrado');

  // Prevent deleting the last admin
  if (user.role === 'admin') {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1) {
      throw new Error('No se puede eliminar al ultimo administrador');
    }
  }

  // Soft-delete: rename data directory
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  const dataDir = join(process.cwd(), '..', 'data', safeId);
  const deletedDir = join(process.cwd(), '..', 'data', `${safeId}_deleted_${Date.now()}`);
  if (existsSync(dataDir)) {
    renameSync(dataDir, deletedDir);
  }

  const filtered = users.filter((u) => u.id !== id);
  writeUsers(filtered);
}
