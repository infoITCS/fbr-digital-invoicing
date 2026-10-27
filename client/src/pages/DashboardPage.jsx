import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { fetchDashboard } from '../api';
import { formatMoney } from '../utils/validation';

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function StatCard({ label, value, emphasize }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        emphasize
          ? 'border-teal-300 bg-teal-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-lg ${
          emphasize ? 'font-bold text-teal-900' : 'font-semibold text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [unknownSubmissions, setUnknownSubmissions] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchDashboard();
      setStats(data.stats || null);
      setInvoices(data.invoices || []);
      setUnknownSubmissions(data.unknownSubmissions || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f0f4f8_0%,#ffffff_28%,#f8fafc_100%)]">
      <AppHeader />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Submitted invoices
            </h2>
            <p className="text-xs text-slate-500">
              Invoices successfully posted to the FBR sandbox, with summary
              totals.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <Link
              to="/"
              className="rounded bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900"
            >
              + New Invoice
            </Link>
          </div>
        </div>

        {error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {stats ? (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard
              label="Submitted to FBR"
              value={stats.submittedCount}
              emphasize
            />
            <StatCard
              label="Total sales excl. ST"
              value={formatMoney(stats.totalSalesExcludingST)}
            />
            <StatCard
              label="Total sales tax"
              value={formatMoney(stats.totalSalesTax)}
            />
            <StatCard
              label="Total invoice value"
              value={formatMoney(stats.totalInvoiceValue)}
            />
            <StatCard label="Drafts" value={stats.byStatus?.draft ?? 0} />
            <StatCard
              label="Validated (not submitted)"
              value={stats.byStatus?.validated ?? 0}
            />
            <StatCard
              label="Validation failed"
              value={stats.byStatus?.validation_failed ?? 0}
            />
            <StatCard
              label="Submission unknown"
              value={stats.submissionUnknownCount ?? 0}
            />
          </section>
        ) : null}

        {unknownSubmissions.length > 0 ? (
          <section className="rounded-lg border border-orange-300 bg-orange-50 p-4 text-sm text-orange-950">
            <p className="font-semibold">
              {unknownSubmissions.length} submission(s) marked{' '}
              <span className="font-mono">submission_unknown</span>
            </p>
            <p className="mt-1 text-xs">
              These timed out or lost connection after a submit attempt. They
              are not counted as submitted — reconcile with FBR before retrying.
            </p>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">
              Submitted invoices table
            </h3>
          </div>

          {loading && !invoices.length ? (
            <p className="p-4 text-sm text-slate-500">Loading…</p>
          ) : invoices.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <p>No invoices have been submitted to FBR yet.</p>
              <Link
                to="/"
                className="mt-2 inline-block font-semibold text-teal-800 hover:underline"
              >
                Create and submit an invoice
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">FBR invoice #</th>
                    <th className="px-3 py-2 font-semibold">Invoice date</th>
                    <th className="px-3 py-2 font-semibold">Buyer</th>
                    <th className="px-3 py-2 font-semibold">Scenario</th>
                    <th className="px-3 py-2 font-semibold">Items</th>
                    <th className="px-3 py-2 font-semibold">Excl. ST</th>
                    <th className="px-3 py-2 font-semibold">Sales tax</th>
                    <th className="px-3 py-2 font-semibold">Total</th>
                    <th className="px-3 py-2 font-semibold">Submitted at</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2 font-mono text-xs text-slate-900">
                        {inv.fbrInvoiceNumber || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {inv.invoiceDate || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">
                          {inv.buyerBusinessName || '—'}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {inv.buyerNTNCNIC || ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {inv.scenarioId || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {inv.itemCount ?? 0}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {formatMoney(inv.totals?.valueSalesExcludingST)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {formatMoney(inv.totals?.salesTaxApplicable)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs font-semibold">
                        {formatMoney(inv.totals?.totalValues)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {formatDateTime(inv.submittedAt)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        ITCS Digital Invoicing · SANDBOX · Only successfully submitted invoices
        appear in the table
      </footer>
    </div>
  );
}
