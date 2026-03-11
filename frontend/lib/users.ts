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
  email?: string;
  status?: 'active' | 'pending' | 'rejected';
  googleId?: string;
  lastActive?: string;
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
    status: 'active',
  };

  writeUsers([adminUser]);
  ensureUserDirs('admin');
}

export function getUsers(): UserPublic[] {
  return readUsers().map(({ passwordHash, ...rest }) => rest);
}

export function getUserById(id: string): UserRecord | undefined {
  return readUsers().find((u) => u.id === id);
}

export function getUserByUsername(username: string): UserRecord | undefined {
  return readUsers().find((u) => u.username === username);
}

export function getUserByEmail(email: string): UserRecord | undefined {
  if (!email) return undefined;
  return readUsers().find((u) => u.email === email);
}

export function getUserByGoogleId(googleId: string): UserRecord | undefined {
  if (!googleId) return undefined;
  return readUsers().find((u) => u.googleId === googleId);
}

export function verifyPassword(plaintext: string, hash: string): boolean {
  return compareSync(plaintext, hash);
}

export function createUser(data: {
  username: string;
  password: string;
  displayName: string;
  role?: 'admin' | 'user';
  email?: string;
  status?: 'active' | 'pending' | 'rejected';
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
    status: data.status || 'active',
    ...(data.email && { email: data.email }),
  };

  users.push(newUser);
  writeUsers(users);
  if (data.status !== 'pending') {
    ensureUserDirs(id);
  }

  const { passwordHash, ...publicUser } = newUser;
  return publicUser;
}

export function updateUser(
  id: string,
  data: { displayName?: string; password?: string; role?: 'admin' | 'user'; email?: string }
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
  if (data.email !== undefined) {
    users[idx].email = data.email || undefined;
  }

  writeUsers(users);
}

export function updateUserStatus(id: string, status: 'active' | 'pending' | 'rejected'): void {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error('Usuario no encontrado');

  users[idx].status = status;
  writeUsers(users);

  // Create user directories when approved
  if (status === 'active') {
    ensureUserDirs(id);
  }
}

export function createOrLinkGoogleUser(profile: {
  googleId: string;
  email: string;
  name: string;
}): UserRecord {
  const users = readUsers();

  // Check by googleId first
  const byGoogleId = users.find((u) => u.googleId === profile.googleId);
  if (byGoogleId) return byGoogleId;

  // Check by email
  const byEmail = users.find((u) => u.email === profile.email);
  if (byEmail) {
    // Link Google account to existing user
    byEmail.googleId = profile.googleId;
    writeUsers(users);
    return byEmail;
  }

  // Create new user with pending status
  const id = profile.email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 30);

  // Ensure unique id
  let uniqueId = id;
  let counter = 1;
  while (users.some((u) => u.id === uniqueId)) {
    uniqueId = `${id}_${counter}`;
    counter++;
  }

  const newUser: UserRecord = {
    id: uniqueId,
    username: uniqueId,
    passwordHash: '',
    displayName: profile.name,
    role: 'user',
    createdAt: new Date().toISOString(),
    email: profile.email,
    status: 'pending',
    googleId: profile.googleId,
  };

  users.push(newUser);
  writeUsers(users);
  return newUser;
}

export function updateLastActive(id: string): void {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx !== -1) {
    users[idx].lastActive = new Date().toISOString();
    writeUsers(users);
  }
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
