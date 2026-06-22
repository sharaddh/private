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
    <div className="bg-white dark:bg-dark-800 p-6 rounded-xl border border-surface-100 dark:border-dark-700 shadow-soft mb-6">
      {title && <h3 className="text-lg font-semibold text-muted-900 dark:text-white mb-4">{title}</h3>}
      <form onSubmit={onSubmit} className="space-y-4">
        {children}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-muted-400 dark:disabled:bg-muted-600 text-white font-semibold py-2.5 px-4 rounded-xl transition-all duration-200 active:scale-[0.98]"
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
        <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1">
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
        className="w-full px-4 py-2.5 border border-surface-200 dark:border-dark-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all duration-200 bg-white dark:bg-dark-800 text-muted-900 dark:text-white placeholder-muted-400"
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
        className="w-full px-4 py-2.5 border border-surface-200 dark:border-dark-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all duration-200 bg-white dark:bg-dark-800 text-muted-900 dark:text-white"
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
