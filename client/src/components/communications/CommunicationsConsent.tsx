import { useState } from 'react';
import { Search, ShieldCheck, UserRound } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  communicationsService,
  type CustomerPreferenceView,
  type ConsentPreference,
} from '../../services/communications.service';
import { customerService } from '../../services/customer.service';
import type { Customer } from '../../types';

interface ConsentFormState {
  consentStatus: 'unknown' | 'opted_in' | 'opted_out';
  transactionalConsent: boolean;
  marketingConsent: boolean;
  source: string;
  evidence: string;
}

function toForm(preference: ConsentPreference): ConsentFormState {
  return {
    consentStatus: preference.consentStatus,
    transactionalConsent: preference.transactionalConsent,
    marketingConsent: preference.marketingConsent,
    source: preference.consentSource || '',
    evidence: preference.consentEvidence || '',
  };
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export default function CommunicationsConsent() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [view, setView] = useState<CustomerPreferenceView | null>(null);
  const [form, setForm] = useState<ConsentFormState | null>(null);
  const [saving, setSaving] = useState(false);

  async function search() {
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    try {
      const res = await customerService.search(term, { limit: 8 });
      if (res.success && res.data) {
        setResults(res.data.data || []);
        if ((res.data.data || []).length === 0) {
          toast.info('No customers matched that search');
        }
      } else {
        toast.error(res.message || 'Unable to search customers');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to search customers');
    } finally {
      setSearching(false);
    }
  }

  async function loadView(customerId: string) {
    try {
      const res = await communicationsService.getCustomerPreferences(customerId);
      if (res.success && res.data) {
        setView(res.data);
        setForm(toForm(res.data.preference));
      } else {
        toast.error(res.message || 'Unable to load consent');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load consent');
    }
  }

  function openCustomer(customer: Customer) {
    void loadView(customer._id);
  }

  async function save() {
    if (!view || !form) return;
    setSaving(true);
    try {
      const res = await communicationsService.patchCustomerPreferences(
        view.customer.id,
        {
          consentStatus: form.consentStatus,
          transactionalConsent: form.transactionalConsent,
          marketingConsent: form.marketingConsent,
          source: form.source.trim() || 'admin',
          evidence: form.evidence.trim() || undefined,
        }
      );
      if (res.success) {
        toast.success('Consent updated');
        await loadView(view.customer.id);
      } else {
        toast.error(res.message || 'Unable to save consent');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save consent');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Customer consent</h2>
        <p className="text-sm text-th-secondary">
          No message is sent without consent. Record where and when the customer opted in, or mark
          them opted out.
        </p>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-th-secondary"
            />
            <input
              className="input-field pl-10"
              placeholder="Search by name, phone, or customer ID"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void search();
              }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => void search()} disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
        {results.length > 0 && (
          <div className="mt-3 divide-y divide-th-border rounded-md border border-th-border">
            {results.map((customer) => (
              <button
                key={customer._id}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-th-hover"
                onClick={() => void openCustomer(customer)}
              >
                <span>
                  <span className="font-medium">{customer.name}</span>
                  <span className="ml-2 text-th-secondary">{customer.mobile || 'no phone'}</span>
                </span>
                <span className="text-xs text-th-muted">{customer.customerId}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view && form && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card space-y-3 p-5 lg:col-span-2">
            <div className="flex items-center gap-2">
              <UserRound size={18} />
              <span className="font-medium">{view.customer.name}</span>
              <span className="text-sm text-th-secondary">{view.preference.phoneE164Masked}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-th-secondary">Consent status</span>
                <select
                  className="input-field"
                  value={form.consentStatus}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      consentStatus: event.target.value as ConsentFormState['consentStatus'],
                    })
                  }
                >
                  <option value="unknown">Unknown</option>
                  <option value="opted_in">Opted in</option>
                  <option value="opted_out">Opted out</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-th-secondary">Source</span>
                <input
                  className="input-field"
                  placeholder="counter, phone call, form…"
                  value={form.source}
                  onChange={(event) => setForm({ ...form, source: event.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="toggle h-4 w-8"
                  checked={form.transactionalConsent}
                  disabled={form.consentStatus === 'opted_out'}
                  onChange={(event) =>
                    setForm({ ...form, transactionalConsent: event.target.checked })
                  }
                />
                <span>Transactional consent</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="toggle h-4 w-8"
                  checked={form.marketingConsent}
                  disabled={form.consentStatus === 'opted_out'}
                  onChange={(event) =>
                    setForm({ ...form, marketingConsent: event.target.checked })
                  }
                />
                <span>Marketing consent</span>
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-th-secondary">Evidence</span>
              <textarea
                className="input-field min-h-[80px]"
                placeholder="What did the customer agree to, and where?"
                value={form.evidence}
                onChange={(event) => setForm({ ...form, evidence: event.target.value })}
              />
            </label>
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : 'Save consent'}
              </button>
            </div>
          </div>

          <div className="card space-y-3 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={16} /> Consent audit
            </h3>
            <p className="text-xs text-th-secondary">
              Phone validation: {view.preference.phoneValidationStatus} · Updated{' '}
              {formatDate(view.preference.lastConsentUpdatedAt as unknown as string)}
            </p>
            <div className="space-y-2">
              {(view.audits || []).map((audit) => (
                <div key={audit.id} className="rounded border border-th-border p-2 text-xs">
                  <p className="font-medium">
                    {audit.action} · {audit.toStatus || 'unknown'}
                  </p>
                  <p className="text-th-secondary">
                    {audit.source || 'unknown source'} · {formatDate(audit.createdAt)}
                  </p>
                  {audit.evidence && <p className="text-th-muted">{audit.evidence}</p>}
                </div>
              ))}
              {(view.audits || []).length === 0 && (
                <p className="text-xs text-th-secondary">No consent changes recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
