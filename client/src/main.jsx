import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import './index.css';
import InvoiceFormPage from './App.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import InvoiceDetailPage from './pages/InvoiceDetailPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import { initMsal, getAuthConfig } from './auth/msal';

function Root() {
  const [msalInstance, setMsalInstance] = useState(null);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const instance = await initMsal();
        if (!cancelled) {
          setMsalInstance(instance);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setBootError(err.message || 'Failed to start authentication');
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Loading…
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {bootError}
        </p>
      </div>
    );
  }

  const config = getAuthConfig();
  if (!config?.enabled || !msalInstance) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
          <p className="font-semibold">Microsoft sign-in required</p>
          <p className="mt-2">
            Set <code className="font-mono">AZURE_AD_TENANT_ID</code> and{' '}
            <code className="font-mono">AZURE_AD_CLIENT_ID</code> in{' '}
            <code className="font-mono">server/.env</code>, then restart the
            API.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <InvoiceFormPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/invoices/:id"
            element={
              <RequireAuth>
                <InvoiceDetailPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </MsalProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
