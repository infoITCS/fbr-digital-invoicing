import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { getInvoice } from '../api';
import { getScenarioLabel } from '../constants';
import { formatMoney } from '../utils/validation';
import { getStatusLabel } from '../utils/statusLabels';

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function Section({ title, children, actions }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white print:break-inside-avoid">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
          {title}
        </h2>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function FieldGrid({ rows }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </dt>
          <dd className="mt-0.5 break-words text-sm text-slate-900">
            {value === '' || value == null ? '—' : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function JsonPanel({ title, value, defaultOpen }) {
  if (value == null) {
    return (
      <p className="text-xs text-slate-500">{title}: none stored</p>
    );
  }
  return (
    <details className="rounded border border-slate-200" open={defaultOpen}>
      <summary className="cursor-pointer bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
        {title}
      </summary>
      <pre className="max-h-96 overflow-auto p-3 text-xs text-slate-800">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

const ITEM_FIELDS = [
  ['Description', 'productDescription'],
  ['HS code', 'hsCode'],
  ['Quantity', 'quantity'],
  ['Unit', 'uoM'],
  ['Price per unit', 'unitPrice'],
  ['Amount before tax', 'valueSalesExcludingST'],
  ['Sales tax rate', 'rate'],
  ['Sales tax', 'salesTaxApplicable'],
  ['Line total', 'totalValues'],
  ['Sale category', 'saleType'],
  ['Discount', 'discount'],
  ['Further tax', 'furtherTax'],
  ['Extra tax', 'extraTax'],
  ['FED payable', 'fedPayable'],
  ['Tax withheld at source', 'salesTaxWithheldAtSource'],
  ['Notified / retail price', 'fixedNotifiedValueOrRetailPrice'],
  ['SRO / schedule', 'sroScheduleNo'],
  ['SRO item serial', 'sroItemSerialNo'],
];

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getInvoice(id);
      setInvoice(data.invoice);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = invoice?.totals || {};

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f0f4f8_0%,#ffffff_28%,#f8fafc_100%)]">
      <div className="print:hidden">
        <AppHeader statusLabel={getStatusLabel(invoice?.status)} />
      </div>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Invoice details</h2>
            <p className="text-sm text-slate-500">
              Saved invoice record. This is not the official FBR / IRIS portal.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/dashboard"
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              ← Dashboard
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded border border-teal-700 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-100"
            >
              Print / PDF
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {loading && !invoice ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : null}

        {invoice ? (
          <>
            <Section title="Invoice">
              <FieldGrid
                rows={[
                  ['Invoice type', invoice.invoiceType],
                  ['Invoice date', invoice.invoiceDate],
                  ['Tax scenario', getScenarioLabel(invoice.scenarioId)],
                  ['Your invoice number', invoice.invoiceRefNo || '—'],
                  [
                    'FBR invoice number',
                    invoice.fbrInvoiceNumberDisplay ||
                      invoice.fbrInvoiceNumber ||
                      'Not yet issued',
                  ],
                  ['Status', getStatusLabel(invoice.status)],
                  ['Checked with FBR at', formatDateTime(invoice.validatedAt)],
                  ['Sent to FBR at', formatDateTime(invoice.submittedAt)],
                ]}
              />
            </Section>

            <Section title="From (seller)">
              <FieldGrid
                rows={[
                  ['NTN / CNIC', invoice.sellerNTNCNIC],
                  ['Business name', invoice.sellerBusinessName],
                  ['Province', invoice.sellerProvince],
                  ['Address', invoice.sellerAddress],
                ]}
              />
            </Section>

            <Section title="Bill to (buyer)">
              <FieldGrid
                rows={[
                  ['NTN / CNIC', invoice.buyerNTNCNIC],
                  ['Business name', invoice.buyerBusinessName],
                  ['Province', invoice.buyerProvince],
                  ['Address', invoice.buyerAddress],
                  ['STRN status', invoice.buyerRegistrationType],
                ]}
              />
            </Section>

            <Section title="Items">
              {(invoice.items || []).length === 0 ? (
                <p className="text-sm text-slate-500">No items stored.</p>
              ) : (
                <div className="space-y-4">
                  {invoice.items.map((item, index) => (
                    <div
                      key={index}
                      className="rounded border border-slate-100 bg-slate-50/50 p-3"
                    >
                      <h3 className="mb-3 text-sm font-semibold text-teal-900">
                        Item {index + 1}
                      </h3>
                      <FieldGrid
                        rows={ITEM_FIELDS.map(([label, key]) => [
                          label,
                          item[key] === '' || item[key] == null
                            ? '—'
                            : item[key],
                        ])}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Totals">
              <p className="mb-3 text-xs text-slate-500">
                Amounts saved with this invoice.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ['Amount before tax', totals.valueSalesExcludingST],
                  ['Sales tax', totals.salesTaxApplicable],
                  ['Further tax', totals.furtherTax],
                  ['Extra tax', totals.extraTax],
                  ['Discount', totals.discount],
                  ['Invoice total', totals.totalValues],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <p className="text-[10px] font-semibold uppercase text-slate-500">
                      {label}
                    </p>
                    <p className="font-mono text-sm font-semibold text-slate-900">
                      {formatMoney(value)}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="FBR check and send (technical)">
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  For IT or audit. You can ignore this unless something went
                  wrong.
                </p>
                <JsonPanel
                  title="What we sent for the FBR check"
                  value={invoice.validationRequestPayload}
                />
                <JsonPanel
                  title="FBR check reply"
                  value={invoice.validationResponse}
                  defaultOpen={!invoice.submissionResponse}
                />
                <JsonPanel
                  title="What we sent when submitting"
                  value={invoice.submissionRequestPayload}
                />
                <JsonPanel
                  title="FBR send reply"
                  value={invoice.submissionResponse}
                  defaultOpen
                />
                {invoice.qrCodeData != null ? (
                  <JsonPanel title="QR code from FBR" value={invoice.qrCodeData} />
                ) : null}
                {invoice.lastError ? (
                  <JsonPanel title="Last error" value={invoice.lastError} />
                ) : null}
              </div>
            </Section>
          </>
        ) : null}
      </main>
    </div>
  );
}
