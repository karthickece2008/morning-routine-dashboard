import type { AppSettings, BillItem, CommodityRate, EmailItem, N8nPayload } from './types';

// Lightweight, defensive adapter for talking to a local n8n webhook.
// n8n "Respond to Webhook" nodes can return arbitrary JSON; this module
// normalises whatever shape arrives into the dashboard's domain types and
// never throws on a missing/malformed field.

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : v == null ? fallback : String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(str(v));
  return Number.isFinite(n) ? n : fallback;
}

function toISODate(v: unknown): string {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function toISOTime(v: unknown): string {
  if (typeof v === 'string' && /\d{4}-\d{2}-\d{2}T/.test(v)) return v;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function pickCategory(v: unknown): EmailItem['category'] {
  const s = str(v).toLowerCase().replace(/[-\s]/g, '_');
  if (s.includes('follow')) return 'need_followup';
  if (s.includes('attention') || s.includes('action') || s.includes('urgent')) return 'need_attention';
  return 'unread';
}

function pickBillStatus(v: unknown): BillItem['status'] {
  const s = str(v).toLowerCase();
  if (s.includes('paid')) return 'paid';
  if (s.includes('sched')) return 'scheduled';
  if (s.includes('overdue') || s.includes('late')) return 'overdue';
  return 'unpaid';
}

export interface FetchResult {
  emails: EmailItem[];
  bills: BillItem[];
  commodities: CommodityRate[];
}

export function normalisePayload(payload: unknown): FetchResult {
  const root = (payload ?? {}) as N8nPayload;
  // n8n sometimes wraps single items in an array and sometimes returns
  // { data: [...] }; accept both.
  const unwrap = <T,>(field: unknown): T[] => {
    if (Array.isArray(field)) return field as T[];
    if (field && typeof field === 'object' && 'data' in (field as Record<string, unknown>)) {
      const inner = (field as Record<string, unknown>).data;
      return Array.isArray(inner) ? (inner as T[]) : [];
    }
    return [];
  };

  const emails = unwrap<Partial<EmailItem>>(root.emails).map((e) => ({
    id: str(e.id) || uid('mail'),
    subject: str(e.subject, '(no subject)'),
    sender: str(e.sender, 'Unknown sender'),
    snippet: str(e.snippet),
    category: pickCategory(e.category),
    receivedAt: toISOTime(e.receivedAt),
    read: Boolean(e.read),
    followUpDate: e.followUpDate ? toISODate(e.followUpDate) : null,
    body: e.body ? str(e.body) : undefined,
  }));

  const bills = unwrap<Partial<BillItem>>(root.bills).map((b) => ({
    id: str(b.id) || uid('bill'),
    vendor: str(b.vendor, 'Unknown vendor'),
    amount: num(b.amount),
    currency: str(b.currency, 'USD').toUpperCase(),
    dueDate: toISODate(b.dueDate),
    status: pickBillStatus(b.status),
    invoiceRef: b.invoiceRef ? str(b.invoiceRef) : undefined,
  }));

  const commodities = unwrap<Partial<CommodityRate>>(root.commodities).map((c) => ({
    id: str(c.id) || uid('com'),
    symbol: str(c.symbol, '???').toUpperCase(),
    name: str(c.name, str(c.symbol, 'Commodity')),
    unit: str(c.unit, 'unit'),
    price: num(c.price),
    currency: str(c.currency, 'USD').toUpperCase(),
    changePct: c.changePct == null ? undefined : num(c.changePct),
    updatedAt: toISOTime(c.updatedAt),
  }));

  return { emails, bills, commodities };
}

// Probe the webhook with a lightweight HEAD/GET. n8n webhook nodes respond
// even without a body, so we treat any 2xx/3xx as "connected".
export async function testConnection(url: string, signal?: AbortSignal): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal,
      headers: { Accept: 'application/json' },
    });
    return res.ok || (res.status >= 300 && res.status < 400);
  } catch {
    return false;
  }
}

// Fetch and parse the data stream from the webhook. On network/parse failure
// returns an empty result rather than throwing, so the UI keeps working.
export async function fetchFromN8n(settings: AppSettings, signal?: AbortSignal): Promise<FetchResult> {
  if (!settings.webhookUrl) return { emails: [], bills: [], commodities: [] };
  try {
    const res = await fetch(settings.webhookUrl, {
      method: 'GET',
      signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return { emails: [], bills: [], commodities: [] };
    const json = await res.json();
    return normalisePayload(json);
  } catch {
    return { emails: [], bills: [], commodities: [] };
  }
}

export const STORAGE_KEYS = {
  settings: 'mrd.settings',
  emails: 'mrd.emails',
  bills: 'mrd.bills',
  commodities: 'mrd.commodities',
} as const;
