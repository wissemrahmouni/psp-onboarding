import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '@/services/api';

export function NewAffiliatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    merchant_code: '',
    company_name: '',
    trade_name: '',
    email: '',
    technical_email: '',
    city: '',
    country: '',
    phone: '',
    contact_name: '',
    contact_firstname: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    apiRequest<{ id: string }>('/api/affiliates', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        trade_name: form.trade_name || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        phone: form.phone || undefined,
        contact_name: form.contact_name || undefined,
        contact_firstname: form.contact_firstname || undefined,
      }),
    })
      .then((data) => navigate(`/affiliates/${data.id}`))
      .catch(() => setLoading(false));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Nouveau marchand</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'merchant_code', label: 'Code marchand *', type: 'text' },
            { key: 'company_name', label: 'Raison sociale *', type: 'text' },
            { key: 'trade_name', label: 'Nom commercial', type: 'text' },
            { key: 'email', label: 'Email *', type: 'email' },
            { key: 'technical_email', label: 'Email technique *', type: 'email' },
            { key: 'city', label: 'Ville', type: 'text' },
            { key: 'country', label: 'Pays', type: 'text' },
            { key: 'phone', label: 'Téléphone', type: 'text' },
            { key: 'contact_name', label: 'Nom contact', type: 'text' },
            { key: 'contact_firstname', label: 'Prénom contact', type: 'text' },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-1">
                {label}
              </label>
              <input
                id={key}
                type={type}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
                required={label.endsWith('*')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/affiliates')}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
