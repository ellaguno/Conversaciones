'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface UserPublic {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  createdAt: string;
  email?: string;
  status?: 'active' | 'pending' | 'rejected';
  lastActive?: string;
  lastUsage?: string;
}

interface GuestUser {
  id: string;
  ip: string;
  lastUsage: string | null;
  totalCost: number;
  conversations: number;
}

function formatRelativeTime(isoDate?: string | null): string {
  if (!isoDate) return 'Nunca';
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Justo ahora';
  if (diffMin < 60) return `Hace ${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `Hace ${diffDays}d`;
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

type FilterTab = 'all' | 'pending' | 'active';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [guests, setGuests] = useState<GuestUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'user' | 'admin'>('user');
  const [saving, setSaving] = useState(false);

  // Approve/reject loading
  const [approving, setApproving] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.status === 403) {
        router.push('/');
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
      setGuests(data.guests || []);
    } catch {
      setError('Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
      router.push('/');
      return;
    }
    fetchUsers();
  }, [session, status, router, fetchUsers]);

  const handleCreate = async () => {
    setError('');
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          displayName: newDisplayName,
          role: newRole,
          email: newEmail || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error');
      } else {
        setShowCreate(false);
        setNewUsername('');
        setNewPassword('');
        setNewDisplayName('');
        setNewEmail('');
        setNewRole('user');
        fetchUsers();
      }
    } catch {
      setError('Error de conexion');
    }
    setCreating(false);
  };

  const handleEdit = (user: UserPublic) => {
    setEditingId(user.id);
    setEditDisplayName(user.displayName);
    setEditPassword('');
    setEditRole(user.role);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          displayName: editDisplayName,
          ...(editPassword && { password: editPassword }),
          role: editRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error');
      } else {
        setEditingId(null);
        fetchUsers();
      }
    } catch {
      setError('Error de conexion');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, displayName: string) => {
    if (!confirm(`Eliminar usuario "${displayName}"? Sus datos se conservaran como respaldo.`))
      return;
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error');
      } else {
        fetchUsers();
      }
    } catch {
      setError('Error de conexion');
    }
  };

  const handleApprove = async (userId: string, action: 'approve' | 'reject') => {
    setApproving(userId);
    setError('');
    try {
      const res = await fetch('/api/admin/users/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error');
      } else {
        fetchUsers();
      }
    } catch {
      setError('Error de conexion');
    }
    setApproving(null);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="bg-background flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground text-sm">Cargando...</p>
      </div>
    );
  }

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const filteredUsers =
    filter === 'pending'
      ? pendingUsers
      : filter === 'active'
        ? users.filter((u) => (u.status || 'active') === 'active')
        : users;

  return (
    <div className="bg-background flex min-h-svh flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-foreground text-xl font-bold">Administrar usuarios</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/')}
            className="rounded-full text-xs"
          >
            Volver
          </Button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-2 text-center text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </p>
        )}

        {/* Pending users alert */}
        {pendingUsers.length > 0 && (
          <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
            <h2 className="text-foreground mb-3 text-sm font-bold">
              Solicitudes pendientes ({pendingUsers.length})
            </h2>
            <div className="space-y-2">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="border-border bg-background flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-foreground text-sm font-medium">{user.displayName}</p>
                    <p className="text-muted-foreground text-xs">
                      @{user.username} {user.email && `· ${user.email}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleApprove(user.id, 'approve')}
                      disabled={approving === user.id}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {approving === user.id ? '...' : 'Aprobar'}
                    </button>
                    <button
                      onClick={() => handleApprove(user.id, 'reject')}
                      disabled={approving === user.id}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="mb-4 flex gap-1.5">
          {(['all', 'active', 'pending'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                filter === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'all' ? 'Todos' : tab === 'active' ? 'Activos' : 'Pendientes'}
              {tab === 'pending' && pendingUsers.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingUsers.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Users table */}
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-border border-b">
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold uppercase">
                  Usuario
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold uppercase">
                  Nombre
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold uppercase">
                  Rol
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold uppercase">
                  Estado
                </th>
                <th className="text-muted-foreground hidden px-4 py-3 text-left text-xs font-semibold uppercase sm:table-cell">
                  Login
                </th>
                <th className="text-muted-foreground hidden px-4 py-3 text-left text-xs font-semibold uppercase sm:table-cell">
                  Ultimo uso
                </th>
                <th className="text-muted-foreground px-4 py-3 text-right text-xs font-semibold uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-border border-b last:border-0">
                  {editingId === user.id ? (
                    <>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground font-mono text-sm">
                          {user.username}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          className="border-border bg-background text-foreground w-full rounded border px-2 py-1 text-sm focus:outline-none"
                        />
                        <input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Nueva contraseña (dejar vacio para no cambiar)"
                          className="border-border bg-background text-foreground placeholder:text-muted-foreground mt-1 w-full rounded border px-2 py-1 text-xs focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as 'admin' | 'user')}
                          className="border-border bg-background text-foreground rounded border px-2 py-1 text-sm focus:outline-none"
                        >
                          <option value="user">Usuario</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3" />
                      <td className="hidden px-4 py-3 sm:table-cell" />
                      <td className="hidden px-4 py-3 sm:table-cell" />
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            title="Guardar"
                            className="rounded p-1.5 text-green-600 transition-colors hover:text-green-700 disabled:opacity-50"
                          >
                            {saving ? (
                              <span className="text-xs">...</span>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-4 w-4"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            title="Cancelar"
                            className="text-muted-foreground hover:text-foreground rounded p-1.5 transition-colors"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-4 w-4"
                            >
                              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <span className="text-foreground font-mono text-sm">{user.username}</span>
                        {user.email && (
                          <p className="text-muted-foreground text-[10px]">{user.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-foreground text-sm">{user.displayName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            user.role === 'admin'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            (user.status || 'active') === 'active'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : (user.status || 'active') === 'pending'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {(user.status || 'active') === 'active'
                            ? 'Activo'
                            : user.status === 'pending'
                              ? 'Pendiente'
                              : 'Rechazado'}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className="text-muted-foreground text-xs">
                          {formatRelativeTime(user.lastActive)}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className="text-muted-foreground text-xs">
                          {formatRelativeTime(user.lastUsage)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {user.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(user.id, 'approve')}
                                className="rounded bg-green-600 px-2 py-1 text-xs font-bold text-white hover:bg-green-700"
                              >
                                Aprobar
                              </button>
                              <button
                                onClick={() => handleApprove(user.id, 'reject')}
                                className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleEdit(user)}
                            title="Editar"
                            className="text-muted-foreground hover:text-foreground rounded p-1.5 transition-colors"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-4 w-4"
                            >
                              <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.displayName)}
                            title="Eliminar"
                            className="text-muted-foreground rounded p-1.5 transition-colors hover:text-red-500"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-4 w-4"
                            >
                              <path
                                fillRule="evenodd"
                                d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Guest users section */}
        {guests.length > 0 && (
          <div className="border-border bg-card mt-4 overflow-hidden rounded-xl border">
            <div className="border-border border-b px-4 py-3">
              <h2 className="text-foreground text-sm font-bold">
                Usuarios sin cuenta ({guests.length})
              </h2>
              <p className="text-muted-foreground text-[10px]">
                Visitantes que usaron la app sin registrarse
              </p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-border border-b">
                  <th className="text-muted-foreground px-4 py-2 text-left text-xs font-semibold uppercase">
                    IP
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-left text-xs font-semibold uppercase">
                    Ultimo uso
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-right text-xs font-semibold uppercase">
                    Llamadas
                  </th>
                  <th className="text-muted-foreground px-4 py-2 text-right text-xs font-semibold uppercase">
                    Costo
                  </th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => (
                  <tr key={g.id} className="border-border border-b last:border-0">
                    <td className="px-4 py-2">
                      <span className="text-foreground font-mono text-xs">{g.ip}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-muted-foreground text-xs">
                        {formatRelativeTime(g.lastUsage)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-muted-foreground text-xs">{g.conversations}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-muted-foreground font-mono text-xs">
                        ${g.totalCost.toFixed(4)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create user form */}
        {showCreate ? (
          <div className="border-border bg-card mt-4 rounded-xl border p-5">
            <h2 className="text-foreground mb-4 text-sm font-bold">Nuevo usuario</h2>
            <div className="space-y-3">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Nombre de usuario (3-30 chars, alfanumerico)"
                className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              />
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Nombre para mostrar"
                className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Correo electronico (opcional)"
                className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Contraseña (minimo 6 caracteres)"
                className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                className="border-border bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              >
                <option value="user">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreate}
                  disabled={creating || !newUsername || !newPassword || !newDisplayName}
                  className="rounded-full font-mono text-xs font-bold uppercase"
                >
                  {creating ? 'Creando...' : 'Crear usuario'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                  className="rounded-full text-xs"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setShowCreate(true)}
            className="mt-4 w-full rounded-full font-mono text-xs font-bold uppercase"
          >
            + Nuevo usuario
          </Button>
        )}
      </div>
    </div>
  );
}
