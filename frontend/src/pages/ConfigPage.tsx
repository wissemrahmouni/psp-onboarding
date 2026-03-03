import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '@/services/api';
import { Eye, EyeOff, KeyRound, FileText, RefreshCw, Copy, Check } from 'lucide-react';

interface ConfigItem {
  key: string;
  value: string;
  description: string | null;
  category: string | null;
  updatedAt: string;
  updatedBy?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  API: 'API',
  GENERAL: 'Général',
  SMTP: 'SMTP (courriel)',
  TEST_DOC: 'Documentation Test',
  PROD_DOC: 'Documentation Prod',
};

const CATEGORY_ORDER = ['API', 'GENERAL', 'SMTP', 'TEST_DOC', 'PROD_DOC'];

/** Clés dont la valeur est masquée par défaut (sécurité). */
const SENSITIVE_KEYS = ['EXTERNAL_API_KEY', 'SMTP_PASS', 'SMTP_USER', 'API_KEY', 'SECRET'];

function isSensitiveKey(key: string): boolean {
  const u = key.toUpperCase();
  return SENSITIVE_KEYS.some((s) => u === s || u.includes('PASSWORD') || u.includes('SECRET') || (u.includes('KEY') && u.includes('API')));
}


function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function ConfigPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [generateModal, setGenerateModal] = useState<{ open: boolean; key: string | null; copied: boolean }>({ open: false, key: null, copied: false });
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateConfirm, setGenerateConfirm] = useState(false);

  useEffect(() => {
    apiRequest<ConfigItem[]>('/api/config')
      .then(setConfigs)
      .catch(() => setConfigs([]))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, value: string) => {
    setEditing((prev) => ({ ...prev, [key]: value }));
  };

  const saveOne = (key: string) => {
    const value = editing[key] ?? configs.find((c) => c.key === key)?.value ?? '';
    setSaving(true);
    apiRequest<ConfigItem>('/api/config', { method: 'PATCH', body: JSON.stringify({ key, value }) })
      .then((updated) => {
        setConfigs((prev) =>
          prev.map((c) =>
            c.key === key
              ? { ...c, value: updated.value, updatedAt: updated.updatedAt, updatedBy: (updated as ConfigItem).updatedBy }
              : c
          )
        );
        setEditing((prev) => {
          const n = { ...prev };
          delete n[key];
          return n;
        });
      })
      .finally(() => setSaving(false));
  };

  const saveAll = () => {
    const updates = Object.entries(editing).map(([key, value]) => ({ key, value }));
    if (updates.length === 0) return;
    setSaving(true);
    apiRequest<ConfigItem[]>('/api/config', { method: 'PATCH', body: JSON.stringify({ updates }) })
      .then((list) => {
        setConfigs(list);
        setEditing({});
      })
      .finally(() => setSaving(false));
  };

  const toggleSecret = (key: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const generateNewApiKey = () => {
    setGenerateLoading(true);
    apiRequest<{ value: string }>('/api/config/generate-external-api-key', { method: 'POST' })
      .then((data) => {
        setGenerateModal({ open: true, key: data.value, copied: false });
        setGenerateConfirm(false);
      })
      .catch(() => setGenerateConfirm(false))
      .finally(() => setGenerateLoading(false));
  };

  const copyGeneratedKey = () => {
    if (!generateModal.key) return;
    navigator.clipboard.writeText(generateModal.key).then(() => setGenerateModal((m) => ({ ...m, copied: true })));
  };

  const closeGenerateModal = () => {
    setGenerateModal({ open: false, key: null, copied: false });
    apiRequest<ConfigItem[]>('/api/config').then(setConfigs).catch(() => {});
  };

  const setGeneratedKeyLocal = (key: string) => {
    if (key === 'EXTERNAL_API_KEY') handleChange(key, generateApiKeyLocal());
  };

  function generateApiKeyLocal(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 40; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  const byCategory = configs.reduce<Record<string, ConfigItem[]>>((acc, c) => {
    const cat = c.category || 'GENERAL';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  const orderedCategories = CATEGORY_ORDER.filter((cat) => byCategory[cat]?.length);
  const restCategories = Object.keys(byCategory).filter((c) => !CATEGORY_ORDER.includes(c));
  const categoriesToRender = [...orderedCategories, ...restCategories];

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-800 mb-2">Configuration</h1>
      <p className="text-gray-600 mb-2">
        Gestion des paramètres de l'application : clé API externe, nom et logo, URLs et contenus de documentation.
        Réservé aux administrateurs.
      </p>
      <p className="text-sm text-gray-500 mb-6">
        Pour l'utilisation de la clé API (ajout de marchand par des systèmes externes), voir la{' '}
        <Link to="/api-reference" className="text-blue-600 hover:underline inline-flex items-center gap-1">
          <FileText className="w-4 h-4" />
          API Reference
        </Link>.
      </p>

      {categoriesToRender.map((category) => (
        <section key={category} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2">
            {category === 'API' && <KeyRound className="w-5 h-5 text-blue-600" />}
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <div className="space-y-5">
            {byCategory[category].map((c) => {
              const isSecret = isSensitiveKey(c.key);
              const showValue = visibleSecrets[c.key];

              return (
                <div key={c.key} className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[200px] flex-1">
                    <p className="text-sm font-medium text-gray-700">{c.key}</p>
                    {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                    {(c.updatedAt || c.updatedBy) && (
                      <p className="text-xs text-gray-400 mt-1">
                        {c.updatedAt && <>Modifié le {formatDate(c.updatedAt)}</>}
                        {c.updatedBy && <> par {c.updatedBy}</>}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 min-w-[280px] flex gap-2 items-center">
                    <div className="flex-1 relative">
                      <input
                        type={isSecret && !showValue ? 'password' : 'text'}
                        value={editing[c.key] !== undefined ? editing[c.key] : (isSecret && !showValue ? '' : c.value)}
                        placeholder={isSecret && c.value && !editing[c.key] ? '••••••••••••' : undefined}
                        onChange={(e) => handleChange(c.key, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-20"
                      />
                      {isSecret && (
                        <button
                          type="button"
                          onClick={() => toggleSecret(c.key)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                          title={showValue ? 'Masquer' : 'Afficher'}
                        >
                          {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    {c.key === 'EXTERNAL_API_KEY' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setGenerateConfirm(true)}
                          disabled={generateLoading}
                          className="px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm hover:bg-amber-200 disabled:opacity-50 whitespace-nowrap inline-flex items-center gap-1"
                        >
                          <RefreshCw className={`w-4 h-4 ${generateLoading ? 'animate-spin' : ''}`} />
                          Générer une nouvelle clé
                        </button>
                        <button
                          type="button"
                          onClick={() => setGeneratedKeyLocal(c.key)}
                          className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 whitespace-nowrap"
                        >
                          Générer (local)
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => saveOne(c.key)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {Object.keys(editing).length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={saveAll}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-700"
          >
            Enregistrer toutes les modifications
          </button>
          <span className="text-sm text-gray-500">
            {Object.keys(editing).length} modification(s) en attente
          </span>
        </div>
      )}

      {/* Modale confirmation génération */}
      {generateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Générer une nouvelle clé API</h3>
            <p className="text-gray-600 text-sm mb-4">
              L'ancienne clé <strong>EXTERNAL_API_KEY</strong> sera remplacée. Les systèmes qui l'utilisent devront être mis à jour.
              Continuer ?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setGenerateConfirm(false)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={generateNewApiKey}
                disabled={generateLoading}
                className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50"
              >
                {generateLoading ? 'Génération…' : 'Générer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale affichage clé générée (une seule fois) */}
      {generateModal.open && generateModal.key && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Nouvelle clé EXTERNAL_API_KEY</h3>
            <p className="text-amber-800 text-sm mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Copiez cette clé maintenant. Elle ne sera plus affichée en clair après fermeture.
            </p>
            <div className="flex gap-2 items-center mb-4">
              <code className="flex-1 bg-slate-100 px-3 py-2 rounded-lg text-sm break-all font-mono">
                {generateModal.key}
              </code>
              <button
                type="button"
                onClick={copyGeneratedKey}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 inline-flex items-center gap-1 shrink-0"
              >
                {generateModal.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {generateModal.copied ? 'Copié' : 'Copier'}
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeGenerateModal}
                className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-800"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {configs.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
          <p className="font-medium">Aucune configuration.</p>
          <p className="text-sm mt-1">Exécutez le seed de la base pour créer les clés par défaut (ex. EXTERNAL_API_KEY, documentation).</p>
        </div>
      )}

      <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600">
        <p className="font-medium text-slate-700 mb-1">Variables d'environnement</p>
        <p>
          L'envoi d'e-mails (SMTP) et l'intégration Clic to Pay utilisent les variables d'environnement du serveur
          (SMTP_HOST, SMTP_USER, SMTP_PASS, CLICTOPAY_API_BASE_URL, etc.). Elles ne sont pas modifiables depuis cette page.
        </p>
      </div>
    </div>
  );
}
