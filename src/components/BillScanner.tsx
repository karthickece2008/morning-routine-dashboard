import { useMemo, useState } from 'react';
import { FileText, Search, SlidersHorizontal } from 'lucide-react';
import type { BillItem, BillStatus } from '../lib/types';
import { BILL_STATUS_META } from '../lib/types';
import { daysUntil, formatDate, formatMoney } from '../lib/format';
import { Badge, Button, EmptyState, SectionCard } from './ui';

// Bill & Invoice Scanner: a structured table that grows as bill objects
// arrive from n8n. Supports text search, status filter, and per-row
// status changes (kept locally).

type SortKey = 'vendor' | 'amount' | 'dueDate' | 'status';

const STATUS_FILTERS: { value: BillStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

function StatusPill({ status }: { status: BillStatus }) {
  const meta = BILL_STATUS_META[status];
  return <Badge tone={meta.tone as 'success' | 'warning' | 'info' | 'danger'}>{meta.label}</Badge>;
}

export function BillScanner({
  bills,
  onStatusChange,
}: {
  bills: BillItem[];
  onStatusChange: (id: string, status: BillStatus) => void;
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = bills.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (!q) return true;
      return (
        b.vendor.toLowerCase().includes(q) ||
        b.invoiceRef?.toLowerCase().includes(q) ||
        b.currency.toLowerCase().includes(q)
      );
    });
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'vendor': cmp = a.vendor.localeCompare(b.vendor); break;
        case 'amount': cmp = a.amount - b.amount; break;
        case 'dueDate': cmp = a.dueDate.localeCompare(b.dueDate); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [bills, query, statusFilter, sortKey, sortDir]);

  const totals = useMemo(() => {
    const byCur = new Map<string, number>();
    for (const b of bills) {
      if (b.status === 'paid') continue;
      byCur.set(b.currency, (byCur.get(b.currency) ?? 0) + b.amount);
    }
    return Array.from(byCur.entries());
  }, [bills]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ k, label, align = 'left' }: { k: SortKey; label: string; align?: 'left' | 'right' }) => (
    <th>
      <button
        onClick={() => toggleSort(k)}
        className={`mrd-focus inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''} ${sortKey === k ? 'text-[var(--mrd-text)]' : ''}`}
      >
        {label}
        {sortKey === k && <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  );

  return (
    <SectionCard
      title="Bill & Invoice Scanner"
      subtitle="Structured rows pulled from n8n. Search, filter, and update status without leaving the table."
      icon={<FileText size={18} />}
      actions={
        totals.length > 0 ? (
          <div className="hidden items-center gap-3 sm:flex">
            {totals.map(([cur, amt]) => (
              <div key={cur} className="text-right">
                <p className="text-[10px] uppercase text-[var(--mrd-text-faint)]">Outstanding</p>
                <p className="text-sm font-semibold tabular-nums">{formatMoney(amt, cur)}</p>
              </div>
            ))}
          </div>
        ) : undefined
      }
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mrd-text-faint)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendor, ref…"
            className="mrd-focus w-full rounded-lg border border-[var(--mrd-border-strong)] bg-white py-2 pl-9 pr-3 text-sm placeholder:text-[var(--mrd-text-faint)]"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <SlidersHorizontal size={14} className="shrink-0 text-[var(--mrd-text-faint)]" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`mrd-focus shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                statusFilter === f.value
                  ? 'bg-[var(--mrd-primary)] text-white'
                  : 'bg-[#eef0f5] text-[var(--mrd-text-muted)] hover:bg-[#e3e6ee]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto mrd-scroll">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--mrd-border)] text-left text-xs uppercase tracking-wide text-[var(--mrd-text-faint)]">
              <SortHeader k="vendor" label="Vendor" />
              <th className="py-2 pr-3 text-right">Invoice</th>
              <SortHeader k="amount" label="Amount" align="right" />
              <SortHeader k="dueDate" label="Due Date" />
              <SortHeader k="status" label="Status" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-2">
                  <EmptyState
                    icon={<FileText size={22} />}
                    title={bills.length === 0 ? 'No bills yet' : 'No bills match your filters'}
                    hint="Bills sent from n8n will appear here automatically."
                  />
                </td>
              </tr>
            ) : (
              filtered.map((b) => {
                const days = daysUntil(b.dueDate);
                const dueSoon = b.status !== 'paid' && days !== null && days >= 0 && days <= 3;
                const overdue = b.status !== 'paid' && days !== null && days < 0;
                return (
                  <tr
                    key={b.id}
                    className="mrd-rise border-b border-[var(--mrd-border)] last:border-0 hover:bg-[var(--mrd-surface-2)]"
                  >
                    <td className="py-3 pr-3">
                      <div className="font-medium">{b.vendor}</div>
                      {b.invoiceRef && (
                        <div className="text-[11px] text-[var(--mrd-text-faint)]">{b.invoiceRef}</div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-right align-top">
                      <span className="text-[11px] text-[var(--mrd-text-faint)]">#{b.id.slice(-5)}</span>
                    </td>
                    <td className="py-3 pr-3 text-right align-top font-semibold tabular-nums">
                      {formatMoney(b.amount, b.currency)}
                    </td>
                    <td className="py-3 pr-3 align-top">
                      <div className="flex items-center gap-2">
                        <span>{formatDate(b.dueDate)}</span>
                        {dueSoon && <Badge tone="warning">Due soon</Badge>}
                        {overdue && <Badge tone="danger">Overdue</Badge>}
                      </div>
                      {days !== null && (
                        <div className="text-[11px] text-[var(--mrd-text-faint)]">
                          {days >= 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${Math.abs(days)}d overdue`}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 align-top">
                      <div className="flex items-center gap-2">
                        <StatusPill status={b.status} />
                        <select
                          value={b.status}
                          onChange={(e) => onStatusChange(b.id, e.target.value as BillStatus)}
                          className="mrd-focus rounded border border-[var(--mrd-border-strong)] bg-white px-1.5 py-1 text-xs"
                          title="Change status"
                        >
                          {(Object.keys(BILL_STATUS_META) as BillStatus[]).map((s) => (
                            <option key={s} value={s}>{BILL_STATUS_META[s].label}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {bills.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs text-[var(--mrd-text-faint)]">
          <span>{filtered.length} of {bills.length} bills</span>
          <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setStatusFilter('all'); }}>
            Reset filters
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
