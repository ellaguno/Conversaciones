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
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'user' | 'admin'>('user');
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.status === 403) {
        router.push('/');
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
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

  if (status === 'loading' || loading) {
    return (
      <div className="bg-background flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground text-sm">Cargando...</p>
      </div>
    );
  }

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
                <th className="text-muted-foreground px-4 py-3 text-right text-xs font-semibold uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
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
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="rounded bg-green-600 px-2 py-1 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {saving ? '...' : 'Guardar'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <span className="text-foreground font-mono text-sm">{user.username}</span>
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
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.displayName)}
                            className="text-muted-foreground rounded px-2 py-1 text-xs transition-colors hover:text-red-500"
                          >
                            Eliminar
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
