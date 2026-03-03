import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AffiliatesPage } from './pages/AffiliatesPage';
import { AffiliateDetailPage } from './pages/AffiliateDetailPage';
import { NewAffiliatePage } from './pages/NewAffiliatePage';
import { ImportPage } from './pages/ImportPage';
import { ConfigPage } from './pages/ConfigPage';
import { UsersPage } from './pages/UsersPage';
import { ApiReferencePage } from './pages/ApiReferencePage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="affiliates" element={<AffiliatesPage />} />
            <Route path="affiliates/new" element={<NewAffiliatePage />} />
            <Route path="affiliates/:id" element={<AffiliateDetailPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="config" element={<ConfigPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="api-reference" element={<ProtectedRoute requiredRole={['ADMIN', 'SUPER_ADMIN']}><ApiReferencePage /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
