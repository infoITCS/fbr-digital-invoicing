/** Plain-language messages for the invoice form (team / non-technical users). */

const FIELD_LABELS = {
  invoiceDate: 'invoice date',
  scenarioId: 'scenario',
  sellerNTNCNIC: 'seller NTN/CNIC',
  sellerBusinessName: 'seller business name',
  sellerProvince: 'seller province',
  sellerAddress: 'seller address',
  buyerNTNCNIC: 'buyer NTN/CNIC',
  buyerBusinessName: 'buyer business name',
  buyerProvince: 'buyer province',
  buyerAddress: 'buyer address',
  buyerRegistrationType: 'buyer registration type',
  items: 'invoice items',
};

/**
 * Summarize client-side form errors into one readable sentence.
 */
export function summarizeFormErrors(errors = {}) {
  const parts = [];
  for (const [key, label] of Object.entries(FIELD_LABELS)) {
    if (key === 'items') continue;
    if (errors[key]) parts.push(label);
  }
  if (errors.items) parts.push('at least one product/service line');
  if (errors.itemErrors?.length) {
    const lines = errors.itemErrors
      .map((e) => `line ${(e.index ?? 0) + 1}`)
      .join(', ');
    parts.push(`product details on ${lines}`);
  }
  if (!parts.length) {
    return 'Some fields are incomplete or incorrect. Please check the form (red messages) and try again.';
  }
  return `Please complete or correct: ${parts.join(', ')}. Then try again.`;
}

const CODE_MESSAGES = {
  FBR_TIMEOUT: {
    validate:
      'FBR did not reply in time. Your invoice was not confirmed. Wait a moment, then click “Validate with FBR” again.',
    submit:
      'FBR did not reply in time after we sent the invoice. It may or may not have been received. Do not click Submit again — check the Dashboard or ask your admin to confirm with FBR first.',
    save: 'The request timed out. Check your internet connection and try saving again.',
  },
  FBR_NO_RESPONSE: {
    validate:
      'Could not reach FBR. Check your internet connection, then click “Validate with FBR” again.',
    submit:
      'We lost contact with FBR while submitting. The invoice may or may not have been received. Do not submit again until this is checked with FBR (see Dashboard).',
    save: 'Could not reach the server. Check your internet connection and try again.',
  },
  FBR_AUTH_ERROR: {
    validate:
      'FBR rejected our login token (unauthorized). Ask your admin to check the FBR sandbox token on the server.',
    submit:
      'FBR rejected our login token (unauthorized). Ask your admin to check the FBR sandbox token on the server. This invoice was not submitted.',
    save: 'You are not authorized. Sign out and sign in again with Microsoft.',
  },
  FBR_HTTP_ERROR: {
    validate:
      'FBR returned an error while checking this invoice. See the FBR messages below, fix the form if needed, then validate again.',
    submit:
      'FBR returned an error and did not accept this invoice. See the FBR messages below. Fix the issue, validate again, then submit.',
    save: 'The server returned an error. Please try again or contact your admin.',
  },
  FBR_SUBMISSION_REJECTED: {
    submit:
      'FBR rejected this invoice. It was not submitted. Read the FBR messages below, correct the details, validate again, then submit.',
  },
  FBR_UNEXPECTED_RESPONSE: {
    validate:
      'FBR sent an unexpected reply, so we could not confirm the invoice. Try Validate again. If it keeps happening, contact your admin.',
    submit:
      'FBR sent an unexpected reply, so we could not confirm submission. Do not assume it was submitted — check with your admin.',
  },
};

function messageForCode(code, context) {
  const entry = CODE_MESSAGES[code];
  if (!entry) return null;
  return entry[context] || entry.submit || entry.validate || entry.save || null;
}

