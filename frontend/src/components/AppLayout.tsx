import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Upload,
  Settings,
  LogOut,
  BookOpen,
} from 'lucide-react';

export function AppLayout() {
  const { user, logout, hasAnyRole } = useAuth();
  const location = useLocation();

  const navItems: { to: string; label: string; icon: typeof LayoutDashboard }[] = [
    { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { to: '/affiliates', label: 'Affiliés', icon: Users },
  ];
  if (hasAnyRole(['SUPER_ADMIN', 'ADMIN', 'SUPPORT'])) {
    navItems.push({ to: '/import', label: 'Importer', icon: Upload });
  }
  if (hasAnyRole(['SUPER_ADMIN', 'ADMIN'])) {
    navItems.push({ to: '/users', label: 'Utilisateurs', icon: UserCog });
    navItems.push({ to: '/config', label: 'Configuration', icon: Settings });
    navItems.push({ to: '/api-reference', label: 'API Reference', icon: BookOpen });
  }
  const nav = navItems;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-56 bg-slate-800 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="font-semibold text-lg">PSP Onboarding</h1>
        </div>
        <nav className="p-2 flex-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-1 ${
                location.pathname === item.to || (item.to !== '/dashboard' && location.pathname.startsWith(item.to))
                  ? 'bg-slate-600'
                  : 'hover:bg-slate-700'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-slate-700">
          <div className="px-3 py-2 text-sm text-slate-300">
            {user?.firstName} {user?.lastName}
          </div>
          <div className="px-3 py-1 text-xs text-slate-400">{user?.role}</div>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 mt-2 w-full rounded-lg hover:bg-slate-700 text-left"
          >
            <LogOut className="w-5 h-5" />
            Déconnexion
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
