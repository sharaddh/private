import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BellRing,
  CheckCircle,
  FileText,
  LayoutDashboard,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';
import PageSkeleton from '../components/PageSkeleton';
import CommunicationsTemplates from '../components/communications/CommunicationsTemplates';
import CommunicationsAutomation from '../components/communications/CommunicationsAutomation';
import CommunicationsConsent from '../components/communications/CommunicationsConsent';
import CommunicationsCampaigns from '../components/communications/CommunicationsCampaigns';
import CommunicationsLogs from '../components/communications/CommunicationsLogs';
import { useTranslate } from '../context/TranslateContext';
import { useToast } from '../context/ToastContext';
import {
  communicationsService,
  type BillingSetting,
  type WhatsAppStatusPayload,
} from '../services/communications.service';

const missingDescriptions: Record<string, string> = {
  META_ACCESS_TOKEN: 'Meta permanent access token',
  META_PHONE_NUMBER_ID: 'Meta phone number ID',
  META_WABA_ID: 'Meta WhatsApp business account ID',
  META_APP_SECRET: 'Meta app secret for webhook signing',
  META_WEBHOOK_VERIFY_TOKEN: 'Meta webhook verify token',
};

type TabKey = 'overview' | 'templates' | 'automation' | 'consent' | 'campaigns' | 'logs';

const TABS: Array<{ key: TabKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'templates', label: 'Templates', icon: FileText },
  { key: 'automation', label: 'Automation', icon: BellRing },
  { key: 'consent', label: 'Consent', icon: UserRoundCheck },
  { key: 'campaigns', label: 'Campaigns', icon: BarChart3 },
  { key: 'logs', label: 'Logs', icon: MessageCircle },
];

