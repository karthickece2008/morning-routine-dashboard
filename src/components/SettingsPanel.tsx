import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Plug, RefreshCw, Save, Webhook } from 'lucide-react';
import type { AppSettings, ConnectionStatus } from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/types';
import { testConnection } from '../lib/n8n';
import { formatRelative } from '../lib/format';
import { Button, SectionCard, StatusDot, TextField } from './ui';

// App Settings Panel: webhook URL, connection test, manual fetch, and
// commodity auto-refresh controls. All values persist via the parent's
// localStorage-backed settings state.

export function SettingsPanel({
  settings,
  onChange,
  onFetchNow,
  fetching,
}: {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  onFetchNow: () => void;
  fetching: boolean;
}) {
  const [draftUrl, setDraftUrl] = useState(settings.webhookUrl);
  const [savedFlash, setSavedFlash] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('unknown');
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the input in sync if settings change elsewhere (e.g. reset).
  useEffect(() => setDraftUrl(settings.webhookUrl), [settings.webhookUrl]);

  const runTest = useCallback(
    async (url: string) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setStatus('testing');
      const ok = await testConnection(url, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setStatus(ok ? 'connected' : 'disconnected');
      setLastCheckedAt(new Date().toISOString());
    },
    [],
  );

  // Re-test whenever the persisted URL changes (e.g. on first load if set).
  useEffect(() => {
    if (settings.webhookUrl) runTest(settings.webhookUrl);
    else setStatus('unknown');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.webhookUrl]);

  const handleSave = () => {
    const url = draftUrl.trim();
    onChange({ ...settings, webhookUrl: url });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
    if (url) runTest(url);
    else setStatus('unknown');
  };

  const handleReset = () => {
    setDraftUrl('');
    onChange({ ...DEFAULT_SETTINGS, webhookUrl: '' });
    setStatus('unknown');
  };

  return (
    <SectionCard
      title="App Settings"
      subtitle="Connect this dashboard to your local n8n webhook. Data stays on this laptop."
      icon={<Plug size={18} />}
      actions={
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <span className="text-xs text-[var(--mrd-text-muted)]">
            {status === 'testing' ? 'Testing…' : status === 'connected' ? 'Connected' : status === 'disconnected' ? 'Disconnected' : 'Not tested'}
          </span>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <TextField
          label="Local n8n Webhook URL"
          value={draftUrl}
          onChange={setDraftUrl}
          placeholder="http://localhost:5678/webhook/morning-routine"
          hint={
            savedFlash
              ? 'Saved.'
              : 'Production/test URL of your n8n webhook node. GET is used for both the connection test and data fetch.'
          }
        />
        <div className="flex items-end gap-2">
          <Button variant="primary" onClick={handleSave}>
            <Save size={15} /> Save
          </Button>
          <Button
            variant="outline"
            onClick={() => runTest(settings.webhookUrl)}
            disabled={!settings.webhookUrl || status === 'testing'}
            title="Re-test connection"
          >
            <Activity size={15} /> Test
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--mrd-border)] bg-[var(--mrd-surface-2)] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--mrd-text-muted)]">Connection</span>
            <StatusDot status={status} withLabel />
          </div>
          <p className="mt-2 text-xs text-[var(--mrd-text-faint)]">
            Last checked {formatRelative(lastCheckedAt)}.
            {settings.webhookUrl ? '' : ' No webhook configured yet.'}
          </p>
        </div>

        <div className="rounded-lg border border-[var(--mrd-border)] bg-[var(--mrd-surface-2)] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--mrd-text-muted)]">Manual fetch</span>
            <span className="text-xs text-[var(--mrd-text-faint)]">
              Last: {formatRelative(settings.lastFetchedAt)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--mrd-text-muted)]">
              <Webhook size={13} /> Pull from n8n now
            </span>
            <Button
              variant="subtle"
              size="sm"
              onClick={onFetchNow}
              disabled={!settings.webhookUrl || fetching}
            >
              <RefreshCw size={13} className={fetching ? 'animate-spin' : ''} />
              {fetching ? 'Fetching…' : 'Fetch now'}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[var(--mrd-border)] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[var(--mrd-text-muted)]">Commodity auto-refresh</p>
            <p className="mt-0.5 text-xs text-[var(--mrd-text-faint)]">
              Pull fresh rates every {Math.round(settings.commodityRefreshSeconds / 60)} min.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...settings, autoRefreshCommodities: !settings.autoRefreshCommodities })}
            className="mrd-focus relative inline-flex h-6 w-11 items-center rounded-full transition"
            style={{
              background: settings.autoRefreshCommodities ? 'var(--mrd-primary)' : 'var(--mrd-border-strong)',
            }}
            aria-pressed={settings.autoRefreshCommodities}
            aria-label="Toggle commodity auto-refresh"
          >
            <span
              className="inline-block h-4 w-4 transform rounded-full bg-white transition"
              style={{ transform: settings.autoRefreshCommodities ? 'translateX(24px)' : 'translateX(4px)' }}
            />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={60}
            max={900}
            step={60}
            value={settings.commodityRefreshSeconds}
            onChange={(e) => onChange({ ...settings, commodityRefreshSeconds: Number(e.target.value) })}
            className="mrd-range flex-1"
            disabled={!settings.autoRefreshCommodities}
          />
          <span className="w-20 shrink-0 text-right text-xs tabular-nums text-[var(--mrd-text-muted)]">
            {Math.round(settings.commodityRefreshSeconds / 60)} min
          </span>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={handleReset} title="Clear saved webhook URL">
          Clear settings
        </Button>
      </div>
    </SectionCard>
  );
}
