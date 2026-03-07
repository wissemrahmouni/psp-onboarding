import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest, fetchWithAuth } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';

interface AffiliateRow {
  id: string;
  merchant_code: string;
  company_name: string;
  trade_name: string | null;
  city: string | null;
  country: string | null;
  status: string;
  createdAt: string;
  bank: { id: string; name: string; code: string } | null;
}

interface ListResponse {
  data: AffiliateRow[];
  total: number;
  page: number;
  totalPages: number;
}

export function AffiliatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [res, setRes] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [purgeModal, setPurgeModal] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; affiliate: AffiliateRow | null }>({ open: false, affiliate: null });
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const { hasAnyRole } = useAuth();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';

  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    apiRequest<ListResponse>(`/api/affiliates?${params}`)
      .then(setRes)
      .catch(() => setRes(null))
      .finally(() => setLoading(false));
  }, [page, status, search]);

  const downloadExport = (format: 'csv' | 'xlsx') => {
    const url = `/api/affiliates/export?format=${format}${status ? `&status=${status}` : ''}`;
    fetchWithAuth(url)
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `affilies.${format}`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  };

  const setFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value);
    else p.delete(key);
    p.delete('page');
    setSearchParams(p);
  };

  const confirmPurge = () => {
    setPurgeError(null);
    setPurgeSuccess(null);
    setPurging(true);
    apiRequest<{ deleted: number; message: string }>('/api/affiliates/purge', { method: 'DELETE' })
      .then((data) => {
        setPurgeModal(false);
        setPurgeSuccess(data.message || `${data.deleted} marchand(s) supprimé(s).`);
        setSearchParams(new URLSearchParams());
        return apiRequest<ListResponse>('/api/affiliates');
      })
      .then(setRes)
      .catch((err: { message?: string }) => {
        setPurgeError(err?.message || 'Erreur lors de la purge. Vérifiez la console réseau (F12).');
      })
      .finally(() => setPurging(false));
  };

  const confirmDelete = () => {
    if (!deleteModal.affiliate) return;
    setDeleteError(null);
    setDeleteSuccess(null);
    setDeleting(true);
    apiRequest<{ message: string }>(`/api/affiliates/${deleteModal.affiliate.id}`, { method: 'DELETE' })
      .then((data) => {
        setDeleteModal({ open: false, affiliate: null });
        setDeleteSuccess(data.message || 'Affilié supprimé avec succès.');
        return apiRequest<ListResponse>(`/api/affiliates?${searchParams.toString()}`);
      })
      .then(setRes)
      .catch((err: { message?: string }) => {
        setDeleteError(err?.message || 'Erreur lors de la suppression. Vérifiez la console réseau (F12).');
      })
      .finally(() => setDeleting(false));
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Affiliés</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadExport('csv')}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Exporter CSV
          </button>
          <button
            type="button"
            onClick={() => downloadExport('xlsx')}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Exporter Excel
          </button>
          {hasAnyRole(['SUPER_ADMIN', 'ADMIN', 'SUPPORT']) && (
            <>
              <Link
                to="/import"
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Importer Excel
              </Link>
              <Link
                to="/affiliates/new"
                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Nouveau marchand
              </Link>
            </>
          )}
          {hasAnyRole(['SUPER_ADMIN', 'ADMIN']) && (
            <button
              type="button"
              onClick={() => setPurgeModal(true)}
              className="inline-flex items-center px-3 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50"
            >
              Purger les marchands
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        <input
          type="text"
          placeholder="Recherche (code ou raison sociale)"
          value={search}
          onChange={(e) => setFilter('search', e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 w-64"
        />
        <select
          value={status}
          onChange={(e) => setFilter('status', e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2"
        >
          <option value="">Tous les statuts</option>
          <option value="CREATED_MERCHANT_MGT">Créé</option>
          <option value="AFFILIATION_CREATED">Affiliation créée</option>
          <option value="TEST_PARAMS_SENT">Param. test envoyés</option>
          <option value="TESTS_VALIDATED">Tests validés</option>
          <option value="PROD_PARAMS_SENT">Param. prod envoyés</option>
          <option value="IN_PRODUCTION">En production</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : res ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raison sociale</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Banque</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ville</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Créé le</th>
                    {hasAnyRole(['SUPER_ADMIN', 'ADMIN', 'SUPPORT']) && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {res.data.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/affiliates/${a.id}`} className="text-blue-600 hover:underline font-medium">
                          {a.merchant_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-800">{a.company_name}</td>
                      <td className="px-4 py-3 text-gray-600">{a.bank?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{a.city ?? '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
                        {new Date(a.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      {hasAnyRole(['SUPER_ADMIN', 'ADMIN', 'SUPPORT']) && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteModal({ open: true, affiliate: a })}
                            className="text-red-600 hover:text-red-800 hover:underline text-sm font-medium"
                            title="Supprimer cet affilié"
                          >
                            Supprimer
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {res.total} affilié{res.total !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set('page', String(page - 1));
                    setSearchParams(next);
                  }}
                  className="px-3 py-1 rounded border disabled:opacity-50"
                >
                  Précédent
                </button>
                <span className="px-3 py-1 text-sm">
                  Page {page} / {res.totalPages || 1}
                </span>
                <button
                  type="button"
                  disabled={page >= res.totalPages}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set('page', String(page + 1));
                    setSearchParams(next);
                  }}
                  className="px-3 py-1 rounded border disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-gray-500">Aucune donnée</div>
        )}
      </div>

      {purgeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-red-700 mb-2">Purger tous les marchands</h3>
            <p className="text-gray-600 mb-4">
              Cette action supprime <strong>définitivement</strong> tous les marchands (affiliés), leurs historiques et validations. Elle est irréversible. Confirmer ?
            </p>
            {purgeError && (
              <p className="mb-4 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{purgeError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setPurgeModal(false); setPurgeError(null); }}
                disabled={purging}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmPurge}
                disabled={purging}
                className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
              >
                {purging ? 'Suppression...' : 'Purger tous les marchands'}
              </button>
            </div>
          </div>
        </div>
      )}
      {purgeSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
          {purgeSuccess}
          <button type="button" onClick={() => setPurgeSuccess(null)} className="underline">Fermer</button>
        </div>
      )}

      {/* Modale de confirmation de suppression d'un affilié */}
      {deleteModal.open && deleteModal.affiliate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-red-700 mb-2">Supprimer l'affilié</h3>
            <p className="text-gray-600 mb-4">
              Êtes-vous sûr de vouloir supprimer l'affilié <strong>{deleteModal.affiliate.merchant_code}</strong> ({deleteModal.affiliate.company_name}) ?
              <br />
              <span className="text-sm text-red-600 font-medium">Cette action est irréversible et supprimera également l'historique et les validations associées.</span>
            </p>
            {deleteError && (
              <p className="mb-4 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{deleteError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setDeleteModal({ open: false, affiliate: null }); setDeleteError(null); }}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
          {deleteSuccess}
          <button type="button" onClick={() => setDeleteSuccess(null)} className="underline">Fermer</button>
        </div>
      )}
    </div>
  );
}
