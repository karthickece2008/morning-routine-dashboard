// Shared domain types for the Morning Routine Dashboard.
// Everything is local-first: no cloud schema, these shapes just mirror
// what the n8n webhook is expected to send.

export type EmailCategory = 'unread' | 'need_attention' | 'need_followup';

export interface EmailItem {
  id: string;
  subject: string;
  sender: string;
  snippet: string;
  category: EmailCategory;
  receivedAt: string; // ISO timestamp
  read: boolean;
  followUpDate?: string | null; // ISO date (yyyy-mm-dd) or null
  body?: string;
}

export type BillStatus = 'unpaid' | 'scheduled' | 'paid' | 'overdue';

export interface BillItem {
  id: string;
  vendor: string;
  amount: number;
  currency: string;
  dueDate: string; // ISO date (yyyy-mm-dd)
  status: BillStatus;
  invoiceRef?: string;
}

export interface CommodityRate {
  id: string;
  symbol: string;
  name: string;
  unit: string;
  price: number;
  currency: string;
  changePct?: number; // percent change since last tick
  updatedAt: string; // ISO timestamp
}

export interface N8nPayload {
  emails?: Partial<EmailItem>[];
  bills?: Partial<BillItem>[];
  commodities?: Partial<CommodityRate>[];
}

export type ConnectionStatus = 'unknown' | 'testing' | 'connected' | 'disconnected' | 'error';

export interface AppSettings {
  webhookUrl: string;
  lastFetchedAt: string | null;
  autoRefreshCommodities: boolean;
  commodityRefreshSeconds: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  webhookUrl: '',
  lastFetchedAt: null,
  autoRefreshCommodities: true,
  commodityRefreshSeconds: 300,
};

// Human-readable labels and ordering for category columns.
export const EMAIL_COLUMNS: { key: EmailCategory; label: string; hint: string }[] = [
  { key: 'unread', label: 'Unread', hint: 'New and unopened' },
  { key: 'need_attention', label: 'Need Attention', hint: 'Requires a reply or action' },
  { key: 'need_followup', label: 'Need Follow-up', hint: 'Snoozed to a future date' },
];

export const BILL_STATUS_META: Record<BillStatus, { label: string; tone: string }> = {
  unpaid: { label: 'Unpaid', tone: 'warning' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
  overdue: { label: 'Overdue', tone: 'danger' },
};
