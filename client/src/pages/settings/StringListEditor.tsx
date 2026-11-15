import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from './FormField';

interface StringListEditorProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  addLabel: string;
}

export default function StringListEditor({
  label,
  values,
  onChange,
  placeholder,
  addLabel,
}: StringListEditorProps) {
  const [draft, setDraft] = useState('');

  function addValue() {
    const value = draft.trim();
    if (!value) return;
    if (!values.some((item) => item.toLowerCase() === value.toLowerCase())) {
      onChange([...values, value]);
    }
    setDraft('');
  }

  function updateValue(index: number, value: string) {
    onChange(values.map((item, i) => (i === index ? value : item)));
  }

  function removeValue(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wider text-th-secondary">
        {label}
      </label>
      {values.length === 0 && (
        <p className="rounded-md border border-dashed border-th-border bg-th-elevated px-3 py-2 text-xs text-th-muted">
          {placeholder}
        </p>
      )}
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={value}
            onChange={(e) => updateValue(index, e.target.value)}
            placeholder={placeholder}
            className="text-sm"
          />
          <button
            type="button"
            onClick={() => removeValue(index)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#e74c3c]/10 text-[#e74c3c] transition-colors hover:bg-[#e74c3c]/20"
            aria-label={`Remove ${value || label}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addValue();
            }
          }}
          placeholder={placeholder}
          className="text-sm"
        />
        <button type="button" onClick={addValue} className="btn-primary btn-sm shrink-0">
          <Plus size={14} />
          {addLabel}
        </button>
      </div>
    </div>
  );
}
