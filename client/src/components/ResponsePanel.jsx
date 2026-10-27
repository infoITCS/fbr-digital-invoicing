function statusBadgeClass(status) {
  switch (status) {
    case 'submitted':
    case 'validated':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'validation_failed':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'submission_pending':
      return 'bg-amber-100 text-amber-900 border-amber-300';
    case 'submission_unknown':
      return 'bg-orange-100 text-orange-900 border-orange-300';
    case 'draft':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300';
  }
}

function extractFbrMessages(fbrResponse) {
  if (!fbrResponse) return [];
  const messages = [];
  const vr = fbrResponse.validationResponse || fbrResponse;

  if (vr?.error) {
    messages.push({
      level: 'error',
      text: `${vr.errorCode ? `[${vr.errorCode}] ` : ''}${vr.error}`,
    });
  }

  if (vr?.status) {
    messages.push({
      level: String(vr.status).toLowerCase() === 'valid' ? 'ok' : 'info',
      text: `FBR status: ${vr.status}${vr.statusCode ? ` (${vr.statusCode})` : ''}`,
    });
  }

  const items = vr?.invoiceStatuses;
  if (Array.isArray(items)) {
    items.forEach((item) => {
      if (item.error) {
        messages.push({
          level: 'error',
          text: `Item ${item.itemSNo || '?'}: ${item.errorCode ? `[${item.errorCode}] ` : ''}${item.error}`,
        });
      } else if (item.status) {
        messages.push({
          level: String(item.status).toLowerCase() === 'valid' ? 'ok' : 'info',
          text: `Item ${item.itemSNo || '?'}: ${item.status}${item.invoiceNo ? ` — ${item.invoiceNo}` : ''}`,
        });
      }
    });
  }

  return messages;
}

export default function ResponsePanel({
  invoiceId,
  status,
  fbrInvoiceNumber,
  qrCodeData,
  message,
  error,
  fbrResponse,
  fbrHttpStatus,
}) {
  if (!invoiceId && !message && !error && !fbrResponse) return null;

  const fbrMessages = extractFbrMessages(fbrResponse);
  const uncertain =
    error?.uncertain || status === 'submission_unknown';

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
          Result
        </h2>
      </div>

      <div className="space-y-3 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          {invoiceId ? (
            <p className="text-slate-600">
              Local ID:{' '}
              <span className="font-mono text-xs text-slate-900">{invoiceId}</span>
            </p>
          ) : null}
          {status ? (
            <span
              className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(status)}`}
            >
              {status}
            </span>
          ) : null}
          {fbrHttpStatus != null ? (
            <span className="text-xs text-slate-500">
              FBR HTTP {fbrHttpStatus}
            </span>
          ) : null}
        </div>

        {message ? (
          <p
            className={`rounded border px-3 py-2 ${
              error || status === 'validation_failed'
                ? 'border-red-200 bg-red-50 text-red-800'
                : status === 'submitted'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-slate-50 text-slate-800'
            }`}
          >
            {message}
          </p>
        ) : null}

        {uncertain ? (
          <div className="space-y-2 rounded border border-orange-300 bg-orange-50 px-3 py-2 text-orange-900">
            <p className="font-semibold">submission_unknown</p>
            <p>
              The submit request may have reached FBR, but no reliable response
              was received (timeout / connection loss). Automatic retry is
              disabled. Inspect the raw exchange below, check FBR sandbox
              facilities with your sandbox credentials, then reconcile before
              any manual retry.
            </p>
          </div>
        ) : null}

        {fbrMessages.length || error?.fbrBody ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">
              FBR messages (actual)
            </p>
            {fbrMessages.length === 0 && error?.message ? (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                {error.message}
              </p>
            ) : null}
            {fbrMessages.map((m, i) => (
              <p
                key={i}
                className={`rounded border px-3 py-2 ${
                  m.level === 'error'
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : m.level === 'ok'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                {m.text}
              </p>
            ))}
          </div>
        ) : null}

        {fbrInvoiceNumber ? (
          <p className="text-slate-800">
            FBR Invoice Number:{' '}
            <span className="font-mono font-semibold">{fbrInvoiceNumber}</span>
          </p>
        ) : null}

        {qrCodeData != null ? (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
              QR Code Data (as returned)
            </p>
            <pre className="overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800">
              {typeof qrCodeData === 'string'
                ? qrCodeData
                : JSON.stringify(qrCodeData, null, 2)}
            </pre>
          </div>
        ) : null}

        {fbrResponse ? (
          <details className="rounded border border-slate-200" open={status === 'validation_failed' || uncertain}>
            <summary className="cursor-pointer bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              Full FBR response (raw, preserved)
            </summary>
            <pre className="max-h-80 overflow-auto p-3 text-xs text-slate-800">
              {JSON.stringify(fbrResponse, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    </section>
  );
}
