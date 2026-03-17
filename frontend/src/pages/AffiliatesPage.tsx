import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest, fetchWithAuth } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBadge } from '@/components/StatusBadge';
import { getDisplayDate } from '@/lib/utils';

interface AffiliateRow {
  id: string;
  merchant_code: string;
  company_name: string;
  trade_name: string | null;
  city: string | null;
  country: string | null;
  status: string;
  date_creation?: string | null;
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
  const [syncingScan, setSyncingScan] = useState<'TEST' | 'PROD' | null>(null);
  const [scanProgress, setScanProgress] = useState<{
    currentMerchantId: number;
    total: number;
    foundCount: number;
    status: string;
    error?: string;
    merchantId_min?: number;
    merchantId_max?: number;
  } | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [syncModal, setSyncModal] = useState<{ open: boolean; env: 'TEST' | 'PROD' | null }>({ open: false, env: null });
  const [syncRange, setSyncRange] = useState({ merchantId_min: 500000, merchantId_max: 539747 });
  const [simulateMerchantId, setSimulateMerchantId] = useState(501088);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [simulateResult, setSimulateResult] = useState<{
    merchantId: number;
    environment: string;
    apiResponse: Record<string, unknown> | null;
    comparison: { processingId: string | null; terminalId: string | null; match: boolean; conditionMet: boolean };
    match: { merchant_code: string; numero_terminal: string | null; company_name: string } | null;
    candidatesAffiliatesWithSameProcessingId?: Array<{ merchant_code: string; numero_terminal: string | null; company_name: string; terminalMatch: boolean }>;
  } | null>(null);
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

  const openSyncModal = (env: 'TEST' | 'PROD') => {
    setSyncModal({ open: true, env });
  };

  const runSimulate = () => {
    if (!syncModal.env) return;
    setSimulateLoading(true);
    setSimulateResult(null);
    apiRequest<{
      merchantId: number;
      environment: string;
      apiResponse: Record<string, unknown> | null;
      comparison: { processingId: string | null; terminalId: string | null; match: boolean; conditionMet: boolean };
      match: { merchant_code: string; numero_terminal: string | null; company_name: string } | null;
      candidatesAffiliatesWithSameProcessingId?: Array<{ merchant_code: string; numero_terminal: string | null; company_name: string; terminalMatch: boolean }>;
    }>(`/api/affiliates/sync-clictopay-simulate`, {
      method: 'POST',
      body: JSON.stringify({ merchantId: simulateMerchantId, environment: syncModal.env }),
    })
      .then(setSimulateResult)
      .catch((err: { message?: string }) => {
        setSimulateResult({
          merchantId: simulateMerchantId,
          environment: syncModal.env!,
          apiResponse: null,
          comparison: { processingId: null, terminalId: null, match: false, conditionMet: false },
          match: null,
        });
        alert(err?.message || 'Erreur lors de la simulation');
      })
      .finally(() => setSimulateLoading(false));
  };

  const launchSyncScan = () => {
    const env = syncModal.env;
    if (!env) return;
    setSyncModal({ open: false, env: null });
    setSyncingScan(env);
    setScanProgress(null);
    setScanResult(null);
    apiRequest<{ message: string; progress?: { currentMerchantId: number; total: number; foundCount: number; status: string } }>(
      '/api/affiliates/sync-clictopay-scan',
      {
        method: 'POST',
        body: JSON.stringify({
          environment: env,
          merchantId_min: syncRange.merchantId_min,
          merchantId_max: syncRange.merchantId_max,
        }),
      }
    )
      .then((data) => {
        if (data.progress) setScanProgress(data.progress);
        const poll = () => {
          apiRequest<{
          progress: {
            currentMerchantId: number;
            total: number;
            foundCount: number;
            status: string;
            error?: string;
            merchantId_min?: number;
            merchantId_max?: number;
          };
        }>(
            `/api/affiliates/sync-clictopay-scan/status?environment=${env}`
          ).then((r) => {
            setScanProgress(r.progress);
            if (r.progress.status === 'running') {
              setTimeout(poll, 1500);
            } else {
              setSyncingScan(null);
              setScanResult(
                r.progress.status === 'completed'
                  ? `Scan terminé : ${r.progress.foundCount} affilié(s) trouvé(s).`
                  : r.progress.status === 'error'
                    ? r.progress.error || 'Erreur lors du scan.'
                    : 'Scan terminé.'
              );
              const listParams = new URLSearchParams();
              if (page > 1) listParams.set('page', String(page));
              if (status) listParams.set('status', status);
              if (search) listParams.set('search', search);
              apiRequest<ListResponse>(`/api/affiliates?${listParams}`).then(setRes);
            }
          });
        };
        setTimeout(poll, 1000);
      })
      .catch((err: { message?: string }) => {
        setSyncingScan(null);
        setScanResult(err?.message || 'Erreur au démarrage du scan.');
      });
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
              <button
                type="button"
                disabled={!!syncingScan}
                onClick={() => openSyncModal('TEST')}
                className="inline-flex items-center px-3 py-2 border border-amber-400 rounded-lg text-sm font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
                title="Synchroniser avec ClicToPay TEST"
              >
                {syncingScan === 'TEST' ? 'Scan TEST...' : 'Synchroniser avec TEST'}
              </button>
              <button
                type="button"
                disabled={!!syncingScan}
                onClick={() => openSyncModal('PROD')}
                className="inline-flex items-center px-3 py-2 border border-green-400 rounded-lg text-sm font-medium text-green-800 bg-green-50 hover:bg-green-100 disabled:opacity-50"
                title="Synchroniser avec ClicToPay PROD"
              >
                {syncingScan === 'PROD' ? 'Scan PROD...' : 'Synchroniser avec PROD'}
              </button>
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

      {(scanProgress || scanResult) && (
        <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1">
              {scanProgress?.status === 'running' && (
                <>
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    Synchronisation {syncingScan} — merchantId {scanProgress.currentMerchantId.toLocaleString()} /{' '}
                    {scanProgress.total.toLocaleString()} en cours...
                  </p>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      scanProgress.total > 0
                        ? ((scanProgress.currentMerchantId - (scanProgress.merchantId_min ?? 500000)) /
                            scanProgress.total) *
                            100
                        : 0
                    )}%`,
                  }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{scanProgress.foundCount} affilié(s) trouvé(s)</p>
                </>
              )}
              {(scanResult || (scanProgress?.status === 'error' && scanProgress?.error)) && (
                <p
                  className={`text-sm font-medium ${
                    scanProgress?.status === 'error' ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {scanResult || scanProgress?.error || 'Erreur lors du scan.'}
                </p>
              )}
            </div>
            {(scanProgress?.status === 'completed' || scanProgress?.status === 'error') && (
              <button
                type="button"
                onClick={() => {
                  setScanProgress(null);
                  setScanResult(null);
                }}
                className="text-slate-500 hover:text-slate-700 text-sm"
              >
                Fermer
              </button>
            )}
          </div>
        </div>
      )}

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
          <option value="CREATED_MERCHANT_MGT">Nouveau</option>
          <option value="AFFILIATION_CREATED">Pris en charge</option>
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
                        {getDisplayDate(a.date_creation, a.createdAt)}
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

