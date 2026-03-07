import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest, fetchWithAuth, getApiBaseUrl } from '@/services/api';
import { StatusBadge } from '@/components/StatusBadge';

interface AffiliateDetail {
  id: string;
  merchant_code: string;
  numero_terminal?: string | null;
  company_name: string;
  trade_name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  technical_email?: string | null;
  mcc_code?: string | null;
  website?: string | null;
  rne?: string | null;
  postal_code?: string | null;
  currency?: string | null;
  iban?: string | null;
  date_creation?: string | null;
  date_modification?: string | null;
  type_cartes?: string | null;
  status: string;
  test_params_sent_at?: string | null;
  prod_params_sent_at?: string | null;
  createdBy?: { id: string; firstName: string; lastName: string; email: string } | null;
  histories: Array<{
    id: string;
    old_status: string | null;
    new_status: string;
    comment: string | null;
    createdAt: string;
    changedBy: { firstName: string; lastName: string; email: string };
  }>;
  testValidations: Array<{
    id: string;
    overall_result: boolean;
    transactions_found: number;
    createdAt: string;
    checkedBy: { firstName: string; lastName: string };
  }>;
  [key: string]: unknown;
}

const STATUS_ACTIONS: Record<string, { label: string; next: string }> = {
  CREATED_MERCHANT_MGT: { label: 'Marquer Affiliation Créée', next: 'AFFILIATION_CREATED' },
  AFFILIATION_CREATED: { label: 'Envoyer Paramètres de Test', next: 'TEST_PARAMS_SENT' },
  TEST_PARAMS_SENT: { label: 'Vérifier les Tests', next: 'TESTS_VALIDATED' },
  TESTS_VALIDATED: { label: 'Envoyer Paramètres de Production', next: 'PROD_PARAMS_SENT' },
  PROD_PARAMS_SENT: { label: 'Mettre en Production', next: 'IN_PRODUCTION' },
};

