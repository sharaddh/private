import { type ReactNode, type InputHTMLAttributes, useId } from "react";
import { motion } from "framer-motion";

interface FormFieldProps {
  label: string;
  icon?: ReactNode;
  error?: string;
  helperText?: string;
  children: ReactNode;
}

export function FormField({ label, icon, error, helperText, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-th-secondary">{label}</label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-muted pointer-events-none">
            {icon}
          </div>
        )}
        {children}
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-400"
        >
          {error}
        </motion.p>
      )}
      {helperText && !error && (
        <p className="text-xs text-th-muted">{helperText}</p>
      )}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({ icon, label, error, helperText, className = "", ...props }: InputProps) {
  const inputId = useId();
  const input = (
    <input
      id={inputId}
      {...props}
      className={`w-full px-4 py-2.5 border border-th-border rounded-md focus:outline-none focus:border-[#1ed760] transition-all duration-300 bg-th-elevated text-th-text placeholder-th-muted ${icon ? "pl-10" : ""} ${className}`}
    />
  );
  if (label)
    return (
      <FormField label={label} icon={icon} error={error} helperText={helperText}>
        {input}
      </FormField>
    );
  return icon ? <div className="relative">{icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-muted pointer-events-none">{icon}</div>}{input}</div> : input;
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  icon?: ReactNode;
  label?: string;
  error?: string;
  helperText?: string;
}

export function Textarea({ icon, label, error, helperText, className = "", ...props }: TextareaProps) {
  const inputId = useId();
  const area = (
    <textarea
      id={inputId}
      {...props}
      className={`w-full px-4 py-2.5 border border-th-border rounded-md focus:outline-none focus:border-[#1ed760] transition-all duration-300 bg-th-elevated text-th-text placeholder-th-muted resize-none ${icon ? "pl-10" : ""} ${className}`}
    />
  );
  if (label)
    return (
      <FormField label={label} icon={icon} error={error} helperText={helperText}>
        {area}
      </FormField>
    );
  return area;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  helperText?: string;
}

export function Select({ label, error, icon, helperText, className = "", children, ...props }: SelectProps) {
  const inputId = useId();
  const select = (
    <select
      id={inputId}
      {...props}
      className={`w-full px-4 py-2.5 border border-th-border rounded-md focus:outline-none focus:border-[#1ed760] transition-all duration-300 bg-th-elevated text-th-text ${icon ? "pl-10" : ""} ${className}`}
    >
      {children}
    </select>
  );
  if (label)
    return (
      <FormField label={label} icon={icon} error={error} helperText={helperText}>
        {select}
      </FormField>
    );
  return select;
}
