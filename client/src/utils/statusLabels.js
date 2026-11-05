export function getStatusLabel(status) {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'validated':
      return 'Ready to send';
    case 'validation_failed':
      return 'Needs correction';
    case 'submission_pending':
      return 'Sending…';
    case 'submitted':
      return 'Sent to FBR';
    case 'submission_unknown':
      return 'Unclear — do not resend';
    default:
      return status || '—';
  }
}

export function getStatusBadgeClass(status) {
  switch (status) {
    case 'submitted':
    case 'validated':
      return 'border-emerald-300 bg-emerald-50 text-emerald-800';
    case 'validation_failed':
      return 'border-red-300 bg-red-50 text-red-800';
    case 'submission_pending':
      return 'border-amber-300 bg-amber-50 text-amber-900';
    case 'submission_unknown':
      return 'border-orange-300 bg-orange-50 text-orange-900';
    case 'draft':
    default:
      return 'border-slate-300 bg-slate-50 text-slate-700';
  }
}
