import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coffee, Github, RefreshCw } from 'lucide-react';
import type {
  AppSettings,
  BillItem,
  BillStatus,
  CommodityRate,
  EmailCategory,
  EmailItem,
} from './lib/types';
import { DEFAULT_SETTINGS } from './lib/types';
import { fetchFromN8n, STORAGE_KEYS } from './lib/n8n';
import { useLocalStorage } from './lib/useLocalStorage';
import { formatRelative } from './lib/format';
import { SettingsPanel } from './components/SettingsPanel';
import { EmailTriage } from './components/EmailTriage';
import { BillScanner } from './components/BillScanner';
import { CommodityWidget } from './components/CommodityWidget';
import { Badge } from './components/ui';

// Merge incoming n8n items into existing state. New items (by id) are
// prepended; existing items keep their local edits (e.g. moved category,
// follow-up date, bill status) unless explicitly re-supplied by n8n.
function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map((x) => [x.id, x]));
  for (const item of incoming) {
    const cur = map.get(item.id);
    map.set(item.id, cur ? { ...cur, ...item } : item);
  }
  // Incoming-first ordering so new items surface at the top.
  const incomingIds = new Set(incoming.map((x) => x.id));
  const ordered = [...incoming, ...existing.filter((x) => !incomingIds.has(x.id))];
  return ordered;
}

function App() {
  const [settings, setSettings] = useLocalStorage<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  const [emails, setEmails] = useLocalStorage<EmailItem[]>(STORAGE_KEYS.emails, []);
  const [bills, setBills] = useLocalStorage<BillItem[]>(STORAGE_KEYS.bills, []);
  const [commodities, setCommodities] = useLocalStorage<CommodityRate[]>(STORAGE_KEYS.commodities, []);

  const [fetching, setFetching] = useState(false);
  const [lastCommodityUpdate, setLastCommodityUpdate] = useState<string | null>(
    commodities[0]?.updatedAt ?? null,
  );

  const doFetch = useCallback(async () => {
    if (!settings.webhookUrl) return;
    setFetching(true);
    const result = await fetchFromN8n(settings);
    setFetching(false);

    if (result.emails.length) setEmails((prev) => mergeById(prev, result.emails));
    if (result.bills.length) setBills((prev) => mergeById(prev, result.bills));
    if (result.commodities.length) {
      setCommodities((prev) => mergeById(prev, result.commodities));
      setLastCommodityUpdate(new Date().toISOString());
    }
    setSettings({ ...settings, lastFetchedAt: new Date().toISOString() });
  }, [settings, setEmails, setBills, setCommodities, setSettings]);

  // On first mount, if a webhook is configured, pull once so the dashboard
  // isn't stale on a fresh browser open.
  useEffect(() => {
    if (settings.webhookUrl && !settings.lastFetchedAt) doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Email mutations (local only) ----
  const toggleRead = useCallback((id: string) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, read: !e.read } : e)));
  }, [setEmails]);

  const moveEmail = useCallback((id: string, cat: EmailCategory) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, category: cat } : e)));
  }, [setEmails]);

  const followUpEmail = useCallback((id: string, date: string | null) => {
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, followUpDate: date, category: date ? 'need_followup' : e.category } : e)),
    );
  }, [setEmails]);

  // ---- Bill mutations (local only) ----
  const changeBillStatus = useCallback((id: string, status: BillStatus) => {
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }, [setBills]);

  const unreadCount = useMemo(() => emails.filter((e) => !e.read).length, [emails]);
  const outstandingCount = useMemo(() => bills.filter((b) => b.status !== 'paid').length, [bills]);

  const handleIntervalChange = useCallback(
    (s: number) => setSettings({ ...settings, commodityRefreshSeconds: s }),
    [settings, setSettings],
  );

  return (
    <div className="mrd-app">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: 'var(--mrd-primary)', color: 'white', boxShadow: 'var(--mrd-shadow)' }}
            >
              <Coffee size={22} />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Morning Routine Dashboard</h1>
              <p className="text-xs text-[var(--mrd-text-muted)]">
                Local-first · talks to your n8n webhook · nothing leaves this laptop
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">
              <RefreshCw size={11} className={fetching ? 'animate-spin' : ''} />
              {fetching ? 'Fetching…' : `Synced ${formatRelative(settings.lastFetchedAt)}`}
            </Badge>
            <Badge tone="info">{unreadCount} unread</Badge>
            <Badge tone="warning">{outstandingCount} open bills</Badge>
            <a
              href="https://docs.n8n.io"
              target="_blank"
              rel="noreferrer"
              className="mrd-focus inline-flex items-center gap-1 rounded-lg border border-[var(--mrd-border-strong)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--mrd-text-muted)] hover:text-[var(--mrd-text)]"
            >
              <Github size={13} /> n8n docs
            </a>
          </div>
        </header>

        <div className="grid gap-5">
          <SettingsPanel
            settings={settings}
            onChange={setSettings}
            onFetchNow={doFetch}
            fetching={fetching}
          />

          <EmailTriage
            emails={emails}
            onToggleRead={toggleRead}
            onMove={moveEmail}
            onFollowUp={followUpEmail}
          />

          <BillScanner bills={bills} onStatusChange={changeBillStatus} />

          <CommodityWidget
            rates={commodities}
            seconds={settings.commodityRefreshSeconds}
            autoRefresh={settings.autoRefreshCommodities}
            lastUpdated={lastCommodityUpdate}
            refreshing={fetching}
            onRefresh={doFetch}
            onIntervalChange={handleIntervalChange}
          />
        </div>

        <footer className="mt-8 flex items-center justify-between text-[11px] text-[var(--mrd-text-faint)]">
          <span>All state is held in this browser's localStorage. No cloud database used.</span>
          <span>{emails.length} emails · {bills.length} bills · {commodities.length} commodities</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
