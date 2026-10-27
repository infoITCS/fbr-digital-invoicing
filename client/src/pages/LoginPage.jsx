import { useEffect, useState } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { Navigate, useLocation } from 'react-router-dom';
import { loginRequest, getAuthConfig } from '../auth/msal';

export default function LoginPage() {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const location = useLocation();
  const [error, setError] = useState('');
  const config = getAuthConfig();
  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (!config?.enabled) {
      setError(
        'Microsoft sign-in is not configured. Set AZURE_AD_TENANT_ID and AZURE_AD_CLIENT_ID on the server.'
      );
    }
  }, [config]);

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const busy = inProgress !== InteractionStatus.None;

  const handleSignIn = async () => {
    setError('');
    try {
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      setError(err.message || 'Microsoft sign-in failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#0f3d3e_0%,#1a5c5e_40%,#f0f4f8_40%,#f8fafc_100%)] px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
          ITCS
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          FBR Digital Invoicing
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with your organization Microsoft account. Only users from the
          ITCS Microsoft tenant can access this application.
        </p>

        <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
          SANDBOX ENVIRONMENT
        </div>

        {error ? (
          <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy || !config?.enabled}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded bg-[#2f2f2f] px-4 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MicrosoftIcon />
          {busy ? 'Redirecting…' : 'Sign in with Microsoft'}
        </button>

        <p className="mt-4 text-center text-[11px] text-slate-500">
          Accounts outside your company tenant are rejected by the server.
        </p>
      </div>
    </div>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
