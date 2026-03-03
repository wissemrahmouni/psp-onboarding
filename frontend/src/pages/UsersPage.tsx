import { useEffect, useState } from 'react';
import { apiRequest } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types/auth';

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  bankId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  bank?: { id: string; name: string; code: string } | null;
}

interface BankOption {
  id: string;
  name: string;
  code: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  SUPPORT: 'Support',
  BANQUE: 'Banque',
  PAYFAC: 'PayFac',
};

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loading, setLoading] = useState(true);
  const allowedRoles: UserRole[] = currentUser?.role === 'SUPER_ADMIN'
    ? ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'BANQUE', 'PAYFAC']
    : ['SUPPORT', 'BANQUE', 'PAYFAC'];
  const canModify = (u: UserRow) =>
    currentUser?.role === 'SUPER_ADMIN' || (currentUser?.role === 'ADMIN' && u.role !== 'SUPER_ADMIN' && u.role !== 'ADMIN');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'SUPPORT' as UserRole,
    isActive: true,
    bankId: '' as string,
  });
  const [error, setError] = useState('');

  const loadUsers = () => {
    apiRequest<UserRow[]>('/api/users').then(setUsers).catch(() => setUsers([]));
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiRequest<UserRow[]>('/api/users'),
      apiRequest<BankOption[]>('/api/users/banks'),
    ])
      .then(([u, b]) => {
        setUsers(u);
        setBanks(b);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'SUPPORT',
      isActive: true,
      bankId: '',
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setEditingId(u.id);
    setForm({
      email: u.email,
      password: '',
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      isActive: u.isActive,
      bankId: u.bankId || '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      role: form.role,
      isActive: form.isActive,
      bankId: form.role === 'BANQUE' ? (form.bankId || null) : null,
    };
    if (editingId) {
      if (form.password.trim()) (payload as Record<string, unknown>).password = form.password.trim();
      apiRequest<UserRow>(`/api/users/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        .then(() => {
          loadUsers();
          setModalOpen(false);
        })
        .catch((err: { message?: string }) => setError(err?.message || 'Erreur lors de la mise à jour'))
        .finally(() => setSaving(false));
    } else {
      if (form.password.trim().length < 8) {
        setError('Le mot de passe doit contenir au moins 8 caractères');
        setSaving(false);
        return;
      }
      (payload as Record<string, unknown>).password = form.password.trim();
      apiRequest<UserRow>('/api/users', { method: 'POST', body: JSON.stringify(payload) })
        .then(() => {
          loadUsers();
          setModalOpen(false);
        })
        .catch((err: { message?: string }) => setError(err?.message || 'Erreur lors de la création'))
        .finally(() => setSaving(false));
    }
  };

  const handleDelete = (u: UserRow) => {
    setDeleteConfirm(u);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    setSaving(true);
    apiRequest(`/api/users/${deleteConfirm.id}`, { method: 'DELETE' })
      .then(() => {
        loadUsers();
        setDeleteConfirm(null);
      })
      .catch(() => setDeleteConfirm(null))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Utilisateurs</h1>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Ajouter un utilisateur
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Banque</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actif</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dernière connexion</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{u.email}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{u.firstName} {u.lastName}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{ROLE_LABELS[u.role]}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{u.bank ? `${u.bank.name} (${u.bank.code})` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {u.isActive ? 'Oui' : 'Non'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('fr-FR') : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {canModify(u) ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="text-blue-600 hover:underline text-sm mr-3"
                      >
                        Modifier
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          type="button"
                          onClick={() => handleDelete(u)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Supprimer
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-400 text-sm">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="p-6 text-center text-gray-500">Aucun utilisateur.</p>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editingId ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  disabled={!!editingId}
                />
                {editingId && <p className="text-xs text-gray-500 mt-1">L'email ne peut pas être modifié.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe {editingId && '(laisser vide pour ne pas changer)'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder={editingId ? '••••••••' : 'Min. 8 caractères'}
                  minLength={editingId ? 0 : 8}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {allowedRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              {form.role === 'BANQUE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banque</label>
                  <select
                    value={form.bankId}
                    onChange={(e) => setForm((f) => ({ ...f, bankId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">— Aucune —</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">Compte actif</label>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : (editingId ? 'Enregistrer' : 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Supprimer l'utilisateur</h3>
            <p className="text-gray-600 mb-4">
              Êtes-vous sûr de vouloir supprimer <strong>{deleteConfirm.firstName} {deleteConfirm.lastName}</strong> ({deleteConfirm.email}) ? Cette action est irréversible.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
              >
                {saving ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
