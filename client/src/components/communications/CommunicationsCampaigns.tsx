import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Pause, Play, Plus, RefreshCw, XCircle } from 'lucide-react';
import Modal from '../Modal';
import { useToast } from '../../context/ToastContext';
import {
  communicationsService,
  type CampaignPreview,
  type WhatsAppCampaign,
  type WhatsAppTemplateMapping,
} from '../../services/communications.service';

interface CampaignForm {
  name: string;
  description: string;
  purpose: 'marketing' | 'utility';
  templateId: string;
  city: string;
  hasPending: boolean;
  inactiveDays: string;
  scheduledAt: string;
}

function emptyForm(): CampaignForm {
  return {
    name: '',
    description: '',
    purpose: 'marketing',
    templateId: '',
    city: '',
    hasPending: false,
    inactiveDays: '',
    scheduledAt: '',
  };
}

function statusColor(status: string): string {
  if (status === 'COMPLETED') return 'bg-[#1ed760]/15 text-[#1ed760]';
  if (status === 'FAILED' || status === 'CANCELLED') return 'bg-[#e74c3c]/15 text-[#e74c3c]';
  if (status === 'PROCESSING' || status === 'QUEUED') return 'bg-blue-400/15 text-blue-400';
  if (status === 'PAUSED') return 'bg-amber-400/15 text-amber-400';
  return 'bg-th-elevated text-th-secondary';
}

