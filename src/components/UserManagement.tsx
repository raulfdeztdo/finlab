'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, Edit2, X, Check, Shield, User, Loader2, Mail } from 'lucide-react';

interface UserData {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

interface UserManagementProps {
  currentUser: { id: number; username: string; role: string };
  onClose: () => void;
}

export default function UserManagement({ currentUser, onClose }: UserManagementProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Create form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');

  // Edit form
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch {
      setError('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, email: newEmail, role: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setNewUsername('');
        setNewPassword('');
        setNewEmail('');
        setNewRole('user');
        fetchUsers();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Error de conexión');
    }
  };

  const handleUpdate = async (id: number) => {
    setError('');
    try {
      const body: Record<string, unknown> = { id };
      if (editUsername) body.username = editUsername;
      if (editPassword) body.password = editPassword;
      if (editRole) body.role = editRole;
      body.email = editEmail;

      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setEditingId(null);
        fetchUsers();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Error de conexión');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Error de conexión');
    }
  };

  const startEdit = (user: UserData) => {
    setEditingId(user.id);
    setEditUsername(user.username);
    setEditPassword('');
    setEditEmail(user.email || '');
    setEditRole(user.role);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 rounded-xl bg-card border border-card-border overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-blue" />
            <h2 className="text-lg font-bold">Gestión de Usuarios</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted-bg transition-colors">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-accent-blue" />
            </div>
          ) : (
            <div className="space-y-2">
              {users.map(user => (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted-bg/50 border border-card-border">
                  {editingId === user.id ? (
                    // Edit mode
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editUsername}
                          onChange={e => setEditUsername(e.target.value)}
                          className="flex-1 bg-background border border-card-border rounded px-3 py-1.5 text-sm"
                          placeholder="Usuario"
                        />
                        <input
                          type="password"
                          value={editPassword}
                          onChange={e => setEditPassword(e.target.value)}
                          className="flex-1 bg-background border border-card-border rounded px-3 py-1.5 text-sm"
                          placeholder="Nueva contraseña (vacío = no cambiar)"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={editEmail}
                          onChange={e => setEditEmail(e.target.value)}
                          className="flex-1 bg-background border border-card-border rounded px-3 py-1.5 text-sm"
                          placeholder="Email"
                        />
                        <select
                          value={editRole}
                          onChange={e => setEditRole(e.target.value as 'admin' | 'user')}
                          className="bg-background border border-card-border rounded px-3 py-1.5 text-sm"
                        >
                          <option value="user">Usuario</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(user.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-accent-green/20 text-accent-green rounded text-xs hover:bg-accent-green/30"
                        >
                          <Check className="w-3 h-3" /> Guardar
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 px-3 py-1 bg-muted-bg text-muted rounded text-xs hover:text-foreground"
                        >
                          <X className="w-3 h-3" /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="flex-1 flex items-center gap-3">
                        {user.role === 'admin' ? (
                          <Shield className="w-4 h-4 text-accent-yellow" />
                        ) : (
                          <User className="w-4 h-4 text-muted" />
                        )}
                        <div className="flex flex-col">
                          <div>
                            <span className="text-sm font-medium">{user.username}</span>
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                              user.role === 'admin'
                                ? 'bg-accent-yellow/20 text-accent-yellow'
                                : 'bg-muted-bg text-muted'
                            }`}>
                              {user.role}
                            </span>
                          </div>
                          {user.email && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-muted" />
                              <span className="text-xs text-muted">{user.email}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted ml-auto">
                          {new Date(user.created_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEdit(user)}
                          className="p-1.5 rounded hover:bg-muted-bg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-muted hover:text-foreground" />
                        </button>
                        {user.id !== currentUser.id && (
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="p-1.5 rounded hover:bg-accent-red/10 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted hover:text-accent-red" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Create new user */}
          {showCreate ? (
            <div className="p-4 rounded-lg border border-accent-blue/30 bg-accent-blue/5 space-y-3">
              <h4 className="text-sm font-medium text-accent-blue">Nuevo Usuario</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="flex-1 bg-background border border-card-border rounded px-3 py-1.5 text-sm"
                  placeholder="Usuario"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="flex-1 bg-background border border-card-border rounded px-3 py-1.5 text-sm"
                  placeholder="Contraseña"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="flex-1 bg-background border border-card-border rounded px-3 py-1.5 text-sm"
                  placeholder="Email (opcional)"
                />
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as 'admin' | 'user')}
                  className="bg-background border border-card-border rounded px-3 py-1.5 text-sm"
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!newUsername || !newPassword}
                  className="flex items-center gap-1 px-4 py-1.5 bg-accent-blue text-white rounded text-xs hover:bg-accent-blue/80 disabled:opacity-50"
                >
                  <Check className="w-3 h-3" /> Crear
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex items-center gap-1 px-4 py-1.5 bg-muted-bg text-muted rounded text-xs hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-card-border text-sm text-muted hover:text-foreground hover:border-accent-blue transition-colors w-full justify-center"
            >
              <Plus className="w-4 h-4" />
              Añadir Usuario
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
