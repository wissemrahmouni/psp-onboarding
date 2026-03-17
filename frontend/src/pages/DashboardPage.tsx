import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '@/services/api';
import { StatusBadge } from '@/components/StatusBadge';
import { getDisplayDate } from '@/lib/utils';

interface DashboardStats {
  total_affiliates: number;
  count_by_status: Record<string, number>;
  new_this_month: number;
  in_production: number;
  blocked_affiliates: { id: string; merchant_code: string; company_name: string; status: string; updatedAt: string }[];
  monthly_trend: { month: string; count: number }[];
  latest_affiliates?: { id: string; merchant_code: string; company_name: string; status: string; date_creation?: string | null; createdAt: string }[];
}

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<DashboardStats>('/api/dashboard/stats')
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const firstName = user?.firstName ?? '';

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-800">Bonjour {firstName}</h1>
        <p className="text-xs text-emerald-600 mt-1">Dashboard P5 — Cartes et graphiques actifs</p>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </header>

      {!stats && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-amber-800">Impossible de charger les statistiques. Vérifiez que le backend est démarré.</p>
          <p className="text-sm text-amber-700 mt-1">Rafraîchissez la page (Ctrl+F5 pour vider le cache).</p>
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[
              { key: 'total', label: 'Total affiliés', value: stats.total_affiliates ?? 0, filter: '' },
              { key: 'CREATED_MERCHANT_MGT', label: 'Nouveaux', value: stats.count_by_status?.CREATED_MERCHANT_MGT ?? 0, filter: 'CREATED_MERCHANT_MGT' },
              { key: 'AFFILIATION_CREATED', label: 'Pris en charge', value: stats.count_by_status?.AFFILIATION_CREATED ?? 0, filter: 'AFFILIATION_CREATED' },
              { key: 'TEST_PARAMS_SENT', label: 'Param. test', value: stats.count_by_status?.TEST_PARAMS_SENT ?? 0, filter: 'TEST_PARAMS_SENT' },
              { key: 'TESTS_VALIDATED', label: 'Tests validés', value: stats.count_by_status?.TESTS_VALIDATED ?? 0, filter: 'TESTS_VALIDATED' },
              { key: 'IN_PRODUCTION', label: 'En production', value: stats.in_production, filter: 'IN_PRODUCTION' },
            ].map((card) => (
              <Link
                key={card.key}
                to={card.filter ? `/affiliates?status=${card.filter}` : '/affiliates'}
                className="bg-white rounded-xl shadow p-4 hover:shadow-md transition"
              >
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-semibold text-gray-800 mt-1">{card.value}</p>
              </Link>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-medium text-gray-800 mb-4">Nouvelles fiches par mois</h2>
              <div className="h-64 flex items-end gap-1">
                {(stats.monthly_trend ?? []).map(({ month, count }) => {
                  const trend = stats.monthly_trend ?? [];
                  const max = Math.max(...trend.map((d) => d.count), 1);
                  const h = (count / max) * 100;
                  return (
                    <div
                      key={month}
                      className="flex-1 min-w-0 flex flex-col items-center group"
                      title={`${month}: ${count}`}
                    >
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all group-hover:bg-blue-600"
                        style={{ height: `${h}%`, minHeight: count > 0 ? '4px' : 0 }}
                      />
                      <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">
                        {month.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-medium text-gray-800 mb-4">Alertes — bloqués &gt; 7 jours</h2>
              {!(stats.blocked_affiliates?.length) ? (
                <p className="text-gray-500 text-sm">Aucun affilié bloqué.</p>
              ) : (
                <ul className="space-y-2">
                  {(stats.blocked_affiliates ?? []).slice(0, 10).map((a) => (
                    <li key={a.id} className="flex items-center justify-between text-sm">
                      <Link to={`/affiliates/${a.id}`} className="text-blue-600 hover:underline">
                        {a.merchant_code} — {a.company_name}
                      </Link>
                      <StatusBadge status={a.status} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-800">Derniers affiliés</h2>
              <Link to="/affiliates" className="text-sm text-blue-600 hover:underline">
                Voir tout
              </Link>
            </div>
            {stats.latest_affiliates && stats.latest_affiliates.length > 0 ? (
              <ul className="space-y-2">
                {stats.latest_affiliates.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <Link to={`/affiliates/${a.id}`} className="text-blue-600 hover:underline">
                      {a.merchant_code} — {a.company_name}
                    </Link>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={a.status} size="sm" />
                      <span className="text-gray-500 text-xs">
                        {getDisplayDate(a.date_creation, a.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">Aucun affilié pour le moment.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
