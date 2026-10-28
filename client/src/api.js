import axios from 'axios';
import { getApiToken, getMsalInstance, loginRequest } from './auth/msal';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 45000,
});

api.interceptors.request.use(async (config) => {
  // Public auth config endpoint must remain unauthenticated
  if (config.url?.includes('/auth/config')) {
    return config;
  }
  let token = await getApiToken();
  if (!token) {
    const instance = getMsalInstance();
    const account = instance?.getActiveAccount() || instance?.getAllAccounts()?.[0];
    if (instance && account) {
      try {
        const result = await instance.acquireTokenSilent({
          ...loginRequest,
          account,
        });
        token = result.idToken || result.accessToken;
      } catch {
        // Caller will get 401; RequireAuth / login handles re-auth
      }
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Soft signal for UI — do not force redirect here (may interrupt form)
      console.warn(
        '[api]',
        error.response?.data?.code || error.response?.status,
        error.response?.data?.message || error.message
      );
    }
    return Promise.reject(error);
  }
);

export async function checkHealth() {
  const { data } = await api.get('/health');
  return data;
}

export async function saveDraft(form, id) {
  if (id) {
    const { data } = await api.put(`/invoices/${id}`, form);
    return data;
  }
  const { data } = await api.post('/invoices', form);
  return data;
}

export async function validateInvoice(id, form) {
  const { data } = await api.post(`/invoices/${id}/validate`, form);
  return data;
}

export async function submitInvoice(id) {
  // Do not send field updates on submit — backend requires validated snapshot
  const { data } = await api.post(`/invoices/${id}/submit`, {});
  return data;
}

export async function fetchDashboard(params = {}) {
  const { data } = await api.get('/invoices/dashboard', { params });
  return data;
}

export async function getInvoice(id) {
  const { data } = await api.get(`/invoices/${id}`);
  return data;
}

export function getErrorPayload(error) {
  if (error.response?.data) {
    return {
      message: error.response.data.message || error.message,
      error: error.response.data.error || null,
      invoice: error.response.data.invoice || null,
      fbrResponse: error.response.data.fbrResponse || null,
      fbrHttpStatus: error.response.data.fbrHttpStatus ?? null,
      interpretation: error.response.data.interpretation || null,
      errors: error.response.data.errors || null,
    };
  }
  return {
    message: error.message || 'Network error',
    error: null,
    invoice: null,
    fbrResponse: null,
    fbrHttpStatus: null,
    interpretation: null,
    errors: null,
  };
}

export default api;
