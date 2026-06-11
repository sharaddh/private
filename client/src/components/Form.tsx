import React from "react";

interface FormProps {
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
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
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <form onSubmit={onSubmit} className="space-y-4">
        {children}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
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
  children: React.ReactNode;
}

export function FormGroup({ label, error, children }: FormGroupProps) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
    </div>
  );
}

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  return (
    <FormGroup label={label} error={error}>
      <input
        {...props}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </FormGroup>
  );
}

interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, ...props }: SelectProps) {
  return (
    <FormGroup label={label} error={error}>
      <select
        {...props}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
