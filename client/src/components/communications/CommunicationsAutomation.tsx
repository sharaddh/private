import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Plus, RefreshCw, Zap } from 'lucide-react';
import Modal from '../Modal';
import { useToast } from '../../context/ToastContext';
import {
  communicationsService,
  type ReminderRule,
  type WhatsAppTemplateMapping,
  type WhatsAppTrigger,
} from '../../services/communications.service';

interface ReminderDraft {
  name: string;
  enabled: boolean;
  daysAfterBill: number;
  templateId: string;
}

export default function CommunicationsAutomation() {
  const toast = useToast();
  const [triggers, setTriggers] = useState<WhatsAppTrigger[]>([]);
  const [reminders, setReminders] = useState<ReminderRule[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplateMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reminderModal, setReminderModal] = useState<ReminderDraft | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [triggerRes, reminderRes, templateRes] = await Promise.all([
        communicationsService.getTriggers(),
        communicationsService.getReminderRules(),
        communicationsService.getTemplates(),
      ]);
      if (triggerRes.success && triggerRes.data) setTriggers(triggerRes.data);
      if (reminderRes.success && reminderRes.data) setReminders(reminderRes.data);
      if (templateRes.success && templateRes.data) setTemplates(templateRes.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load automation settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const templatesByEvent = useMemo(() => {
    const map = new Map<string, WhatsAppTemplateMapping[]>();
    for (const template of templates) {
      const list = map.get(template.eventKey) || [];
      list.push(template);
      map.set(template.eventKey, list);
    }
    return map;
  }, [templates]);

  const reminderTemplates = templatesByEvent.get('PAYMENT_BALANCE_DUE') || [];

  async function updateTrigger(
    trigger: WhatsAppTrigger,
    patch: { enabled?: boolean; templateId?: string | null }
  ) {
    setSavingId(trigger.id);
    try {
      const res = await communicationsService.patchTrigger(trigger.id, patch);
      if (res.success && res.data) {
        setTriggers((current) =>
          current.map((row) => (row.id === trigger.id ? { ...row, ...res.data } : row))
        );
        toast.success('Automation updated');
      } else {
        toast.error(res.message || 'Unable to update automation');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update automation');
    } finally {
      setSavingId(null);
    }
  }

  function toggleTrigger(trigger: WhatsAppTrigger, enabled: boolean) {
    if (enabled && !trigger.templateId) {
      toast.error('Select a template before enabling this automation');
      return;
    }
    void updateTrigger(trigger, { enabled });
  }

  async function updateReminder(
    rule: ReminderRule,
    patch: { enabled?: boolean; daysAfterBill?: number; templateId?: string | null; name?: string }
  ) {
    setSavingId(rule.id);
    try {
      const res = await communicationsService.patchReminderRule(rule.id, patch);
      if (res.success && res.data) {
        setReminders((current) =>
          current.map((row) => (row.id === rule.id ? { ...row, ...res.data } : row))
        );
        toast.success('Reminder rule updated');
      } else {
        toast.error(res.message || 'Unable to update reminder rule');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update reminder rule');
    } finally {
      setSavingId(null);
    }
  }

  async function saveReminder() {
    if (!reminderModal) return;
    if (!reminderModal.name.trim()) {
      toast.error('Reminder name is required');
      return;
    }
    setSavingReminder(true);
    try {
      const res = await communicationsService.createReminderRule({
        name: reminderModal.name.trim(),
        enabled: reminderModal.enabled,
        daysAfterBill: reminderModal.daysAfterBill,
        templateId: reminderModal.templateId || null,
      });
      if (res.success) {
        toast.success('Reminder rule created');
        setReminderModal(null);
        await load();
      } else {
        toast.error(res.message || 'Unable to create reminder rule');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create reminder rule');
    } finally {
      setSavingReminder(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Automation rules</h2>
          <p className="text-sm text-th-secondary">
            Enabling a rule only sends when a Meta-approved template is selected and branch sending
            is on.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Zap size={16} /> Event triggers
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {triggers.map((trigger) => {
            const options = templatesByEvent.get(trigger.eventKey) || [];
            const selected = options.find((row) => row.id === trigger.templateId);
            const selectedApproved = selected?.localStatus === 'approved_confirmed';
            return (
              <div
                key={trigger.id}
                className="card flex flex-col gap-3 p-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{trigger.eventKey}</span>
                    <span className="rounded-full bg-th-elevated px-2 py-0.5 text-xs text-th-secondary">
                      {trigger.category}
                    </span>
                    {!selectedApproved && (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-400">
                        template not approved
                      </span>
                    )}
                  </div>
                  <select
                    className="input-field mt-2"
                    value={trigger.templateId || ''}
                    disabled={savingId === trigger.id}
                    onChange={(event) =>
                      void updateTrigger(trigger, { templateId: event.target.value || null })
                    }
                  >
                    <option value="">Select a template…</option>
                    {options.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.metaTemplateName} ({template.languageCode})
                        {template.localStatus === 'approved_confirmed' ? '' : ' — not approved'}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-th-secondary">Enabled</span>
                  <input
                    role="switch"
                    type="checkbox"
                    className="toggle h-4 w-8"
                    checked={trigger.enabled}
                    disabled={savingId === trigger.id}
                    onChange={(event) => toggleTrigger(trigger, event.target.checked)}
                  />
                </label>
              </div>
            );
          })}
          {!loading && triggers.length === 0 && (
            <div className="card p-6 text-sm text-th-secondary">No triggers found.</div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <BellRing size={16} /> Payment reminder rules
          </h3>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() =>
              setReminderModal({
                name: '',
                enabled: false,
                daysAfterBill: 7,
                templateId: reminderTemplates[0]?.id || '',
              })
            }
          >
            <Plus size={16} /> Add rule
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {reminders.map((rule) => (
            <div key={rule.id} className="card flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{rule.name}</p>
                <p className="text-xs text-th-secondary">
                  {rule.template?.metaTemplateName || 'No template selected'}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-th-secondary">Days after bill</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  className="input-field w-24"
                  defaultValue={rule.daysAfterBill}
                  disabled={savingId === rule.id}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value) && value !== rule.daysAfterBill) {
                      void updateReminder(rule, { daysAfterBill: value });
                    }
                  }}
                />
              </label>
              <select
                className="input-field w-full md:w-64"
                value={rule.templateId || ''}
                disabled={savingId === rule.id}
                onChange={(event) =>
                  void updateReminder(rule, { templateId: event.target.value || null })
                }
              >
                <option value="">Select a template…</option>
                {reminderTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.metaTemplateName} ({template.languageCode})
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-th-secondary">Enabled</span>
                <input
                  role="switch"
                  type="checkbox"
                  className="toggle h-4 w-8"
                  checked={rule.enabled}
                  disabled={savingId === rule.id}
                  onChange={(event) => void updateReminder(rule, { enabled: event.target.checked })}
                />
              </label>
            </div>
          ))}
          {!loading && reminders.length === 0 && (
            <div className="card p-6 text-sm text-th-secondary">No reminder rules yet.</div>
          )}
        </div>
      </section>

      <Modal
        open={!!reminderModal}
        onClose={() => setReminderModal(null)}
        title="Add payment reminder rule"
      >
        {reminderModal && (
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-th-secondary">Rule name</span>
              <input
                className="input-field"
                value={reminderModal.name}
                onChange={(event) =>
                  setReminderModal({ ...reminderModal, name: event.target.value })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-th-secondary">Days after bill</span>
              <input
                type="number"
                min={1}
                max={365}
                className="input-field"
                value={reminderModal.daysAfterBill}
                onChange={(event) =>
                  setReminderModal({
                    ...reminderModal,
                    daysAfterBill: Number(event.target.value) || 1,
                  })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-th-secondary">Template</span>
              <select
                className="input-field"
                value={reminderModal.templateId}
                onChange={(event) =>
                  setReminderModal({ ...reminderModal, templateId: event.target.value })
                }
              >
                <option value="">Select a template…</option>
                {reminderTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.metaTemplateName} ({template.languageCode})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="toggle h-4 w-8"
                checked={reminderModal.enabled}
                onChange={(event) =>
                  setReminderModal({ ...reminderModal, enabled: event.target.checked })
                }
              />
              <span>Enable immediately</span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => setReminderModal(null)}
                disabled={savingReminder}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void saveReminder()}
                disabled={savingReminder}
              >
                {savingReminder ? 'Saving…' : 'Create rule'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
