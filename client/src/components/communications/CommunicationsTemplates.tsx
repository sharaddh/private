import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Pencil, RefreshCw, ShieldAlert } from 'lucide-react';
import Modal from '../Modal';
import { useToast } from '../../context/ToastContext';
import {
  communicationsService,
  type WhatsAppTemplateMapping,
} from '../../services/communications.service';

const STATUS_OPTIONS = [
  'unconfigured',
  'configured',
  'awaiting_external_confirmation',
  'approved_confirmed',
  'rejected',
];

const STATUS_LABELS: Record<string, string> = {
  unconfigured: 'Not configured',
  configured: 'Configured',
  awaiting_external_confirmation: 'Awaiting Meta approval',
  approved_confirmed: 'Approved in Meta',
  rejected: 'Rejected',
};

interface ParameterRow {
  key: string;
  source: string;
}

interface TemplateForm {
  id: string;
  eventKey: string;
  metaTemplateName: string;
  languageCode: string;
  category: 'utility' | 'marketing';
  localStatus: string;
  headerType: string;
  notes: string;
  parameters: ParameterRow[];
}

function toForm(template: WhatsAppTemplateMapping): TemplateForm {
  const raw = Array.isArray(template.parameterMap) ? template.parameterMap : [];
  return {
    id: template.id,
    eventKey: template.eventKey,
    metaTemplateName: template.metaTemplateName,
    languageCode: template.languageCode,
    category: template.category,
    localStatus: template.localStatus,
    headerType: template.headerType || 'none',
    notes: '',
    parameters: raw.map((row) => ({ key: row.key, source: row.source })),
  };
}

function statusClasses(status: string): string {
  if (status === 'approved_confirmed') return 'bg-[#1ed760]/15 text-[#1ed760]';
  if (status === 'rejected') return 'bg-[#e74c3c]/15 text-[#e74c3c]';
  if (status === 'awaiting_external_confirmation') return 'bg-amber-400/15 text-amber-400';
  return 'bg-th-elevated text-th-secondary';
}

export default function CommunicationsTemplates() {
  const toast = useToast();
  const [templates, setTemplates] = useState<WhatsAppTemplateMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TemplateForm | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await communicationsService.getTemplates();
      if (res.success && res.data) {
        setTemplates(res.data);
      } else {
        toast.error(res.message || 'Unable to load templates');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load templates');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateParameter(index: number, field: 'key' | 'source', value: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            parameters: current.parameters.map((row, rowIndex) =>
              rowIndex === index ? { ...row, [field]: value } : row
            ),
          }
        : current
    );
  }

  function addParameter() {
    setForm((current) =>
      current
        ? {
            ...current,
            parameters: [
              ...current.parameters,
              { key: `param_${current.parameters.length + 1}`, source: '' },
            ],
          }
        : current
    );
  }

  function removeParameter(index: number) {
    setForm((current) =>
      current
        ? {
            ...current,
            parameters: current.parameters.filter((_, rowIndex) => rowIndex !== index),
          }
        : current
    );
  }

  async function save() {
    if (!form) return;
    if (!form.metaTemplateName.trim()) {
      toast.error('Meta template name is required');
      return;
    }
    if (form.parameters.some((row) => !row.key.trim() || !row.source.trim())) {
      toast.error('Every parameter needs a key and a source');
      return;
    }
    setSaving(true);
    try {
      const res = await communicationsService.patchTemplate(form.id, {
        metaTemplateName: form.metaTemplateName.trim(),
        languageCode: form.languageCode.trim(),
        category: form.category,
        localStatus: form.localStatus,
        headerType: form.headerType,
        bodyParamCount: form.parameters.length,
        parameterMap: form.parameters,
        notes: form.notes.trim() || null,
      });
      if (res.success) {
        toast.success('Template mapping saved');
        setForm(null);
        await load();
      } else {
        toast.error(res.message || 'Unable to save template');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save template');
    } finally {
      setSaving(false);
    }
  }

  async function markApproved(template: WhatsAppTemplateMapping) {
    try {
      const res = await communicationsService.patchTemplate(template.id, {
        localStatus: 'approved_confirmed',
      });
      if (res.success) {
        toast.success('Template marked approved');
        await load();
      } else {
        toast.error(res.message || 'Unable to update template');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update template');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Template mappings</h2>
          <p className="text-sm text-th-secondary">
            Map each event to a template approved in Meta. Triggers only send when the status is
            confirmed approved.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-300">
        <ShieldAlert size={16} className="mr-1 inline" />
        After Meta approves a template, open it here and set the status to Approved in Meta.
      </div>

      <div className="grid grid-cols-1 gap-3">
        {templates.map((template) => (
          <div key={template.id} className="card flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-medium">{template.eventKey}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusClasses(template.localStatus)}`}>
                  {STATUS_LABELS[template.localStatus] || template.localStatus}
                </span>
                <span className="rounded-full bg-th-elevated px-2 py-0.5 text-xs text-th-secondary">
                  {template.category}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-th-secondary">
                <span className="font-mono">{template.metaTemplateName || '(no template)'}</span>
                {' · '}
                {template.languageCode}
                {' · '}
                {Array.isArray(template.parameterMap) ? template.parameterMap.length : 0} params
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {template.localStatus !== 'approved_confirmed' && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => void markApproved(template)}
                >
                  <CheckCircle size={16} /> Mark approved
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setForm(toForm(template))}
              >
                <Pencil size={16} /> Edit
              </button>
            </div>
          </div>
        ))}
        {!loading && templates.length === 0 && (
          <div className="card p-6 text-sm text-th-secondary">No template mappings found.</div>
        )}
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form ? `Map ${form.eventKey}` : 'Template mapping'}
        size="lg"
      >
        {form && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-th-secondary">Meta template name</span>
                <input
                  className="input-field"
                  value={form.metaTemplateName}
                  onChange={(event) =>
                    setForm({ ...form, metaTemplateName: event.target.value })
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-th-secondary">Language code</span>
                <input
                  className="input-field"
                  value={form.languageCode}
                  onChange={(event) => setForm({ ...form, languageCode: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-th-secondary">Category</span>
                <select
                  className="input-field"
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value as 'utility' | 'marketing' })
                  }
                >
                  <option value="utility">utility</option>
                  <option value="marketing">marketing</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-th-secondary">Local status</span>
                <select
                  className="input-field"
                  value={form.localStatus}
                  onChange={(event) => setForm({ ...form, localStatus: event.target.value })}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status] || status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-th-secondary">Header type</span>
                <select
                  className="input-field"
                  value={form.headerType}
                  onChange={(event) => setForm({ ...form, headerType: event.target.value })}
                >
                  <option value="none">none</option>
                  <option value="document">document</option>
                  <option value="text">text</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-th-secondary">Notes</span>
                <input
                  className="input-field"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Body parameters</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addParameter}>
                  Add parameter
                </button>
              </div>
              {form.parameters.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    className="input-field"
                    placeholder="template key e.g. customer_name"
                    value={row.key}
                    onChange={(event) => updateParameter(index, 'key', event.target.value)}
                  />
                  <span className="text-th-muted">→</span>
                  <input
                    className="input-field"
                    placeholder="data source e.g. customer_name"
                    value={row.source}
                    onChange={(event) => updateParameter(index, 'source', event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeParameter(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {form.parameters.length === 0 && (
                <p className="text-xs text-th-secondary">
                  No body parameters. Add rows in the same order as the variables in the Meta
                  template.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setForm(null)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving...' : 'Save mapping'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

