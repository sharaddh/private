import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, FormEvent } from "react";

interface FormProps {
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
  title?: string;
  submitLabel?: string;
  isLoading?: boolean;
}

export default function Form({
  onSubmit,
  children,
  title,
  submitLabel = "Submit",
  isLoading = false,
}: FormProps) {
  return (
    <div className="bg-white dark:bg-slate-800/80 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50 mb-6">
      {title && <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{title}</h3>}
      <form onSubmit={onSubmit} className="space-y-4">
        {children}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-xl transition-all duration-300 active:scale-[0.98] shadow-sm"
        >
          {isLoading ? "Loading..." : submitLabel}
        </button>
      </form>
    </div>
  );
}

interface FormGroupProps {
  label?: string;
  error?: string;
  children: ReactNode;
}

export function FormGroup({ label, error, children }: FormGroupProps) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  return (
    <FormGroup label={label} error={error}>
      <input
        {...props}
        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-300 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 shadow-sm"
      />
    </FormGroup>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, ...props }: SelectProps) {
  return (
    <FormGroup label={label} error={error}>
      <select
        {...props}
        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-300 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
      >
        <option value="">Select an option</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormGroup>
  );
}
