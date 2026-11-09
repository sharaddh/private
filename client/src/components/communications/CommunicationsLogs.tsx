import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import Modal from '../Modal';
import { useToast } from '../../context/ToastContext';
import {
  communicationsService,
  type MessageLogEntry,
} from '../../services/communications.service';

interface MessageDetail extends MessageLogEntry {
  outbox?: {
    eventType: string;
    entityType: string;
    entityId: string;
    attempts: number;
    lastError?: string | null;
    lastErrorClass?: string | null;
  } | null;
  template?: { metaTemplateName: string; languageCode: string; localStatus: string } | null;
}

const STATUS_OPTIONS = [
  'submitting',
  'submitted',
  'sent',
  'delivered',
  'read',
  'retryable',
  'failed',
  'submission_unknown',
  'skipped',
  'received',
];

function statusColor(status: string): string {
  if (status === 'delivered' || status === 'read' || status === 'sent') {
    return 'bg-[#1ed760]/15 text-[#1ed760]';
  }
  if (status === 'failed' || status === 'submission_unknown') {
    return 'bg-[#e74c3c]/15 text-[#e74c3c]';
  }
  if (status === 'retryable') return 'bg-amber-400/15 text-amber-400';
  return 'bg-th-elevated text-th-secondary';
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export default function CommunicationsLogs() {
  const toast = useToast();
  const [logs, setLogs] = useState<MessageLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [detail, setDetail] = useState<MessageDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await communicationsService.listLogs({
        status: status || undefined,
        search: appliedSearch.trim() || undefined,
        page: 1,
        limit: 50,
        sort: 'createdAt',
        order: 'desc',
      });
      if (res.success && res.data) {
        setLogs(res.data);
      } else {
        toast.error(res.message || 'Unable to load message logs');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load message logs');
    } finally {
      setLoading(false);
    }
  }, [status, appliedSearch, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    try {
      const res = await communicationsService.getLog(id);
      if (res.success && res.data) {
        setDetail(res.data as MessageDetail);
      } else {
        toast.error(res.message || 'Unable to load message detail');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load message detail');
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Message logs</h2>
        <p className="text-sm text-th-secondary">
          Phone numbers stay masked. Open a row to see delivery timestamps and the failure reason.
        </p>
      </div>

      <div className="card flex flex-col gap-2 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-th-secondary"
          />
          <input
            className="input-field pl-10"
            placeholder="Search customer, template, or bill"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                if (search.trim() === appliedSearch.trim()) void load();
                else setAppliedSearch(search);
              }
            }}
          />
        </div>
        <select
          className="input-field sm:w-48"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="space-y-2">
        {logs.map((log) => (
          <button
            key={log.id}
            className="card flex w-full flex-col gap-2 p-3 text-left sm:flex-row sm:items-center"
            onClick={() => void openDetail(log.id)}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {log.templateName || log.contentPreview || 'Message'}
              </p>
              <p className="text-xs text-th-secondary">
                {log.phoneMasked} · {log.customer?.name || 'unknown customer'} ·{' '}
                {formatDate(log.createdAt)}
              </p>
              {log.errorMessageSafe && (
                <p className="mt-1 text-xs text-[#e74c3c]">{log.errorMessageSafe}</p>
              )}
            </div>
            <span className={`self-start rounded-full px-2 py-0.5 text-xs ${statusColor(log.status)}`}>
              {log.status}
            </span>
            <span className="self-start rounded-full bg-th-elevated px-2 py-0.5 text-xs text-th-secondary">
              {log.category || 'utility'}
            </span>
          </button>
        ))}
        {!loading && logs.length === 0 && (
          <div className="card p-6 text-sm text-th-secondary">No messages match these filters.</div>
        )}
      </div>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Message detail"
        size="lg"
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <p>
                <span className="text-th-secondary">Customer:</span>{' '}
                {detail.customer?.name || 'unknown'}
              </p>
              <p>
                <span className="text-th-secondary">Phone:</span> {detail.phoneMasked}
              </p>
              <p>
                <span className="text-th-secondary">Template:</span>{' '}
                {detail.templateName || '—'}
              </p>
              <p>
                <span className="text-th-secondary">Language:</span>{' '}
                {detail.languageCode || '—'}
              </p>
              <p>
                <span className="text-th-secondary">Status:</span>{' '}
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(detail.status)}`}>
                  {detail.status}
                </span>
              </p>
              <p>
                <span className="text-th-secondary">Event:</span>{' '}
                {detail.outbox?.eventType || '—'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ['Submitted', detail.submittedAt],
                ['Sent', detail.sentAt],
                ['Delivered', detail.deliveredAt],
                ['Read', detail.readAt],
                ['Failed', detail.failedAt],
              ].map(([label, value]) => (
                <div key={label} className="rounded border border-th-border p-2">
                  <p className="text-xs text-th-secondary">{label}</p>
                  <p className="text-xs">{formatDate(value as string | null | undefined)}</p>
                </div>
              ))}
            </div>

            {(detail.errorCode || detail.errorMessageSafe) && (
              <div className="rounded border border-[#e74c3c]/40 bg-[#e74c3c]/10 p-3">
                <p className="font-medium text-[#e74c3c]">
                  Error {detail.errorCode || ''}
                </p>
                <p className="text-th-secondary">{detail.errorMessageSafe || 'Unknown error'}</p>
                {detail.outbox?.lastError && (
                  <p className="mt-1 text-xs text-th-secondary">
                    Outbox: {detail.outbox.lastError}
                  </p>
                )}
              </div>
            )}

            <div>
              <p className="mb-1 font-medium">Content preview</p>
              <p className="text-th-secondary">{detail.contentPreview || '—'}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
