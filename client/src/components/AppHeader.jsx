import { NavLink } from 'react-router-dom';
import { useMsal, useAccount } from '@azure/msal-react';

const linkClass = ({ isActive }) =>
  `rounded px-3 py-1.5 text-xs font-semibold transition ${
    isActive
      ? 'bg-teal-800 text-white'
      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
  }`;

export default function AppHeader({ statusLabel }) {
  const { instance } = useMsal();
  const account = useAccount(instance.getActiveAccount() || undefined);

  const handleSignOut = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin,
    });
  };

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
            ITCS
          </p>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            FBR Digital Invoicing
          </h1>
          <p className="text-xs text-slate-500">
            IT Consulting and Services — Sandbox only
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex gap-2">
            <NavLink to="/" end className={linkClass}>
              New Invoice
            </NavLink>
            <NavLink to="/dashboard" className={linkClass}>
              Dashboard
            </NavLink>
          </nav>
          <div className="flex flex-col items-end gap-1">
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold tracking-wide text-amber-950">
              SANDBOX
            </div>
            {statusLabel ? (
              <p className="text-[11px] text-slate-500">
                Status: <span className="font-mono">{statusLabel}</span>
              </p>
            ) : null}
            {account ? (
              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <span className="max-w-[180px] truncate" title={account.username}>
                  {account.name || account.username}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded border border-slate-300 px-2 py-0.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