export default function Communications() {
  const { uiT } = useTranslate();
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>('overview');
  const [status, setStatus] = useState<{ pending: boolean; done: boolean }>({
    pending: true,
    done: false,
  });
  const [data, setData] = useState<WhatsAppStatusPayload | null>(null);
  const [savingSetting, setSavingSetting] = useState(false);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);

  const loadStatus = useMemo(
    () => async (silent = false) => {
      setStatus({ pending: true, done: false });
      try {
        const res = await communicationsService.getStatus();
        if (res.success && res.data) {
          setData(res.data as WhatsAppStatusPayload);
          setStatus({ pending: false, done: true });
          return;
        }
        throw new Error(res.message || 'Unable to read WhatsApp status');
      } catch {
        if (!silent) {
          toast.error(
            uiT('Unable to check WhatsApp status', 'Unable to check WhatsApp status')
          );
        }
        setStatus({ pending: false, done: false });
      }
    },
    [uiT, toast]
  );

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) void loadStatus(true);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadStatus]);

  const provider = data?.provider || 'mock';
  const retentionValue = retentionDays ?? data?.settings?.retentionDays ?? 180;
  const isMeta = provider === 'meta';
  const providerReady = Boolean(data?.providerConfigured);
  const sendEnabled = Boolean(data?.settings?.sendEnabled);
  const campaignEnabled = Boolean(data?.settings?.campaignSendEnabled);
  const killSwitch = Boolean(data?.settings?.killSwitch);
  const worker = data?.worker;

  async function saveSettings(next: Partial<BillingSetting>) {
    setSavingSetting(true);
    try {
      const res = await communicationsService.patchSettings(next);
      if (res.success) {
        toast.success(uiT('Settings saved', 'Settings saved'));
        await loadStatus(true);
      } else {
        toast.error(res.message || uiT('Unable to save settings', 'Unable to save settings'));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || uiT('Unable to save settings', 'Unable to save settings'));
    } finally {
      setSavingSetting(false);
    }
  }

  function toggleSend(checked: boolean) {
    if (!checked) {
      void saveSettings({ sendEnabled: false, campaignSendEnabled: false });
      return;
    }
    const confirmed = window.confirm(
      uiT(
        'Enable this branch for WhatsApp transactional notifications?',
        'Enable this branch for WhatsApp transactional notifications?'
      )
    );
    if (!confirmed) return;
    void saveSettings({ sendEnabled: true });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{uiT('WhatsApp', 'WhatsApp')}</h1>
          <p className="page-subtitle">
            {isMeta
              ? 'Meta WhatsApp Cloud API — setup and delivery controls'
              : 'Mock provider. Automation is safe and disabled until configured.'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={status.pending}
          onClick={() => void loadStatus()}
        >
          <RefreshCw size={16} className={status.pending ? 'animate-spin' : ''} />
          {uiT('Refresh', 'Refresh')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab(item.key)}
            >
              <Icon size={16} /> {item.label}
            </button>
          );
        })}
      </div>

      {status.pending && <PageSkeleton page="settings" />}
      {status.done && !data && (
        <div className="card mx-auto max-w-4xl p-6">
          <div className="flex items-center gap-3 text-[#e74c3c]">
            <XCircle size={22} />
            <span className="text-sm font-medium">
              {uiT('Status could not be loaded', 'Status could not be loaded')}
            </span>
          </div>
        </div>
      )}

      {!!data && tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="card space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle size={22} className="text-[#1ed760]" />
                  <span className="text-base font-medium">
                    {isMeta ? 'Meta Cloud API' : 'Mock WhatsApp provider'}
                  </span>
                </div>
                {isMeta && !providerReady ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-medium text-amber-400">
                    <BellRing size={16} /> Setup needed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#1ed760]/15 px-3 py-1 text-xs font-medium text-[#1ed760]">
                    <CheckCircle size={16} /> Configured
                  </span>
                )}
              </div>
              <p className="text-sm text-th-secondary">
                {isMeta
                  ? 'Automatic sends stay off until you enable sending, approve templates, and record customer consent.'
                  : 'The mock provider never contacts WhatsApp. Useful for testing event logic.'}
              </p>
              {isMeta && !providerReady && (
                <ul className="space-y-1 text-xs text-th-secondary">
                  {(data?.config?.missing || []).map((item) => (
                    <li key={item}>{missingDescriptions[item] || item}</li>
                  ))}
                  {data?.config?.webhookPublicUrlSet === false && (
                    <li>Public HTTPS webhook URL (WHATSAPP_WEBHOOK_PUBLIC_URL)</li>
                  )}
                </ul>
              )}
              {killSwitch && (
                <div className="rounded-md bg-[#e74c3c]/10 p-3 text-sm text-[#e74c3c]">
                  <span className="inline-flex items-center">
                    <XCircle size={16} />
                    Kill switch is active. Live sending is stopped.
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded border p-3">
                  <p className="text-xs text-th-muted">Transactional gate</p>
                  <p className="font-medium">
                    {data?.effectiveSendEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div className="rounded border p-3">
                  <p className="text-xs text-th-muted">Campaign gate</p>
                  <p className="font-medium">
                    {data?.effectiveCampaignSendEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
            </div>

            <div className="card space-y-4 p-6">
              <h3 className="text-sm font-semibold">
                {uiT('Sending controls', 'Sending controls')}
              </h3>
              <label className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium">
                    {uiT('Enable transactional sending', 'Enable transactional sending')}
                  </span>
                  <span className="block text-xs text-th-secondary">
                    Existing bills and orders use approved templates and audited consent.
                  </span>
                </span>
                <input
                  role="switch"
                  aria-label={uiT('Enable transactional sending', 'Enable transactional sending')}
                  type="checkbox"
                  checked={sendEnabled}
                  disabled={savingSetting}
                  onChange={(event) => toggleSend(event.target.checked)}
                  className="toggle h-4 w-8"
                />
              </label>
              <label className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium">
                    {uiT('Enable marketing campaigns', 'Enable marketing campaigns')}
                  </span>
                  <span className="block text-xs text-th-secondary">
                    Requires opt-in and Meta-approved marketing templates.
                  </span>
                </span>
                <input
                  role="switch"
                  aria-label={uiT('Enable marketing campaigns', 'Enable marketing campaigns')}
                  type="checkbox"
                  checked={campaignEnabled}
                  disabled={savingSetting || !sendEnabled}
                  onChange={(event) => {
                    if (!event.target.checked) {
                      void saveSettings({ campaignSendEnabled: false });
                      return;
                    }
                    const confirmed = window.confirm(
                      uiT(
                        'Allow marketing campaign sends for this branch?',
                        'Allow marketing campaign sends for this branch?'
                      )
                    );
                    if (confirmed) void saveSettings({ campaignSendEnabled: true });
                  }}
                  className="toggle h-4 w-8"
                />
              </label>
              <label className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium">
                    {uiT('Kill switch', 'Kill switch')}
                  </span>
                  <span className="block text-xs text-th-secondary">
                    Immediately stops all outbound WhatsApp traffic.
                  </span>
                </span>
                <input
                  role="switch"
                  aria-label={uiT('Active kill switch', 'Active kill switch')}
                  type="checkbox"
                  checked={killSwitch}
                  disabled={savingSetting}
                  onChange={(event) => {
                    if (event.target.checked) {
                      void saveSettings({
                        killSwitch: true,
                        sendEnabled: false,
                        campaignSendEnabled: false,
                      });
                    } else {
                      void saveSettings({ killSwitch: false });
                    }
                  }}
                  className="toggle h-4 w-8"
                />
              </label>
              <div className="flex items-end gap-2 border-t border-th-border pt-3">
                <label className="flex-1 text-sm">
                  <span className="mb-1 block text-th-secondary">
                    Keep message logs for (days)
                  </span>
                  <input
                    type="number"
                    min={30}
                    max={3650}
                    className="input-field"
                    value={retentionValue}
                    onChange={(event) => setRetentionDays(Number(event.target.value) || 30)}
                  />
                </label>
                <button
                  className="btn btn-ghost"
                  disabled={savingSetting || retentionValue === data?.settings?.retentionDays}
                  onClick={() => void saveSettings({ retentionDays: retentionValue })}
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="card p-5">
              <p className="text-xs text-th-muted">Queued events</p>
              <p className="mt-1 text-lg font-semibold">{data?.queue?.pending ?? 0}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-th-muted">Failed events</p>
              <p className="mt-1 text-lg font-semibold">{data?.queue?.failed ?? 0}</p>
              {data?.queue?.lastError?.lastError && (
                <p className="mt-1 text-xs text-[#e74c3c]">
                  {data.queue.lastError.lastError}
                </p>
              )}
            </div>
            <div className="card p-5">
              <p className="text-xs text-th-muted">Messages sent today</p>
              <p className="mt-1 text-lg font-semibold">{data?.today?.submitted ?? 0}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-th-muted">Delivered today</p>
              <p className="mt-1 text-lg font-semibold">{data?.today?.delivered ?? 0}</p>
            </div>
          </div>

          <div className="card space-y-2 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={16} /> Worker and compute
            </h3>
            <p className="text-sm text-th-secondary">
              Inline worker: {worker?.inline ? 'yes' : 'no'} · poll every{' '}
              {Math.round((worker?.pollMs ?? 0) / 1000)}s · poll interval and send window are
              controlled by server environment variables.
            </p>
            <p className="text-sm text-th-secondary">
              Send window:{' '}
              {worker?.windowEnabled
                ? `${worker.windowStart}:00–${worker.windowEnd}:00 (${worker.windowTimezone})`
                : 'always on'}
              {worker?.windowEnabled ? ` · currently ${worker.windowOpen ? 'open' : 'paused'}` : ''}
            </p>
            <p className="text-xs text-th-muted">
              On Neon, keep the worker window enabled and scale-to-zero on so idle hours do not
              consume compute.
            </p>
          </div>
        </>
      )}

      {!!data && tab !== 'overview' && (
        <div className="card p-4 md:p-6">
          {tab === 'templates' && <CommunicationsTemplates />}
          {tab === 'automation' && <CommunicationsAutomation />}
          {tab === 'consent' && <CommunicationsConsent />}
          {tab === 'campaigns' && <CommunicationsCampaigns />}
          {tab === 'logs' && <CommunicationsLogs />}
        </div>
      )}
    </div>
  );
}