function humanizeByRawMessage(raw, context, payload) {
  const m = String(raw || '').toLowerCase();

  if (/already submitted|duplicate submission/.test(m)) {
    return 'This invoice was already sent to FBR successfully. You do not need to submit it again. Open the Dashboard to view it, or start a new invoice on this form.';
  }
  if (/submission_unknown|reconcile/.test(m)) {
    return 'The last submit attempt did not get a clear answer from FBR. Do not submit again. Check the Dashboard and confirm with FBR before any retry.';
  }
  if (/submission already in progress/.test(m)) {
    return 'A submit is already in progress for this invoice. Please wait — do not click Submit again.';
  }
  if (/must pass fbr validation|status: validated|not validated/.test(m)) {
    return 'This invoice must pass “Validate with FBR” first (status becomes validated). Click Validate, wait for success, then click Submit.';
  }
  if (/fields were updated|reset to draft/.test(m)) {
    return 'The invoice details changed, so it must be validated again. Click “Validate with FBR”, then Submit.';
  }
  if (/cannot validate.*submitted|cannot modify invoice in status/.test(m)) {
    return 'This invoice can no longer be changed or re-validated because it was already submitted (or is waiting on FBR). Start a new invoice instead.';
  }
  if (/cannot validate.*submission_pending|cannot validate.*submission_unknown/.test(m)) {
    return 'This invoice is locked because a previous submit is unfinished or unclear. Do not validate or submit again until it is resolved.';
  }
  if (/invoice not found/.test(m)) {
    return 'We could not find this invoice. Click “Save Draft” first, then Validate, then Submit.';
  }
  if (/invalid invoice id/.test(m)) {
    return 'Something went wrong with this invoice record. Save a new draft and try again.';
  }
  if (/validation failed|missing or incorrect/.test(m)) {
    if (payload?.errors?.length) {
      const fields = payload.errors
        .slice(0, 5)
        .map((e) => e.field || e.message)
        .filter(Boolean)
        .join(', ');
      return fields
        ? `Some required details are missing or incorrect (${fields}). Fix those fields and try again.`
        : 'Some required details are missing or incorrect. Check the form and try again.';
    }
    return context === 'validate'
      ? 'FBR did not accept this invoice. Check the red FBR messages below, fix the form, then validate again.'
      : 'Some information is incomplete or incorrect. Check the form and try again.';
  }
  if (/network error|err_network|failed to fetch/.test(m)) {
    return 'Could not connect to the server. Check your internet connection and try again.';
  }
  if (/timeout|timed out/.test(m)) {
    return messageForCode('FBR_TIMEOUT', context);
  }
  if (/401|403|unauthorized|sign in/.test(m)) {
    return 'Your Microsoft sign-in expired or is not allowed. Sign out, sign in again, then retry.';
  }
  if (/rejected the submission/.test(m)) {
    return messageForCode('FBR_SUBMISSION_REJECTED', 'submit');
  }
  if (/did not confirm success|not marked as submitted/.test(m)) {
    return 'FBR did not confirm that the invoice was accepted. It was not marked as submitted. See the messages below, fix any issues, validate again, then submit.';
  }

  return null;
}

/**
 * Turn API / network errors into a clear message for the Result panel.
 * @param {object} payload - from getErrorPayload
 * @param {'save'|'validate'|'submit'} context
 */
export function humanizeApiError(payload, context = 'general') {
  const code = payload?.error?.code || payload?.code;
  const fromCode = messageForCode(code, context);
  if (fromCode) return fromCode;

  const fromRaw = humanizeByRawMessage(payload?.message, context, payload);
  if (fromRaw) return fromRaw;

  if (payload?.error?.uncertain || payload?.invoice?.status === 'submission_unknown') {
    return CODE_MESSAGES.FBR_NO_RESPONSE.submit;
  }

  if (context === 'validate') {
    return (
      payload?.message ||
      'Validation with FBR did not succeed. See details below, fix the form if needed, and try again.'
    );
  }
  if (context === 'submit') {
    return (
      payload?.message ||
      'Submit did not succeed. The invoice may not have been sent. See details below before trying again.'
    );
  }
  if (context === 'save') {
    return (
      payload?.message ||
      'Could not save the draft. Check your connection and try again.'
    );
  }
  return payload?.message || 'Something went wrong. Please try again.';
}

export const MSG = {
  formIncompleteSave:
    'The form is incomplete. Fix the fields marked in red, then click “Save Draft” again.',
  formIncompleteValidate:
    'The form is incomplete. Fix the fields marked in red, then click “Validate with FBR” again.',
  draftSaved: 'Draft saved. Next step: click “Validate with FBR”.',
  validateOk:
    'FBR accepted this invoice (sandbox check passed). Next step: click “Submit to FBR”.',
  validateFail:
    'FBR did not accept this invoice. Read the FBR messages below, correct the form, then click “Validate with FBR” again.',
  alreadySubmitted:
    'This invoice was already sent to FBR. Open the Dashboard to view it, or fill the form for a new invoice.',
  submissionUnknown:
    'The last submit did not get a clear answer from FBR. Do not submit again. Check the Dashboard and confirm with FBR before any retry.',
  notValidated:
    'Please validate first. Click “Validate with FBR” and wait until it succeeds, then click “Submit to FBR”.',
  missingId:
    'Please save and validate first. Click “Save Draft”, then “Validate with FBR”, then “Submit to FBR”.',
  submitOk: (fbrNo) =>
    fbrNo
      ? `Invoice submitted successfully to FBR. FBR invoice number: ${fbrNo}. The form is cleared for your next invoice.`
      : 'Invoice submitted successfully to FBR. The form is cleared for your next invoice.',
  submitUnconfirmed:
    'FBR did not clearly accept this invoice, so it was not marked as submitted. See the messages below. Fix any issues, validate again, then submit.',
  uncertainTitle: 'Unclear result — do not submit again',
  uncertainBody:
    'We sent the invoice, but FBR did not give a clear reply (timeout or connection problem). It may or may not have been received. Do not click Submit again. Check the Dashboard, or ask your admin to confirm in the FBR sandbox, before any retry.',
};
