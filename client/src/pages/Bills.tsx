import { useState, useCallback, useEffect } from 'react';
import Table from '../components/Table';
import PageSkeleton from '../components/PageSkeleton';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTranslate } from '../context/TranslateContext';
import { Printer, FileText as PdfIcon, Trash2 } from 'lucide-react';
import { downloadBillPdf, generateBillPdf, generateThermalReceipt } from '../utils/pdf';
import DateRangePicker from '../components/DateRangePicker';
import { todayStr } from '../utils/date';
import { billService, settingsService } from '../services';
import type { Bill, ShopSettings } from '../types';

type ResolvedCustomer = { name?: string; mobile?: string; address?: string } | null;

export default function Bills() {
  const [list, setList] = useState<Bill[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const toast = useToast();
  const { isStaff } = useAuth();
  const { t, uiT } = useTranslate();

  const fetchBills = useCallback(() => {
    setLoading(true);
    billService
      .listFiltered({ startDate, endDate })
      .then((d) => {
        if (d.success) setList(d.data?.data || []);
      })
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const fetchSettings = useCallback(() => {
    settingsService.get().then((d) => {
      if (d.success) setSettings(d.data || null);
    });
  }, []);

  useEffect(() => {
    fetchBills();
    fetchSettings();
  }, [fetchBills, fetchSettings]);

  function resolveCustomer(bill: Bill): ResolvedCustomer {
    return bill.customer || (typeof bill.customerId === 'object' && bill.customerId ? bill.customerId : null);
  }

  function handleThermalPrint(bill: Bill) {
    const customer = resolveCustomer(bill) || {};
    const receipt = generateThermalReceipt(bill, customer, settings || {});
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html><head><title>Thermal Receipt - ${bill.billNumber}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 16px; line-height: 1.3;
         margin: 0; padding: 4mm; width: 72mm; color: #000; background: #fff;
         white-space: pre-wrap; }
  @media print { body { margin: 0; padding: 2mm; } }
</style></head><body>${receipt.replace(/\n/g, '<br>')}
<script>window.onload = function() { window.print(); }</script>
</body></html>`);
    w.document.close();
  }

  function handleDownloadPdf(bill: Bill) {
    const customer = resolveCustomer(bill) || {};
    downloadBillPdf(bill, customer, settings || {});
  }

  async function handleDelete(bill: Bill) {
    if (!confirm('Delete this bill permanently?')) return;
    const res = await billService.remove(bill._id);
    if (res.success) {
      setList((prev) => prev.filter((b) => b._id !== bill._id));
      toast.success('Bill deleted');
    } else {
      toast.error(res.message || 'Failed to delete');
    }
  }

  if (loading) return <PageSkeleton page="bills" />;

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">{uiT('Bills', 'बिल')}</h1>
        <p className="page-subtitle">View and manage invoices created through visits and orders.</p>
      </div>

      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onChange={(s, e) => {
          setStartDate(s);
          setEndDate(e);
        }}
        count={list.length}
        label="bill"
      />

      <Table
        columns={[
          { key: 'billNumber', label: uiT('Bill #', 'बिल #') },
          {
            key: 'customerId',
            label: uiT('Customer', 'ग्राहक'),
            render: (v: unknown, row: Bill) => {
              const c = resolveCustomer(row);
              return c ? c.name : typeof v === 'string' ? v.slice(-6) : '—';
            },
          },
          {
            key: 'subtotal',
            label: uiT('Subtotal', 'उप-कुल'),
            render: (v) => `₹${((v as number) || 0).toFixed(2)}`,
          },
          {
            key: 'totalAmount',
            label: uiT('Total', 'कुल'),
            render: (v) => (
              <span className="font-semibold">₹{((v as number) || 0).toFixed(2)}</span>
            ),
          },
          {
            key: 'pendingAmount',
            label: uiT('Pending', 'बाकी'),
            render: (v) => (
              <span className={(v as number) > 0 ? 'text-[#e8115b] font-medium' : 'text-[#1ed760]'}>
                {(v as number) > 0 ? `₹${(v as number).toFixed(2)}` : uiT('Paid', 'भुगतान')}
              </span>
            ),
          },
        ]}
        data={list}
        searchPlaceholder={uiT('Search bills...', 'बिल खोजें...')}
        actions={(row: Bill) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleDownloadPdf(row)}
              className="p-1.5 hover:bg-[#e8115b]/10 rounded-lg text-[#e8115b] active:scale-95 transition-transform duration-100"
              title={uiT('Download PDF', 'PDF डाउनलोड करें')}
              aria-label="Download PDF"
            >
              <PdfIcon size={15} />
            </button>
            <button
              onClick={() => handleThermalPrint(row)}
              className="p-1.5 hover:bg-th-elevated rounded-lg text-th-secondary active:scale-95 transition-transform duration-100"
              title={uiT('Thermal Receipt (80mm)', 'थर्मल रसीद (80mm)')}
              aria-label="Thermal print"
            >
              <Printer size={15} />
            </button>
            {!isStaff && (
              <button
                onClick={() => handleDelete(row)}
                className="p-1.5 hover:bg-[#e8115b]/10 rounded-lg text-[#e8115b] active:scale-95 transition-transform duration-100"
                title={uiT('Delete', 'हटाएं')}
                aria-label="Delete bill"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      />
    </div>
  );
}