export function AffiliateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [affiliate, setAffiliate] = useState<AffiliateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'historique' | 'credentials' | 'validations'>('info');
  const [statusModal, setStatusModal] = useState(false);
  const [comment, setComment] = useState('');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [sendingParams, setSendingParams] = useState<'test' | 'prod' | null>(null);
  const [verifyingTests, setVerifyingTests] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: `PSP Onboarding - ${affiliate?.company_name ?? ''} (${affiliate?.merchant_code ?? ''})`,
    text: '',
    cc: '',
    bcc: '',
  });
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    if (affiliate && emailModalOpen) {
      const defaultTo = affiliate.technical_email || affiliate.email || '';
      setEmailForm((f) => ({
        ...f,
        to: defaultTo,
        subject: `PSP Onboarding - ${affiliate.company_name} (${affiliate.merchant_code})`,
      }));
      setEmailError('');
    }
  }, [affiliate, emailModalOpen]);

  const handleSendEmail = async () => {
    if (!id || !emailForm.to?.trim() || !emailForm.subject?.trim() || !emailForm.text?.trim()) {
      setEmailError('Destinataire, objet et message sont obligatoires.');
      return;
    }
    setSendingEmail(true);
    setEmailError('');
    try {
      const apiBase = getApiBaseUrl();
      const sendEmailUrl = `${apiBase}/api/affiliates/${id}/send-email`;
      let res: Response;
      if (emailAttachments.length > 0) {
        const formData = new FormData();
        formData.append('to', emailForm.to.trim());
        formData.append('subject', emailForm.subject.trim());
        formData.append('text', emailForm.text.trim());
        if (emailForm.cc?.trim()) formData.append('cc', emailForm.cc.trim());
        if (emailForm.bcc?.trim()) formData.append('bcc', emailForm.bcc.trim());
        emailAttachments.forEach((file) => formData.append('attachments', file));
        res = await fetchWithAuth(sendEmailUrl, {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetchWithAuth(sendEmailUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: emailForm.to.trim(),
            subject: emailForm.subject.trim(),
            text: emailForm.text.trim(),
            cc: emailForm.cc?.trim() || undefined,
            bcc: emailForm.bcc?.trim() || undefined,
          }),
        });
      }
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.message || data.error || 'Échec de l\'envoi');
      setEmailModalOpen(false);
      setEmailForm({ to: '', subject: '', text: '', cc: '', bcc: '' });
      setEmailAttachments([]);
    } catch (err: unknown) {
      setEmailError(err instanceof Error ? err.message : 'Échec de l\'envoi');
    } finally {
      setSendingEmail(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    apiRequest<AffiliateDetail>(`/api/affiliates/${id}`)
      .then(setAffiliate)
      .catch(() => setAffiliate(null))
      .finally(() => setLoading(false));
  }, [id]);

  const action = affiliate ? STATUS_ACTIONS[affiliate.status] : null;
  const canChangeStatus = action && affiliate?.status !== 'IN_PRODUCTION';

  const runVerifyTests = () => {
    if (!id) return;
    setVerifyingTests(true);
    apiRequest<{ id: string }>(`/api/affiliates/${id}/verify-tests`, { method: 'POST' })
      .then(() => apiRequest<AffiliateDetail>(`/api/affiliates/${id}`))
      .then(setAffiliate)
      .finally(() => setVerifyingTests(false));
  };

  const sendParams = (type: 'test' | 'prod') => {
    if (!id) return;
    setSendingParams(type);
    const path = type === 'test' ? 'send-test-params' : 'send-prod-params';
    apiRequest<{ sent: boolean; message: string; test_params_sent_at?: string; prod_params_sent_at?: string }>(`/api/affiliates/${id}/${path}`, { method: 'POST' })
      .then((r) => {
        if (r.test_params_sent_at || r.prod_params_sent_at) {
          return apiRequest<AffiliateDetail>(`/api/affiliates/${id}`).then(setAffiliate);
        }
      })
      .finally(() => setSendingParams(null));
  };

  const handleStatusChange = () => {
    if (!id || !action) return;
    apiRequest<AffiliateDetail>(`/api/affiliates/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        new_status: action.next,
        comment: comment || undefined,
      }),
    })
      .then(() => {
        setStatusModal(false);
        setComment('');
        return apiRequest<AffiliateDetail>(`/api/affiliates/${id}`);
      })
      .then(setAffiliate);
  };

  if (loading || !affiliate) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{loading ? 'Chargement...' : 'Affilié non trouvé'}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">{affiliate.company_name}</h1>
          <p className="text-gray-500">{affiliate.merchant_code}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEmailModalOpen(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 border border-gray-300 inline-flex items-center gap-2"
          >
            <span aria-hidden>✉</span>
            Envoyer un email
          </button>
          <StatusBadge status={affiliate.status} size="lg" />
          {canChangeStatus && (
            <button
              type="button"
              onClick={() => setStatusModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              {action?.label}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 mb-6">
        {(['info', 'historique', 'credentials', 'validations'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
              tab === t ? 'bg-white border border-b-0 border-gray-200 -mb-px' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t === 'info' && 'Informations'}
            {t === 'historique' && 'Historique'}
            {t === 'credentials' && 'Credentials'}
            {t === 'validations' && 'Validations Tests'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        {tab === 'info' && (
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {[
              ['Affiliation', affiliate.merchant_code],
              ['Numero Terminal', affiliate.numero_terminal],
              ['Raison Sociale', affiliate.company_name],
              ['Adresse', affiliate.address],
              ['Telephone', affiliate.phone],
              ['Email', affiliate.email],
              ['MCC', affiliate.mcc_code],
              ['URL', affiliate.website],
              ['RNE', affiliate.rne],
              ['CDP', affiliate.postal_code],
              ['Devise', affiliate.currency],
              ['RIB', affiliate.iban],
              ['Date Creation', affiliate.date_creation],
              ['Date Modification', affiliate.date_modification],
              ['Ajouter Par', affiliate.createdBy ? `${affiliate.createdBy.firstName} ${affiliate.createdBy.lastName} (${affiliate.createdBy.email})` : null],
              ['Webmaster', affiliate.technical_email],
              ['Type Cartes', affiliate.type_cartes],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <p className="text-gray-500">{label}</p>
                <p className="font-medium">{value ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
        {tab === 'historique' && (
          <ul className="space-y-4">
            {affiliate.histories.map((h) => (
              <li key={h.id} className="border-l-2 border-gray-200 pl-4">
                <p className="text-sm text-gray-500">
                  {new Date(h.createdAt).toLocaleString('fr-FR')} — {h.changedBy.firstName} {h.changedBy.lastName}
                </p>
                <p className="font-medium">
                  {h.old_status ?? '—'} → {h.new_status}
                </p>
                {h.comment && <p className="text-gray-600 text-sm">{h.comment}</p>}
              </li>
            ))}
          </ul>
        )}
        {tab === 'credentials' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Paramètres TEST</p>
                <p className="font-medium">
                  {affiliate.test_params_sent_at
                    ? `Envoyés le ${new Date(affiliate.test_params_sent_at).toLocaleString('fr-FR')}`
                    : 'Non envoyés'}
                </p>
                <button
                  type="button"
                  disabled={!!sendingParams}
                  onClick={() => sendParams('test')}
                  className="mt-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {sendingParams === 'test' ? 'Envoi...' : 'Envoyer paramètres test'}
                </button>
              </div>
              <div>
                <p className="text-gray-500">Paramètres PROD</p>
                <p className="font-medium">
                  {affiliate.prod_params_sent_at
                    ? `Envoyés le ${new Date(affiliate.prod_params_sent_at).toLocaleString('fr-FR')}`
                    : 'Non envoyés'}
                </p>
                <button
                  type="button"
                  disabled={!!sendingParams}
                  onClick={() => sendParams('prod')}
                  className="mt-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {sendingParams === 'prod' ? 'Envoi...' : 'Envoyer paramètres prod'}
                </button>
              </div>
            </div>
            <p className="text-gray-500 text-sm">
              Login = code marchand. Mot de passe généré et envoyé par email (SMTP). À changer à la première connexion.
            </p>
          </div>
        )}
        {tab === 'validations' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={verifyingTests}
                onClick={runVerifyTests}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {verifyingTests ? 'Vérification...' : 'Vérifier les tests (API Clic to Pay)'}
              </button>
              <span className="text-sm text-gray-500">Lance une vérification et enregistre le résultat.</span>
            </div>
            <ul className="space-y-3">
            {affiliate.testValidations.length === 0 ? (
              <p className="text-gray-500">Aucune vérification pour l’instant.</p>
            ) : (
              affiliate.testValidations.map((v) => (
                <li key={v.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm">
                    {new Date(v.createdAt).toLocaleString('fr-FR')} — {v.checkedBy.firstName} {v.checkedBy.lastName}
                  </p>
                  <p className="font-medium">{v.overall_result ? 'Résultat : OK' : 'Résultat : Échec'}</p>
                  <p className="text-sm text-gray-500">{v.transactions_found} transaction(s)</p>
                </li>
              ))
            )}
            </ul>
          </div>
        )}
      </div>

      {statusModal && action && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Changer le statut</h3>
            <p className="text-gray-600 mb-4">
              Passer à « {action.next} ». Commentaire (optionnel) :
            </p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setStatusModal(false); setComment(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleStatusChange}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {emailModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { setEmailModalOpen(false); setEmailError(''); setEmailAttachments([]); }}
        >
          <div
            className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Envoyer un email</h3>
            {emailError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {emailError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destinataire *</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {affiliate.email && (
                    <button
                      type="button"
                      onClick={() => setEmailForm((f) => ({ ...f, to: affiliate.email! }))}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Contact : {affiliate.email}
                    </button>
                  )}
                  {affiliate.technical_email && affiliate.technical_email !== affiliate.email && (
                    <button
                      type="button"
                      onClick={() => setEmailForm((f) => ({ ...f, to: affiliate.technical_email! }))}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Technique : {affiliate.technical_email}
                    </button>
                  )}
                </div>
                <input
                  type="email"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm((f) => ({ ...f, to: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Adresse email du destinataire"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objet *</label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Objet de l'email"
                />
              </div>
              <div className="border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pièces jointes (optionnel) — PDF, DOC, XLS, images, ZIP…
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.gif,.zip"
                  onChange={(e) => setEmailAttachments(Array.from(e.target.files || []))}
                  className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-700"
                />
                {emailAttachments.length > 0 && (
                  <p className="mt-2 text-sm text-gray-600">
                    {emailAttachments.length} fichier(s) sélectionné(s) : {emailAttachments.map((f) => f.name).join(', ')}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea
                  value={emailForm.text}
                  onChange={(e) => setEmailForm((f) => ({ ...f, text: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  rows={8}
                  placeholder="Corps du message..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CC (optionnel)</label>
                  <input
                    type="email"
                    value={emailForm.cc}
                    onChange={(e) => setEmailForm((f) => ({ ...f, cc: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="cc@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BCC (optionnel)</label>
                  <input
                    type="email"
                    value={emailForm.bcc}
                    onChange={(e) => setEmailForm((f) => ({ ...f, bcc: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="bcc@example.com"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => { setEmailModalOpen(false); setEmailError(''); setEmailAttachments([]); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingEmail ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