      {/* Modale de configuration de la synchronisation ClicToPay */}
      {syncModal.open && syncModal.env && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Synchroniser avec ClicToPay {syncModal.env}
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Indiquez la plage de merchantId à scanner. Le scan appellera l'API pour chaque merchantId compris entre min et max (inclus).
            </p>
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <p className="font-medium text-amber-900 mb-1">Condition de synchronisation</p>
              <p className="text-amber-800">
                Un affilié est mis à jour si : <strong>réponse.processingId</strong> = Affiliation (code marchand) <strong>ET</strong>{' '}
                <strong>réponse.terminalId</strong> = Numéro Terminal.
              </p>
              <p className="text-amber-700 text-xs mt-1">Dans le cas contraire, la réponse est ignorée.</p>
            </div>
            <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="font-medium text-slate-800 mb-2">Simuler une synchronisation</p>
              <div className="flex gap-2 items-center mb-2">
                <input
                  type="number"
                  value={simulateMerchantId}
                  onChange={(e) => setSimulateMerchantId(Number(e.target.value) || 501088)}
                  className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="501088"
                />
                <button
                  type="button"
                  onClick={runSimulate}
                  disabled={simulateLoading}
                  className="px-3 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50"
                >
                  {simulateLoading ? 'Appel API...' : 'Simuler'}
                </button>
              </div>
              {simulateResult && (
                <div className="mt-3 text-sm space-y-2 border-t border-slate-200 pt-2">
                  <p className="font-medium">
                    Résultat pour merchantId {simulateResult.merchantId} ({simulateResult.environment})
                  </p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                    <span className="text-gray-500">Réponse processingId :</span>
                    <span className="font-mono">{simulateResult.comparison.processingId ?? '—'}</span>
                    <span className="text-gray-500">Réponse terminalId :</span>
                    <span className="font-mono">{simulateResult.comparison.terminalId ?? '—'}</span>
                  </div>
                  <p className={simulateResult.comparison.match ? 'text-emerald-600 font-medium' : 'text-amber-600'}>
                    {simulateResult.comparison.conditionMet
                      ? simulateResult.comparison.match
                        ? `✓ Correspondance trouvée : ${simulateResult.match?.company_name} (${simulateResult.match?.merchant_code})`
                        : '✗ Aucun affilié ne correspond (processingId + terminalId)'
                      : '✗ Réponse API sans processingId/terminalId'}
                  </p>
                  {simulateResult.candidatesAffiliatesWithSameProcessingId && simulateResult.candidatesAffiliatesWithSameProcessingId.length > 0 && !simulateResult.comparison.match && (
                    <p className="text-xs text-gray-600">
                      Affilié(s) avec même Affiliation :{' '}
                      {simulateResult.candidatesAffiliatesWithSameProcessingId.map((c) => `${c.company_name} (terminal: ${c.numero_terminal ?? '—'}, match: ${c.terminalMatch ? 'oui' : 'non'})`).join(' ; ')}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">merchantId min</label>
                <input
                  type="number"
                  value={syncRange.merchantId_min}
                  onChange={(e) => setSyncRange((r) => ({ ...r, merchantId_min: Number(e.target.value) || 0 }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">merchantId max</label>
                <input
                  type="number"
                  value={syncRange.merchantId_max}
                  onChange={(e) => setSyncRange((r) => ({ ...r, merchantId_max: Number(e.target.value) || 0 }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  min={0}
                />
              </div>
              <p className="text-xs text-gray-500">
                Nombre d'appels API : {(syncRange.merchantId_max - syncRange.merchantId_min + 1).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSyncModal({ open: false, env: null })}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={launchSyncScan}
                disabled={syncRange.merchantId_min > syncRange.merchantId_max}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Lancer la synchronisation
              </button>
            </div>
          </div>
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