export default function CommunicationsCampaigns() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplateMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CampaignForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<(CampaignPreview & { name: string }) | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignRes, templateRes] = await Promise.all([
        communicationsService.listCampaigns({ page: 1, limit: 50 }),
        communicationsService.getTemplates(),
      ]);
      if (campaignRes.success && campaignRes.data) setCampaigns(campaignRes.data);
      if (templateRes.success && templateRes.data) setTemplates(templateRes.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const usableTemplates = useMemo(
    () => templates.filter((template) => template.localStatus === 'approved_confirmed'),
    [templates]
  );

  const templatesForPurpose = useMemo(() => {
    if (!form) return [];
    return usableTemplates.filter((template) => template.category === form.purpose);
  }, [form, usableTemplates]);

  async function createCampaign() {
    if (!form) return;
    if (!form.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    if (!form.templateId) {
      toast.error('Select an approved template');
      return;
    }
    setSaving(true);
    try {
      const audienceFilter: Record<string, unknown> = {};
      if (form.city.trim()) audienceFilter.city = form.city.trim();
      if (form.hasPending) audienceFilter.hasPending = true;
      const inactiveDays = Number(form.inactiveDays);
      if (Number.isFinite(inactiveDays) && inactiveDays > 0) {
        audienceFilter.inactiveDays = inactiveDays;
      }
      const res = await communicationsService.createCampaign({
        name: form.name.trim(),
        description: form.description.trim() || null,
        purpose: form.purpose,
        templateId: form.templateId,
        audienceFilter,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        timezone: 'Asia/Kolkata',
      });
      if (res.success) {
        toast.success('Campaign created');
        setForm(null);
        await load();
      } else {
        toast.error(res.message || 'Unable to create campaign');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create campaign');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(
    campaign: WhatsAppCampaign,
    action: 'start' | 'pause' | 'resume' | 'cancel' | 'preview'
  ) {
    setBusyId(campaign.id);
    try {
      if (action === 'preview') {
        const res = await communicationsService.previewCampaign(campaign.id);
        if (res.success && res.data) {
          setPreview({ ...res.data, name: campaign.name });
        } else {
          toast.error(res.message || 'Unable to preview campaign');
        }
        return;
      }
      const res =
        action === 'start'
          ? await communicationsService.startCampaign(campaign.id)
          : action === 'pause'
            ? await communicationsService.pauseCampaign(campaign.id)
            : action === 'resume'
              ? await communicationsService.resumeCampaign(campaign.id)
              : await communicationsService.cancelCampaign(campaign.id);
      if (res.success) {
        toast.success(`Campaign ${action} requested`);
        await load();
      } else {
        toast.error(res.message || `Unable to ${action} campaign`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Unable to ${action} campaign`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Marketing campaigns</h2>
          <p className="text-sm text-th-secondary">
            Campaigns only reach opted-in customers and require marketing sending to be enabled.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setForm(emptyForm())}>
            <Plus size={16} /> New campaign
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="card flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{campaign.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(campaign.status)}`}>
                  {campaign.status}
                </span>
                <span className="rounded-full bg-th-elevated px-2 py-0.5 text-xs text-th-secondary">
                  {campaign.purpose}
                </span>
              </div>
              <p className="mt-1 text-xs text-th-secondary">
                {campaign.template?.metaTemplateName || 'template'} · matched{' '}
                {campaign.audienceMatched ?? 0} · eligible {campaign.eligibleCount ?? 0} · skipped{' '}
                {campaign.skippedCount ?? 0}
                {campaign.failureCount ? ` · failed ${campaign.failureCount}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="btn btn-ghost btn-sm"
                disabled={busyId === campaign.id}
                onClick={() => void runAction(campaign, 'preview')}
              >
                <Eye size={16} /> Preview
              </button>
              {['DRAFT', 'SCHEDULED'].includes(campaign.status) && (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busyId === campaign.id}
                  onClick={() => void runAction(campaign, 'start')}
                >
                  <Play size={16} /> Start
                </button>
              )}
              {['SCHEDULED', 'QUEUED', 'PROCESSING'].includes(campaign.status) && (
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busyId === campaign.id}
                  onClick={() => void runAction(campaign, 'pause')}
                >
                  <Pause size={16} /> Pause
                </button>
              )}
              {campaign.status === 'PAUSED' && (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busyId === campaign.id}
                  onClick={() => void runAction(campaign, 'resume')}
                >
                  <Play size={16} /> Resume
                </button>
              )}
              {!['COMPLETED', 'CANCELLED'].includes(campaign.status) && (
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busyId === campaign.id}
                  onClick={() => void runAction(campaign, 'cancel')}
                >
                  <XCircle size={16} /> Cancel
                </button>
              )}
            </div>
          </div>
        ))}
        {!loading && campaigns.length === 0 && (
          <div className="card p-6 text-sm text-th-secondary">
            No campaigns yet. Create one after marketing sends are enabled.
          </div>
        )}
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title="New marketing campaign"
        size="lg"
      >
        {form && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-th-secondary">Campaign name</span>
                <input
                  className="input-field"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-th-secondary">Purpose</span>
                <select
                  className="input-field"
                  value={form.purpose}
                  onChange={(event) =>
                    setForm({ ...form, purpose: event.target.value as CampaignForm['purpose'] })
                  }
                >
                  <option value="marketing">Marketing</option>
                  <option value="utility">Utility</option>
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-th-secondary">Approved template</span>
                <select
                  className="input-field"
                  value={form.templateId}
                  onChange={(event) => setForm({ ...form, templateId: event.target.value })}
                >
                  <option value="">Select an approved template…</option>
                  {templatesForPurpose.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.metaTemplateName} ({template.languageCode})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-th-secondary">City filter (optional)</span>
                <input
                  className="input-field"
                  value={form.city}
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-th-secondary">
                  Inactive for at least (days, optional)
                </span>
                <input
                  type="number"
                  min={1}
                  className="input-field"
                  value={form.inactiveDays}
                  onChange={(event) => setForm({ ...form, inactiveDays: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-th-secondary">Schedule (optional)</span>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={form.scheduledAt}
                  onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  className="toggle h-4 w-8"
                  checked={form.hasPending}
                  onChange={(event) => setForm({ ...form, hasPending: event.target.checked })}
                />
                <span>Only customers with a pending balance</span>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-th-secondary">Description</span>
                <textarea
                  className="input-field min-h-[70px]"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setForm(null)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => void createCampaign()} disabled={saving}>
                {saving ? 'Creating…' : 'Create campaign'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview ? `Preview: ${preview.name}` : 'Campaign preview'}
      >
        {preview && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded border border-th-border p-3">
                <p className="text-xs text-th-secondary">Matched</p>
                <p className="text-lg font-semibold">{preview.matched}</p>
              </div>
              <div className="rounded border border-th-border p-3">
                <p className="text-xs text-th-secondary">Eligible</p>
                <p className="text-lg font-semibold">{preview.eligible}</p>
              </div>
              <div className="rounded border border-th-border p-3">
                <p className="text-xs text-th-secondary">Skipped</p>
                <p className="text-lg font-semibold">{preview.skipped}</p>
              </div>
            </div>
            <div>
              <p className="mb-1 font-medium">Rendered parameters</p>
              {preview.rendered.map((row) => (
                <p key={row.key} className="text-th-secondary">
                  {row.key}: {row.value}
                </p>
              ))}
            </div>
            <div>
              <p className="mb-1 font-medium">Sample recipients</p>
              {preview.sample.map((row) => (
                <p key={row.id} className="text-th-secondary">
                  {row.customerName} {row.phoneMasked ? `· ${row.phoneMasked}` : ''}
                </p>
              ))}
              {preview.sample.length === 0 && (
                <p className="text-th-secondary">No eligible sample recipients.</p>
              )}
            </div>
            <div>
              <p className="mb-1 font-medium">Skipped reasons</p>
              {Object.entries(preview.skipCounts).length === 0 && (
                <p className="text-th-secondary">None</p>
              )}
              {Object.entries(preview.skipCounts).map(([reason, count]) => (
                <p key={reason} className="text-th-secondary">
                  {reason}: {count}
                </p>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
