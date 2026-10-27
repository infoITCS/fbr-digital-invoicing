export default function Field({
  label,
  name,
  required,
  error,
  children,
  hint,
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={name} className="text-xs font-semibold text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
      {error ? <p className="text-[11px] font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

export const inputClass = (error) =>
  `w-full rounded border px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-teal-700/30 ${
    error
      ? 'border-red-400 bg-red-50 focus:border-red-500'
      : 'border-slate-300 bg-white focus:border-teal-700'
  }`;
