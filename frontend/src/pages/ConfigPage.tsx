import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, safeParseJson, fetchWithAuth } from '@/services/api';
import { Eye, EyeOff, KeyRound, FileText, RefreshCw, Copy, Check, Save, Mail, Cloud } from 'lucide-react';

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
  CLICTOPAY: 'ClicToPay (synchronisation)',
  TEST_DOC: 'Documentation Test',
  PROD_DOC: 'Documentation Prod',
};

const CATEGORY_ORDER = ['API', 'GENERAL', 'SMTP', 'CLICTOPAY', 'TEST_DOC', 'PROD_DOC'];

/** Clés dont la valeur est masquée par défaut (sécurité). */
const SENSITIVE_KEYS = ['EXTERNAL_API_KEY', 'SMTP_PASS', 'SMTP_USER', 'API_KEY', 'SECRET', 'CLICTOPAY_TEST_PASSWORD', 'CLICTOPAY_PROD_PASSWORD'];

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

interface SmtpConfigFormProps {
  configs: ConfigItem[];
  onUpdate: () => void;
}

function SmtpConfigForm({ configs, onUpdate }: SmtpConfigFormProps) {
  const smtpConfigs = configs.filter((c) => c.category === 'SMTP');
  const [formData, setFormData] = useState({
    SMTP_HOST: smtpConfigs.find((c) => c.key === 'SMTP_HOST')?.value || '',
    SMTP_PORT: smtpConfigs.find((c) => c.key === 'SMTP_PORT')?.value || '587',
    SMTP_SECURE: smtpConfigs.find((c) => c.key === 'SMTP_SECURE')?.value || 'false',
    SMTP_USER: smtpConfigs.find((c) => c.key === 'SMTP_USER')?.value || '',
    SMTP_PASS: smtpConfigs.find((c) => c.key === 'SMTP_PASS')?.value || '',
    SMTP_FROM_EMAIL: smtpConfigs.find((c) => c.key === 'SMTP_FROM_EMAIL')?.value || '',
    SMTP_FROM_NAME: smtpConfigs.find((c) => c.key === 'SMTP_FROM_NAME')?.value || 'PSP Onboarding',
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; error?: string } | null>(null);
  const [testEmail, setTestEmail] = useState('wissem@gmail.com');

  useEffect(() => {
    const smtpConfigs = configs.filter((c) => c.category === 'SMTP');
    const host = smtpConfigs.find((c) => c.key === 'SMTP_HOST')?.value || '';
    const user = smtpConfigs.find((c) => c.key === 'SMTP_USER')?.value || '';
    const pass = smtpConfigs.find((c) => c.key === 'SMTP_PASS')?.value || '';
    setIsConfigured(!!(host && user && pass));
    setFormData({
      SMTP_HOST: host,
      SMTP_PORT: smtpConfigs.find((c) => c.key === 'SMTP_PORT')?.value || '587',
      SMTP_SECURE: smtpConfigs.find((c) => c.key === 'SMTP_SECURE')?.value || 'false',
      SMTP_USER: user,
      SMTP_PASS: pass,
      SMTP_FROM_EMAIL: smtpConfigs.find((c) => c.key === 'SMTP_FROM_EMAIL')?.value || '',
      SMTP_FROM_NAME: smtpConfigs.find((c) => c.key === 'SMTP_FROM_NAME')?.value || 'PSP Onboarding',
    });
  }, [configs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);

    try {
      await apiRequest('/api/config/smtp', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setSuccess(true);
      onUpdate();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    setError('');
    setTesting(true);

    try {
      // D'abord sauvegarder les paramètres actuels s'ils ont changé
      await apiRequest('/api/config/smtp', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      
      // Ensuite tester la connexion - gérer manuellement pour extraire les détails d'erreur
      const res = await fetchWithAuth('/api/config/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testEmail: testEmail.trim() || undefined }),
      });
      
      const result = await safeParseJson<{ success?: boolean; message?: string; error?: string }>(res, { success: false, message: 'Erreur de parsing', error: 'Erreur de parsing' }).catch(() => ({ success: false, message: 'Erreur de parsing de la réponse', error: 'Erreur de parsing de la réponse' }));
      
      if (res.ok && result.success) {
        setTestResult({ success: true, message: result.message || 'OK' });
        onUpdate();
        setTimeout(() => setTestResult(null), 5000);
      } else {
        const errMsg = (result as { error?: string }).error ?? result.message ?? 'Erreur inconnue';
        setTestResult({
          success: false,
          message: result.message || 'Échec du test SMTP',
          error: errMsg,
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du test';
      setTestResult({
        success: false,
        message: 'Échec du test SMTP',
        error: errorMessage,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-medium text-amber-800">Configuration SMTP requise</p>
              <p className="text-sm text-amber-700 mt-1">
                Pour envoyer des e-mails aux marchands, veuillez configurer les paramètres SMTP ci-dessous.
              </p>
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          Paramètres SMTP sauvegardés avec succès !
        </div>
      )}
      {testResult && (
        <div className={`border rounded-lg p-3 text-sm ${testResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <div className="font-medium mb-1">{testResult.success ? '✓ Test réussi' : '✗ Test échoué'}</div>
          <div>{testResult.message}</div>
          {testResult.error && (
            <div className="mt-2 text-xs font-mono bg-white/50 p-2 rounded border border-current/20">
              {testResult.error}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Serveur SMTP (Host) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.SMTP_HOST}
            onChange={(e) => setFormData({ ...formData, SMTP_HOST: e.target.value })}
            placeholder="smtp.gmail.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Port SMTP <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.SMTP_PORT}
            onChange={(e) => setFormData({ ...formData, SMTP_PORT: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="25">25 (Non sécurisé)</option>
            <option value="587">587 (TLS)</option>
            <option value="465">465 (SSL)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Connexion sécurisée
          </label>
          <select
            value={formData.SMTP_SECURE}
            onChange={(e) => setFormData({ ...formData, SMTP_SECURE: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="false">Non (STARTTLS)</option>
            <option value="true">Oui (SSL/TLS)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom d'utilisateur (Email) <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={formData.SMTP_USER}
            onChange={(e) => setFormData({ ...formData, SMTP_USER: e.target.value })}
            placeholder="votre-email@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mot de passe <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={formData.SMTP_PASS}
              onChange={(e) => setFormData({ ...formData, SMTP_PASS: e.target.value })}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email expéditeur
          </label>
          <input
            type="email"
            value={formData.SMTP_FROM_EMAIL}
            onChange={(e) => setFormData({ ...formData, SMTP_FROM_EMAIL: e.target.value })}
            placeholder="noreply@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Laissé vide pour utiliser SMTP_USER</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom de l'expéditeur
          </label>
          <input
            type="text"
            value={formData.SMTP_FROM_NAME}
            onChange={(e) => setFormData({ ...formData, SMTP_FROM_NAME: e.target.value })}
            placeholder="PSP Onboarding"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
        <button
          type="submit"
          disabled={saving || testing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Sauvegarde...' : isConfigured ? 'Mettre à jour les paramètres SMTP' : 'Enregistrer les paramètres SMTP'}
        </button>
        {isConfigured && (
          <>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Email de test"
              className="w-56 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-700 inline-flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              {testing ? 'Test en cours...' : 'Tester les paramètres SMTP'}
            </button>
          </>
        )}
        <div className="flex-1">
          <p className="text-xs text-gray-500">
            Les paramètres seront utilisés pour l'envoi d'e-mails aux marchands (paramètres de test et production).
          </p>
          {isConfigured && (
            <p className="text-xs text-green-600 mt-1">
              ✓ Configuration SMTP active
            </p>
          )}
        </div>
      </div>
    </form>
  );
}

interface ClicToPayConfigFormProps {
  configs: ConfigItem[];
  onUpdate: () => void;
}

function ClicToPayConfigForm({ configs, onUpdate }: ClicToPayConfigFormProps) {
  const clictopayConfigs = configs.filter((c) => c.category === 'CLICTOPAY');
  const getVal = (key: string) => clictopayConfigs.find((c) => c.key === key)?.value || '';
  const [formData, setFormData] = useState({
    CLICTOPAY_TEST_URL: getVal('CLICTOPAY_TEST_URL') || 'https://test.clictopay.com/epg/rest/merchant/getStatus.do',
    CLICTOPAY_PROD_URL: getVal('CLICTOPAY_PROD_URL') || 'https://www.clictopay.com/epg/rest/merchant/getStatus.do',
    CLICTOPAY_TEST_USERNAME: getVal('CLICTOPAY_TEST_USERNAME'),
    CLICTOPAY_TEST_PASSWORD: getVal('CLICTOPAY_TEST_PASSWORD'),
    CLICTOPAY_PROD_USERNAME: getVal('CLICTOPAY_PROD_USERNAME'),
    CLICTOPAY_PROD_PASSWORD: getVal('CLICTOPAY_PROD_PASSWORD'),
  });
  const [showTestPassword, setShowTestPassword] = useState(false);
  const [showProdPassword, setShowProdPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setFormData({
      CLICTOPAY_TEST_URL: getVal('CLICTOPAY_TEST_URL') || 'https://test.clictopay.com/epg/rest/merchant/getStatus.do',
      CLICTOPAY_PROD_URL: getVal('CLICTOPAY_PROD_URL') || 'https://www.clictopay.com/epg/rest/merchant/getStatus.do',
      CLICTOPAY_TEST_USERNAME: getVal('CLICTOPAY_TEST_USERNAME'),
      CLICTOPAY_TEST_PASSWORD: getVal('CLICTOPAY_TEST_PASSWORD'),
      CLICTOPAY_PROD_USERNAME: getVal('CLICTOPAY_PROD_USERNAME'),
      CLICTOPAY_PROD_PASSWORD: getVal('CLICTOPAY_PROD_PASSWORD'),
    });
  }, [configs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      await apiRequest('/api/config/clictopay', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setSuccess(true);
      onUpdate();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          Paramètres ClicToPay enregistrés.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Environnement TEST</h3>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">URL API TEST</label>
          <input
            type="url"
            value={formData.CLICTOPAY_TEST_URL}
            onChange={(e) => setFormData({ ...formData, CLICTOPAY_TEST_URL: e.target.value })}
            placeholder="https://test.clictopay.com/epg/rest/merchant/getStatus.do"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Identifiant TEST</label>
          <input
            type="text"
            value={formData.CLICTOPAY_TEST_USERNAME}
            onChange={(e) => setFormData({ ...formData, CLICTOPAY_TEST_USERNAME: e.target.value })}
            placeholder="Username"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe TEST</label>
          <div className="relative">
            <input
              type={showTestPassword ? 'text' : 'password'}
              value={formData.CLICTOPAY_TEST_PASSWORD}
              onChange={(e) => setFormData({ ...formData, CLICTOPAY_TEST_PASSWORD: e.target.value })}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-10"
            />
            <button
              type="button"
              onClick={() => setShowTestPassword(!showTestPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
            >
              {showTestPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="md:col-span-2 mt-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Environnement PROD</h3>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">URL API PROD</label>
          <input
            type="url"
            value={formData.CLICTOPAY_PROD_URL}
            onChange={(e) => setFormData({ ...formData, CLICTOPAY_PROD_URL: e.target.value })}
            placeholder="https://www.clictopay.com/epg/rest/merchant/getStatus.do"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Identifiant PROD</label>
          <input
            type="text"
            value={formData.CLICTOPAY_PROD_USERNAME}
            onChange={(e) => setFormData({ ...formData, CLICTOPAY_PROD_USERNAME: e.target.value })}
            placeholder="Username"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe PROD</label>
          <div className="relative">
            <input
              type={showProdPassword ? 'text' : 'password'}
              value={formData.CLICTOPAY_PROD_PASSWORD}
              onChange={(e) => setFormData({ ...formData, CLICTOPAY_PROD_PASSWORD: e.target.value })}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-10"
            />
            <button
              type="button"
              onClick={() => setShowProdPassword(!showProdPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
            >
              {showProdPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-2 border-t border-amber-200">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-amber-700 inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Enregistrement...' : 'Enregistrer les paramètres ClicToPay'}
        </button>
      </div>
    </form>
  );
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

  const orderedCategories = CATEGORY_ORDER.filter((cat) => byCategory[cat]?.length && cat !== 'CLICTOPAY');
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

      {/* Section SMTP - Formulaire d'ajout/modification - Toujours visible en premier */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-md border-2 border-blue-300 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Configuration SMTP
            </h2>
            <p className="text-sm text-gray-700 mt-1">
              Configurez les paramètres SMTP pour l'envoi d'e-mails aux marchands. Les paramètres peuvent être définis ici ou via les variables d'environnement.
            </p>
          </div>
          {configs.filter((c) => c.category === 'SMTP').length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 border-2 border-green-400 rounded-lg shadow-sm">
              <div className="w-2.5 h-2.5 bg-green-600 rounded-full animate-pulse"></div>
              <span className="text-xs font-semibold text-green-800">Configuré</span>
            </div>
          )}
        </div>
        <SmtpConfigForm configs={configs} onUpdate={() => {
          apiRequest<ConfigItem[]>('/api/config').then(setConfigs).catch(() => {});
        }} />
      </section>

      {/* Section ClicToPay - Configuration des APIs de synchronisation */}
      <section className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl shadow-md border-2 border-amber-300 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-2">
              <Cloud className="w-6 h-6 text-amber-600" />
              Configuration ClicToPay (synchronisation)
            </h2>
            <p className="text-sm text-gray-700 mt-1">
              URLs et identifiants pour la synchronisation des affiliés avec les environnements TEST et PROD (API getStatus.do).
            </p>
          </div>
        </div>
        <ClicToPayConfigForm configs={configs} onUpdate={() => {
          apiRequest<ConfigItem[]>('/api/config').then(setConfigs).catch(() => {});
        }} />
      </section>

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

      <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600">
        <p className="font-medium text-slate-700 mb-1">Note</p>
        <p>
        Les paramètres ClicToPay (URLs et credentials) se configurent dans la section « Configuration ClicToPay » ci-dessus.
        Les paramètres SMTP peuvent être configurés dans la section SMTP ou via les variables d'environnement.
        </p>
      </div>

      {configs.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 mt-6">
          <p className="font-medium">Aucune configuration.</p>
          <p className="text-sm mt-1">Exécutez le seed de la base pour créer les clés par défaut (ex. EXTERNAL_API_KEY, documentation).</p>
        </div>
      )}
    </div>
  );
}
