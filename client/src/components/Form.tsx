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
    <div className="bg-th-surface p-6 rounded-[8px] mb-6">
      {title && <h3 className="text-[20px] font-semibold text-th-text mb-4">{title}</h3>}
      <form onSubmit={onSubmit} className="space-y-4">
        {children}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#1ed760] hover:bg-[#1ed760]/90 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 active:scale-[0.95] uppercase tracking-wider text-[18px]"
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
        <label className="block text-[18px] font-medium text-th-text mb-1.5">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-red-600 text-[17px] mt-1">{error}</p>}
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
        className="w-full px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#1ed760] transition-all duration-200 bg-th-elevated text-th-text placeholder-th-muted text-[18px]"
        style={{ border: "rgb(124,124,124) 0px 0px 0px 1px inset" }}
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
        className="w-full px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#1ed760] transition-all duration-200 bg-th-elevated text-th-text text-[18px]"
        style={{ border: "rgb(124,124,124) 0px 0px 0px 1px inset" }}
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
