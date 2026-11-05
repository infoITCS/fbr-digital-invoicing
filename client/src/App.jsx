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
import {
  MSG,
  humanizeApiError,
  summarizeFormErrors,
} from './utils/userMessages';
import { getStatusLabel } from './utils/statusLabels';

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
  /** Last successful submit — shown after form is cleared for the next invoice */
  const [lastSubmit, setLastSubmit] = useState(null);

  const totals = useMemo(() => calcInvoiceTotals(form.items), [form.items]);
  const formLocked = busy != null || LOCKED_STATUSES.has(status);

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const clearFormForNewEntry = () => {
    setForm(createInitialForm());
    setErrors({});
    setInvoiceId(null);
    setStatus('draft');
    setFbrInvoiceNumber(null);
    setQrCodeData(null);
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
      setResultMessage(
        `${MSG.formIncompleteSave} ${summarizeFormErrors(nextErrors)}`
      );
      setResultError({ message: 'Incomplete form' });
      return;
    }

    setBusy('save');
    setResultError(null);
    try {
      const data = await saveDraft(form, invoiceId);
      applyInvoiceState(data.invoice, MSG.draftSaved);
    } catch (err) {
      const payload = getErrorPayload(err);
      applyInvoiceState(
        payload.invoice,
        humanizeApiError(payload, 'save'),
        payload.error || { message: humanizeApiError(payload, 'save') },
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
      setResultMessage(
        `${MSG.formIncompleteValidate} ${summarizeFormErrors(nextErrors)}`
      );
      setResultError({ message: 'Incomplete form' });
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
        failed ? MSG.validateFail : MSG.validateOk,
        failed
          ? {
              message: humanizeApiError(
                { message: data.message, error: data.error },
                'validate'
              ),
            }
          : null,
        { fbrResponse: data.fbrResponse, fbrHttpStatus: data.fbrHttpStatus }
      );
    } catch (err) {
      const payload = getErrorPayload(err);
      applyInvoiceState(
        payload.invoice,
        humanizeApiError(payload, 'validate'),
        payload.error || { message: humanizeApiError(payload, 'validate') },
        { fbrResponse: payload.fbrResponse, fbrHttpStatus: payload.fbrHttpStatus }
      );
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = async () => {
    if (status === 'submitted') {
      setResultMessage(MSG.alreadySubmitted);
      setResultError({ message: MSG.alreadySubmitted });
      return;
    }
    if (status === 'submission_unknown') {
      setResultMessage(MSG.submissionUnknown);
      setResultError({
        message: MSG.submissionUnknown,
        uncertain: true,
      });
      return;
    }
    if (status !== 'validated') {
      setResultMessage(
        `${MSG.notValidated} (Current step: ${status || 'draft'}.)`
      );
      setResultError({ message: MSG.notValidated });
      return;
    }
    if (!invoiceId) {
      setResultMessage(MSG.missingId);
      setResultError({ message: MSG.missingId });
      return;
    }

    setBusy('submit');
    setResultError(null);
    try {
      const data = await submitInvoice(invoiceId);
      const ok = data.invoice?.status === 'submitted';
      if (ok) {
        const fbrNo = data.invoice.fbrInvoiceNumber ?? null;
        const message = MSG.submitOk(fbrNo);
        setLastSubmit({
          invoiceId: data.invoice._id,
          fbrInvoiceNumber: fbrNo,
          qrCodeData: data.invoice.qrCodeData ?? null,
          message,
          fbrResponse:
            data.fbrResponse ?? data.invoice.submissionResponse ?? null,
          fbrHttpStatus:
            data.fbrHttpStatus ?? data.invoice.submissionHttpStatus ?? null,
        });
        clearFormForNewEntry();
        setResultMessage(message);
        setResultError(null);
        setFbrResponse(
          data.fbrResponse ?? data.invoice.submissionResponse ?? null
        );
        setFbrHttpStatus(
          data.fbrHttpStatus ?? data.invoice.submissionHttpStatus ?? null
        );
      } else {
        applyInvoiceState(
          data.invoice,
          MSG.submitUnconfirmed,
          { message: MSG.submitUnconfirmed },
          { fbrResponse: data.fbrResponse, fbrHttpStatus: data.fbrHttpStatus }
        );
      }
    } catch (err) {
      const payload = getErrorPayload(err);
      applyInvoiceState(
        payload.invoice,
        humanizeApiError(payload, 'submit'),
        {
          ...(payload.error || {}),
          message: humanizeApiError(payload, 'submit'),
          uncertain:
            Boolean(payload.error?.uncertain) ||
            payload.invoice?.status === 'submission_unknown',
        },
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
      <AppHeader statusLabel={getStatusLabel(status)} />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-base font-bold text-slate-900">
            Create an FBR invoice
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Fill in the buyer and items, then follow the three steps at the
            bottom. FBR only receives the invoice when you click Send to FBR.
          </p>
          <ol className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
            <li
              className={`rounded border px-3 py-2 ${
                status === 'draft' || !status
                  ? 'border-teal-300 bg-teal-50 text-teal-950'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <span className="font-bold">1. Save draft</span>
              <span className="mt-0.5 block">Keep your work on this system.</span>
            </li>
            <li
              className={`rounded border px-3 py-2 ${
                status === 'validated'
                  ? 'border-teal-300 bg-teal-50 text-teal-950'
                  : status === 'validation_failed'
                    ? 'border-red-300 bg-red-50 text-red-900'
                    : 'border-slate-200 bg-slate-50'
              }`}
            >
              <span className="font-bold">2. Check with FBR</span>
              <span className="mt-0.5 block">
                FBR confirms the invoice is acceptable.
              </span>
            </li>
            <li
              className={`rounded border px-3 py-2 ${
                status === 'submitted'
                  ? 'border-teal-300 bg-teal-50 text-teal-950'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <span className="font-bold">3. Send to FBR</span>
              <span className="mt-0.5 block">
                Official submission — only after a successful check.
              </span>
            </li>
          </ol>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
              Invoice
            </h2>
            <p className="text-xs text-slate-500">
              Date, tax scenario, and your own reference number.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
            <Field label="Invoice type" name="invoiceType" required>
              <input
                id="invoiceType"
                className={inputClass()}
                value={form.invoiceType}
                disabled
                readOnly
              />
            </Field>
            <Field
              label="Invoice date"
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
              label="Tax scenario"
              name="scenarioId"
              required
              error={errors.scenarioId}
              hint="Choose the type of sale. This tells FBR which tax rules apply."
            >
              <select
                id="scenarioId"
                className={inputClass(errors.scenarioId)}
                value={form.scenarioId}
                disabled={formLocked}
                onChange={(e) => updateField('scenarioId', e.target.value)}
              >
                {SCENARIO_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id})
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Your invoice number"
              name="invoiceRefNo"
              optional
              hint="Optional internal reference. FBR will issue its own number after you send."
            >
              <input
                id="invoiceRefNo"
                className={inputClass()}
                value={form.invoiceRefNo}
                disabled={formLocked}
                placeholder="e.g. INV-2026-001"
                onChange={(e) => updateField('invoiceRefNo', e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
              From (seller)
            </h2>
            <p className="text-xs text-slate-500">
              Pre-filled for ITCS. Change only if needed.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
            <Field
              label="Seller NTN / CNIC"
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
              label="Business name"
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
              label="Province"
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
              label="Address"
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
              Bill to (buyer)
            </h2>
            <p className="text-xs text-slate-500">
              Who is being invoiced. Registered buyers need an NTN or CNIC.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
            <Field
              label="Buyer NTN / CNIC"
              name="buyerNTNCNIC"
              required={form.buyerRegistrationType === 'Registered'}
              error={errors.buyerNTNCNIC}
              hint={
                form.buyerRegistrationType === 'Unregistered'
                  ? 'Not required for unregistered buyers.'
                  : undefined
              }
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
              label="Business name"
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
              label="Province"
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
              label="Address"
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
              label="Buyer STRN status"
              hint="Registered = has a sales tax number. Unregistered = consumer / no STRN."
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
          <h3 className="mb-3 text-sm font-bold text-slate-800">Invoice totals</h3>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <TotalChip
              label="Amount before tax"
              value={totals.valueSalesExcludingST}
            />
            <TotalChip label="Sales tax" value={totals.salesTaxApplicable} />
            <TotalChip label="Further tax" value={totals.furtherTax} />
            <TotalChip label="Extra tax" value={totals.extraTax} />
            <TotalChip label="Discount" value={totals.discount} />
            <TotalChip label="Invoice total" value={totals.totalValues} emphasize />
          </div>

          <p className="mb-3 text-xs text-slate-500">
            Send to FBR stays locked until FBR accepts the check in step 2.
            Current status: {getStatusLabel(status)}.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={!canSave}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'save' ? 'Saving…' : '1. Save draft'}
            </button>
            <button
              type="button"
              onClick={handleValidate}
              disabled={!canValidate}
              className="rounded border border-teal-700 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'validate' ? 'Checking with FBR…' : '2. Check with FBR'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'submit' ? 'Sending…' : '3. Send to FBR'}
            </button>
          </div>
          {errors.items ? (
            <p className="mt-2 text-xs text-red-600">{errors.items}</p>
          ) : null}
        </section>

        <ResponsePanel
          invoiceId={lastSubmit?.invoiceId ?? invoiceId}
          status={lastSubmit && !invoiceId ? 'submitted' : status}
          fbrInvoiceNumber={
            lastSubmit && !invoiceId
              ? lastSubmit.fbrInvoiceNumber
              : fbrInvoiceNumber
          }
          qrCodeData={
            lastSubmit && !invoiceId ? lastSubmit.qrCodeData : qrCodeData
          }
          message={resultMessage}
          error={resultError}
          fbrResponse={fbrResponse}
          fbrHttpStatus={fbrHttpStatus}
        />

        {lastSubmit ? (
          <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Last invoice was sent to FBR
            {lastSubmit.fbrInvoiceNumber
              ? ` (FBR number ${lastSubmit.fbrInvoiceNumber})`
              : ''}
            . This form is ready for a new invoice.{' '}
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
        ITCS Digital Invoicing — invoices are sent to FBR only after you check and send.
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
