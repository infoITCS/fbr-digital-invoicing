import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Field, { inputClass } from './components/Field';
import ItemSection from './components/ItemSection';
import ResponsePanel from './components/ResponsePanel';
import AppHeader from './components/AppHeader';
import {
  PROVINCES,
  SCENARIO_OPTIONS,
  createEmptyItem,
  createInitialForm,
} from './constants';
import {
  getErrorPayload,
  saveDraft,
  submitInvoice,
  validateInvoice,
} from './api';
import {
  calcInvoiceTotals,
  formatMoney,
  hasErrors,
  validateForm,
} from './utils/validation';

const LOCKED_STATUSES = new Set([
  'submission_pending',
  'submitted',
  'submission_unknown',
]);

export default function InvoiceFormPage() {
  const [form, setForm] = useState(createInitialForm);
  const [errors, setErrors] = useState({});
  const [invoiceId, setInvoiceId] = useState(null);
  const [status, setStatus] = useState('draft');
  const [fbrInvoiceNumber, setFbrInvoiceNumber] = useState(null);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [resultMessage, setResultMessage] = useState('');
  const [resultError, setResultError] = useState(null);
  const [fbrResponse, setFbrResponse] = useState(null);
  const [fbrHttpStatus, setFbrHttpStatus] = useState(null);
  const [busy, setBusy] = useState(null);

  const totals = useMemo(() => calcInvoiceTotals(form.items), [form.items]);
  const formLocked = busy != null || LOCKED_STATUSES.has(status);

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const applyInvoiceState = (invoice, message, error = null, extras = {}) => {
    if (invoice?._id) setInvoiceId(invoice._id);
    if (invoice?.status) setStatus(invoice.status);
    if (invoice?.fbrInvoiceNumber != null) {
      setFbrInvoiceNumber(invoice.fbrInvoiceNumber);
    }
    if (invoice?.qrCodeData != null) setQrCodeData(invoice.qrCodeData);
    setResultMessage(message || '');
    setResultError(error);
    setFbrResponse(
      extras.fbrResponse ??
        invoice?.submissionResponse ??
        invoice?.validationResponse ??
        null
    );
    setFbrHttpStatus(
      extras.fbrHttpStatus ??
        invoice?.submissionHttpStatus ??
        invoice?.validationHttpStatus ??
        null
    );
  };

  const handleSaveDraft = async () => {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      setResultMessage('Fix validation errors before saving.');
      setResultError({ message: 'Client validation failed' });
      return;
    }

    setBusy('save');
    setResultError(null);
    try {
      const data = await saveDraft(form, invoiceId);
      applyInvoiceState(data.invoice, data.message || 'Draft saved');
    } catch (err) {
      const payload = getErrorPayload(err);
      applyInvoiceState(
        payload.invoice,
        payload.message,
        payload.error || payload,
        { fbrResponse: payload.fbrResponse, fbrHttpStatus: payload.fbrHttpStatus }
      );
    } finally {
      setBusy(null);
    }
  };

  const handleValidate = async () => {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      setResultMessage('Fix validation errors before validating with FBR.');
      setResultError({ message: 'Client validation failed' });
      return;
    }

    setBusy('validate');
    setResultError(null);
    try {
      let id = invoiceId;
      if (!id) {
        const saved = await saveDraft(form);
        id = saved.invoice._id;
        setInvoiceId(id);
        setStatus(saved.invoice.status);
      } else {
        // Persist latest form edits before validate
        await saveDraft(form, id);
      }
      const data = await validateInvoice(id, form);
      const failed = data.invoice?.status === 'validation_failed';
      applyInvoiceState(
        data.invoice,
        data.message ||
          (failed
            ? 'FBR validation failed'
            : 'FBR validation succeeded (sandbox)'),
        failed ? { message: data.message } : null,
        { fbrResponse: data.fbrResponse, fbrHttpStatus: data.fbrHttpStatus }
      );
    } catch (err) {
      const payload = getErrorPayload(err);
      applyInvoiceState(
        payload.invoice,
        payload.message,
        payload.error || payload,
        { fbrResponse: payload.fbrResponse, fbrHttpStatus: payload.fbrHttpStatus }
      );
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = async () => {
    if (status === 'submitted') {
      setResultMessage(
        'Invoice already submitted successfully. Duplicate submission blocked.'
      );
      setResultError({ message: 'Already submitted' });
      return;
    }
    if (status === 'submission_unknown') {
      setResultMessage(
        'Previous submission is submission_unknown. Reconcile with FBR before retrying.'
      );
      setResultError({
        message: 'submission_unknown — reconciliation required',
        uncertain: true,
      });
      return;
    }
    if (status !== 'validated') {
      setResultMessage(
        'Validate with FBR successfully before submitting. Current status: ' +
          status
      );
      setResultError({ message: 'Not validated' });
      return;
    }
    if (!invoiceId) {
      setResultMessage('Save and validate the invoice before submitting.');
      setResultError({ message: 'Missing invoice id' });
      return;
    }

    setBusy('submit');
    setResultError(null);
    try {
      const data = await submitInvoice(invoiceId);
      const ok = data.invoice?.status === 'submitted';
      applyInvoiceState(
        data.invoice,
        data.message ||
          (ok
            ? 'Invoice submitted successfully to FBR sandbox'
            : 'Submission did not confirm success'),
        ok ? null : { message: data.message },
        { fbrResponse: data.fbrResponse, fbrHttpStatus: data.fbrHttpStatus }
      );
    } catch (err) {
      const payload = getErrorPayload(err);
      applyInvoiceState(
        payload.invoice,
        payload.message,
        payload.error || payload,
        { fbrResponse: payload.fbrResponse, fbrHttpStatus: payload.fbrHttpStatus }
      );
    } finally {
      setBusy(null);
    }
  };

  const canSave =
    busy == null &&
    status !== 'submitted' &&
    status !== 'submission_pending' &&
    status !== 'submission_unknown';
  const canValidate =
    busy == null &&
    status !== 'submitted' &&
    status !== 'submission_pending' &&
    status !== 'submission_unknown';
  const canSubmit = busy == null && status === 'validated';

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f0f4f8_0%,#ffffff_28%,#f8fafc_100%)]">
      <AppHeader statusLabel={status} />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
              Invoice Details
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
            <Field label="Invoice Type" name="invoiceType" required>
              <input
                id="invoiceType"
                className={inputClass()}
                value={form.invoiceType}
                disabled
                readOnly
              />
            </Field>
            <Field
              label="Invoice Date"
              name="invoiceDate"
              required
              error={errors.invoiceDate}
            >
              <input
                id="invoiceDate"
                type="date"
                className={inputClass(errors.invoiceDate)}
                value={form.invoiceDate}
                disabled={formLocked}
                onChange={(e) => updateField('invoiceDate', e.target.value)}
              />
            </Field>
            <Field
              label="Scenario ID"
              name="scenarioId"
              required
              error={errors.scenarioId}
              hint="Required for sandbox testing"
            >
              <select
                id="scenarioId"
                className={inputClass(errors.scenarioId)}
                value={form.scenarioId}
                disabled={formLocked}
                onChange={(e) => updateField('scenarioId', e.target.value)}
              >
                {SCENARIO_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Invoice Reference Number" name="invoiceRefNo">
              <input
                id="invoiceRefNo"
                className={inputClass()}
                value={form.invoiceRefNo}
                disabled={formLocked}
                onChange={(e) => updateField('invoiceRefNo', e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
              Seller Details
            </h2>
            <p className="text-xs text-slate-500">
              Pre-filled with ITCS defaults — editable
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
            <Field
              label="Seller NTN/CNIC"
              name="sellerNTNCNIC"
              required
              error={errors.sellerNTNCNIC}
            >
              <input
                id="sellerNTNCNIC"
                className={inputClass(errors.sellerNTNCNIC)}
                value={form.sellerNTNCNIC}
                disabled={formLocked}
                onChange={(e) => updateField('sellerNTNCNIC', e.target.value)}
              />
            </Field>
            <Field
              label="Seller Business Name"
              name="sellerBusinessName"
              required
              error={errors.sellerBusinessName}
            >
              <input
                id="sellerBusinessName"
                className={inputClass(errors.sellerBusinessName)}
                value={form.sellerBusinessName}
                disabled={formLocked}
                onChange={(e) =>
                  updateField('sellerBusinessName', e.target.value)
                }
              />
            </Field>
            <Field
              label="Seller Province"
              name="sellerProvince"
              required
              error={errors.sellerProvince}
            >
              <select
                id="sellerProvince"
                className={inputClass(errors.sellerProvince)}
                value={form.sellerProvince}
                disabled={formLocked}
                onChange={(e) => updateField('sellerProvince', e.target.value)}
              >
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Seller Address"
              name="sellerAddress"
              required
              error={errors.sellerAddress}
            >
              <input
                id="sellerAddress"
                className={inputClass(errors.sellerAddress)}
                value={form.sellerAddress}
                disabled={formLocked}
                onChange={(e) => updateField('sellerAddress', e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
              Buyer Details
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
            <Field
              label="Buyer NTN/CNIC"
              name="buyerNTNCNIC"
              required={form.buyerRegistrationType === 'Registered'}
              error={errors.buyerNTNCNIC}
            >
              <input
                id="buyerNTNCNIC"
                className={inputClass(errors.buyerNTNCNIC)}
                value={form.buyerNTNCNIC}
                disabled={formLocked}
                onChange={(e) => updateField('buyerNTNCNIC', e.target.value)}
              />
            </Field>
            <Field
              label="Buyer Business Name"
              name="buyerBusinessName"
              required
              error={errors.buyerBusinessName}
            >
              <input
                id="buyerBusinessName"
                className={inputClass(errors.buyerBusinessName)}
                value={form.buyerBusinessName}
                disabled={formLocked}
                onChange={(e) =>
                  updateField('buyerBusinessName', e.target.value)
                }
              />
            </Field>
            <Field
              label="Buyer Province"
              name="buyerProvince"
              required
              error={errors.buyerProvince}
            >
              <select
                id="buyerProvince"
                className={inputClass(errors.buyerProvince)}
                value={form.buyerProvince}
                disabled={formLocked}
                onChange={(e) => updateField('buyerProvince', e.target.value)}
              >
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Buyer Address"
              name="buyerAddress"
              required
              error={errors.buyerAddress}
            >
              <input
                id="buyerAddress"
                className={inputClass(errors.buyerAddress)}
                value={form.buyerAddress}
                disabled={formLocked}
                onChange={(e) => updateField('buyerAddress', e.target.value)}
              />
            </Field>
            <Field
              label="Buyer Registration Type"
              name="buyerRegistrationType"
              required
              error={errors.buyerRegistrationType}
            >
              <select
                id="buyerRegistrationType"
                className={inputClass(errors.buyerRegistrationType)}
                value={form.buyerRegistrationType}
                disabled={formLocked}
                onChange={(e) =>
                  updateField('buyerRegistrationType', e.target.value)
                }
              >
                <option value="Registered">Registered</option>
                <option value="Unregistered">Unregistered</option>
              </select>
            </Field>
          </div>
        </section>

        <ItemSection
          items={form.items}
          itemErrors={errors.itemErrors}
          disabled={formLocked}
          onChangeItem={(index, nextItem) => {
            setForm((prev) => {
              const items = [...prev.items];
              items[index] = nextItem;
              return { ...prev, items };
            });
          }}
          onAddItem={() =>
            setForm((prev) => ({
              ...prev,
              items: [...prev.items, createEmptyItem()],
            }))
          }
          onRemoveItem={(index) =>
            setForm((prev) => ({
              ...prev,
              items: prev.items.filter((_, i) => i !== index),
            }))
          }
        />

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <TotalChip label="Excl. ST" value={totals.valueSalesExcludingST} />
            <TotalChip label="Sales Tax" value={totals.salesTaxApplicable} />
            <TotalChip label="Further Tax" value={totals.furtherTax} />
            <TotalChip label="Extra Tax" value={totals.extraTax} />
            <TotalChip label="Discount" value={totals.discount} />
            <TotalChip label="Total" value={totals.totalValues} emphasize />
          </div>

          <p className="mb-3 text-xs text-slate-500">
            Flow: Save Draft → Validate with FBR → Submit to FBR. Submit is
            enabled only when status is <span className="font-mono">validated</span>.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={!canSave}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'save' ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={handleValidate}
              disabled={!canValidate}
              className="rounded border border-teal-700 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'validate' ? 'Validating…' : 'Validate with FBR'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'submit' ? 'Submitting…' : 'Submit to FBR'}
            </button>
          </div>
          {errors.items ? (
            <p className="mt-2 text-xs text-red-600">{errors.items}</p>
          ) : null}
        </section>

        <ResponsePanel
          invoiceId={invoiceId}
          status={status}
          fbrInvoiceNumber={fbrInvoiceNumber}
          qrCodeData={qrCodeData}
          message={resultMessage}
          error={resultError}
          fbrResponse={fbrResponse}
          fbrHttpStatus={fbrHttpStatus}
        />

        {status === 'submitted' ? (
          <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Invoice submitted to FBR.{' '}
            <Link
              to="/dashboard"
              className="font-semibold underline hover:text-emerald-950"
            >
              View on Dashboard
            </Link>
          </p>
        ) : null}
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        ITCS Digital Invoicing · SANDBOX · Bearer token never sent to the browser
      </footer>
    </div>
  );
}

function TotalChip({ label, value, emphasize }) {
  return (
    <div
      className={`rounded border px-3 py-2 ${
        emphasize ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`font-mono text-sm ${
          emphasize ? 'font-bold text-teal-900' : 'text-slate-800'
        }`}
      >
        {formatMoney(value)}
      </p>
    </div>
  );
}
