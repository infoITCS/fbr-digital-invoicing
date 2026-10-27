import { PublicClientApplication, EventType } from '@azure/msal-browser';

let msalInstance = null;
let authConfig = null;

export async function loadAuthConfig() {
  const base = import.meta.env.VITE_API_BASE_URL || '/api';
  const res = await fetch(`${base}/auth/config`);
  if (!res.ok) {
    throw new Error('Failed to load Microsoft sign-in configuration');
  }
  authConfig = await res.json();
  return authConfig;
}

export function getAuthConfig() {
  return authConfig;
}

export async function initMsal() {
  const config = await loadAuthConfig();
  if (!config.enabled || !config.clientId || !config.tenantId) {
    return null;
  }

  msalInstance = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: config.authority,
      redirectUri: window.location.origin,
      postLogoutRedirectUri: window.location.origin,
      navigateToLoginRequestUrl: true,
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
    },
  });

  await msalInstance.initialize();
  await msalInstance.handleRedirectPromise();

  // Keep active account in sync
  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
      msalInstance.setActiveAccount(event.payload.account);
    }
  });

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length && !msalInstance.getActiveAccount()) {
    msalInstance.setActiveAccount(accounts[0]);
  }

  return msalInstance;
}

export function getMsalInstance() {
  return msalInstance;
}

/** Scopes for interactive login (OpenID + profile) */
export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
};

/**
 * ID token is validated by our API (audience = app client ID, tid = our tenant).
 * Prefer silent refresh; fall back to redirect only when caller allows.
 */
export async function getApiToken() {
  const instance = getMsalInstance();
  if (!instance) return null;
  const account = instance.getActiveAccount() || instance.getAllAccounts()[0];
  if (!account) return null;

  try {
    const result = await instance.acquireTokenSilent({
      ...loginRequest,
      account,
    });
    return result.idToken || result.accessToken || null;
  } catch {
    return null;
  }
}
