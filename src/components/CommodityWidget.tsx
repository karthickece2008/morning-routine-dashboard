import { useCallback, useEffect, useRef, useState } from 'react';
import { Gauge, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import type { CommodityRate } from '../lib/types';
import { formatCountdown, formatMoney, formatRelative } from '../lib/format';
import { Badge, Button, EmptyState, SectionCard } from './ui';

// Commodity Rates Widget: shows live prices for custom commodities and
// runs a visible countdown; when it hits zero it asks the parent to fetch
// fresh data from the n8n webhook, then restarts.

export function CommodityWidget({
  rates,
  seconds,
  autoRefresh,
  lastUpdated,
  refreshing,
  onRefresh,
  onIntervalChange,
}: {
  rates: CommodityRate[];
  seconds: number;
  autoRefresh: boolean;
  lastUpdated: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onIntervalChange: (s: number) => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const tickRef = useRef<number | null>(null);

  // Whenever the configured interval changes (or auto-refresh toggles),
  // reset the countdown so the user immediately sees the new target.
  useEffect(() => {
    setRemaining(seconds);
  }, [seconds, autoRefresh]);

  const tick = useCallback(() => {
    setRemaining((r) => {
      if (r <= 1) {
        if (autoRefresh) onRefresh();
        return seconds;
      }
      return r - 1;
    });
  }, [autoRefresh, onRefresh, seconds]);

  useEffect(() => {
    if (!autoRefresh) return;
    tickRef.current = window.setInterval(tick, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [autoRefresh, tick]);

  const progress = Math.min(100, Math.max(0, ((seconds - remaining) / seconds) * 100));
  const urgent = remaining <= 10;

  return (
    <SectionCard
      title="Commodity Rates"
      subtitle="Auto-refreshes from your n8n webhook when the countdown ends."
      icon={<Gauge size={18} />}
      actions={
        <Button variant="subtle" size="sm" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </Button>
      }
    >
      <div className="mb-4 rounded-lg border border-[var(--mrd-border)] bg-[var(--mrd-surface-2)] p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--mrd-text-muted)]">
              {autoRefresh ? 'Next auto-refresh in' : 'Auto-refresh off'}
            </p>
            <p
              className="mt-0.5 font-mono text-2xl font-semibold tabular-nums"
              style={{ color: urgent && autoRefresh ? 'var(--mrd-accent)' : 'var(--mrd-text)' }}
            >
              {autoRefresh ? formatCountdown(remaining) : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-[var(--mrd-text-muted)]">Last update</p>
            <p className="mt-0.5 text-sm tabular-nums text-[var(--mrd-text)]">{formatRelative(lastUpdated)}</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--mrd-border-strong)]">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{
              width: `${progress}%`,
              background: urgent ? 'var(--mrd-accent)' : 'var(--mrd-primary)',
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--mrd-text-faint)]">
          <span>Interval: {Math.round(seconds / 60)} min</span>
          <button
            onClick={() => onIntervalChange(seconds === 300 ? 60 : 300)}
            className="mrd-focus underline-offset-2 hover:underline"
            title="Switch between 1 min and 5 min"
          >
            Switch to {seconds === 300 ? '1 min' : '5 min'}
          </button>
        </div>
      </div>

      {rates.length === 0 ? (
        <EmptyState
          icon={<Gauge size={22} />}
          title="No commodities loaded"
          hint="Configure your webhook and fetch data to see live prices here."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rates.map((r) => {
            const up = (r.changePct ?? 0) >= 0;
            return (
              <li
                key={r.id}
                className="mrd-rise flex items-center justify-between rounded-lg border border-[var(--mrd-border)] bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide" style={{ background: 'var(--mrd-primary-soft)', color: 'var(--mrd-primary-strong)' }}>
                      {r.symbol}
                    </span>
                    <span className="truncate text-sm font-medium">{r.name}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--mrd-text-faint)]">per {r.unit}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatMoney(r.price, r.currency)}</p>
                  {r.changePct != null && (
                    <div className="mt-0.5 flex items-center justify-end gap-0.5 text-xs">
                      {up ? <TrendingUp size={12} style={{ color: 'var(--mrd-success)' }} /> : <TrendingDown size={12} style={{ color: 'var(--mrd-danger)' }} />}
                      <span style={{ color: up ? 'var(--mrd-success)' : 'var(--mrd-danger)' }}>
                        {up ? '+' : ''}{r.changePct.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {rates.length > 0 && (
        <p className="mt-3 text-[11px] text-[var(--mrd-text-faint)]">
          <Badge tone="neutral">{rates.length} commodities</Badge>
        </p>
      )}
    </SectionCard>
  );
}
