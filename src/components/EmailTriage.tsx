import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CalendarClock,
  CheckCheck,
  Mail,
  MailOpen,
  X,
} from 'lucide-react';
import type { EmailCategory, EmailItem } from '../lib/types';
import { EMAIL_COLUMNS } from '../lib/types';
import { formatDate, formatRelative } from '../lib/format';
import { Badge, Button, EmptyState, SectionCard } from './ui';

// Email Triage Center: a three-column board populated from the n8n stream.
// Cards can be opened, marked read/unread, moved between categories, and
// snoozed for follow-up on a specific date. All mutations stay local.

const COLUMN_ACCENT: Record<EmailCategory, string> = {
  unread: 'var(--mrd-info)',
  need_attention: 'var(--mrd-accent)',
  need_followup: 'var(--mrd-primary)',
};

const CATEGORY_OPTIONS: { value: EmailCategory; label: string }[] = EMAIL_COLUMNS.map((c) => ({
  value: c.key,
  label: c.label,
}));

function EmailCard({
  email,
  onOpen,
  onToggleRead,
  onMove,
  onFollowUp,
}: {
  email: EmailItem;
  onOpen: (e: EmailItem) => void;
  onToggleRead: (id: string) => void;
  onMove: (id: string, cat: EmailCategory) => void;
  onFollowUp: (id: string, date: string | null) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [dateValue, setDateValue] = useState(email.followUpDate ?? '');

  const initials = email.sender
    .replace(/<[^>]+>/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?';

  return (
    <article
      className="mrd-card mrd-card-hover mrd-rise group relative p-3"
      style={{ borderLeft: `3px solid ${COLUMN_ACCENT[email.category]}` }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          style={{ background: 'var(--mrd-primary-soft)', color: 'var(--mrd-primary-strong)' }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`truncate text-sm ${email.read ? 'text-[var(--mrd-text-muted)]' : 'font-semibold text-[var(--mrd-text)]'}`}>
              {email.sender}
            </p>
            {!email.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--mrd-primary)' }} />}
          </div>
          <p className={`mt-0.5 truncate text-sm ${email.read ? 'text-[var(--mrd-text-muted)]' : 'text-[var(--mrd-text)]'}`}>
            {email.subject}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-[var(--mrd-text-faint)]">{email.snippet}</p>

          <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--mrd-text-faint)]">
            <span>{formatRelative(email.receivedAt)}</span>
            {email.followUpDate && (
              <Badge tone="info">
                <CalendarClock size={11} /> {formatDate(email.followUpDate)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-1">
        <Button variant="subtle" size="sm" onClick={() => onOpen(email)}>
          <MailOpen size={12} /> Open
        </Button>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMenuOpen((v) => !v)}
            title="Move / actions"
          >
            <ArrowLeftRight size={12} /> Move
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[var(--mrd-border)] bg-white p-1 shadow-lg">
                {CATEGORY_OPTIONS.filter((o) => o.value !== email.category).map((o) => (
                  <button
                    key={o.value}
                    onClick={() => {
                      onMove(email.id, o.value);
                      setMenuOpen(false);
                    }}
                    className="mrd-focus flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[#f4f5f8]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: COLUMN_ACCENT[o.value] }} />
                    Move to {o.label}
                  </button>
                ))}
                <div className="my-1 h-px bg-[var(--mrd-border)]" />
                <button
                  onClick={() => {
                    onToggleRead(email.id);
                    setMenuOpen(false);
                  }}
                  className="mrd-focus flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[#f4f5f8]"
                >
                  <CheckCheck size={12} /> {email.read ? 'Mark as unread' : 'Mark as read'}
                </button>
                <button
                  onClick={() => {
                    setShowDate((v) => !v);
                    setMenuOpen(false);
                  }}
                  className="mrd-focus flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[#f4f5f8]"
                >
                  <CalendarClock size={12} /> {email.followUpDate ? 'Edit follow-up date' : 'Mark for follow-up'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showDate && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--mrd-border)] bg-[var(--mrd-surface-2)] p-2">
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="mrd-focus flex-1 rounded border border-[var(--mrd-border-strong)] bg-white px-2 py-1 text-xs"
          />
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              onFollowUp(email.id, dateValue || null);
              setShowDate(false);
            }}
          >
            Save
          </Button>
          {email.followUpDate && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onFollowUp(email.id, null);
                setDateValue('');
                setShowDate(false);
              }}
            >
              Clear
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setShowDate(false)}>
            <X size={12} />
          </Button>
        </div>
      )}
    </article>
  );
}

function EmailModal({ email, onClose }: { email: EmailItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,28,44,0.45)' }}>
      <div className="mrd-card mrd-rise w-full max-w-2xl p-5" style={{ boxShadow: 'var(--mrd-shadow-lg)' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">{email.subject}</h3>
            <p className="mt-1 text-sm text-[var(--mrd-text-muted)]">
              From <span className="font-medium text-[var(--mrd-text)]">{email.sender}</span> · {formatRelative(email.receivedAt)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
        <div className="mt-4 max-h-[55vh] overflow-auto rounded-lg border border-[var(--mrd-border)] bg-[var(--mrd-surface-2)] p-4 text-sm leading-relaxed text-[var(--mrd-text)] mrd-scroll">
          {email.body ?? email.snippet ?? '(No body provided by n8n.)'}
        </div>
        {email.followUpDate && (
          <p className="mt-3 text-xs text-[var(--mrd-text-muted)]">
            Follow-up scheduled for {formatDate(email.followUpDate)}.
          </p>
        )}
      </div>
    </div>
  );
}

export function EmailTriage({
  emails,
  onToggleRead,
  onMove,
  onFollowUp,
}: {
  emails: EmailItem[];
  onToggleRead: (id: string) => void;
  onMove: (id: string, cat: EmailCategory) => void;
  onFollowUp: (id: string, date: string | null) => void;
}) {
  const [active, setActive] = useState<EmailItem | null>(null);

  const grouped = useMemo(() => {
    const map: Record<EmailCategory, EmailItem[]> = { unread: [], need_attention: [], need_followup: [] };
    for (const e of emails) map[e.category]?.push(e);
    // Unread first, then newest.
    for (const k of Object.keys(map) as EmailCategory[]) {
      map[k].sort((a, b) => Number(a.read) - Number(b.read) || b.receivedAt.localeCompare(a.receivedAt));
    }
    return map;
  }, [emails]);

  return (
    <SectionCard
      title="Email Triage Center"
      subtitle="Cards arrive from n8n into the right column by category. Move, read, or snooze them."
      icon={<Mail size={18} />}
      actions={<Badge tone="neutral">{emails.length} total</Badge>}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {EMAIL_COLUMNS.map((col) => (
          <div
            key={col.key}
            className="flex flex-col rounded-xl border border-[var(--mrd-border)] bg-[var(--mrd-surface-2)]"
            style={{ borderTop: `3px solid ${COLUMN_ACCENT[col.key]}` }}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold">{col.label}</p>
                <p className="text-[10px] text-[var(--mrd-text-faint)]">{col.hint}</p>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
                style={{ background: `${COLUMN_ACCENT[col.key]}1a`, color: COLUMN_ACCENT[col.key] }}
              >
                {grouped[col.key].length}
              </span>
            </div>
            <div className="mrd-scroll flex max-h-[28rem] flex-col gap-2 overflow-y-auto px-2 pb-3">
              {grouped[col.key].length === 0 ? (
                <EmptyState
                  icon={<Mail size={22} />}
                  title="No emails here"
                  hint="New emails from n8n will land in this column."
                />
              ) : (
                grouped[col.key].map((e) => (
                  <EmailCard
                    key={e.id}
                    email={e}
                    onOpen={setActive}
                    onToggleRead={onToggleRead}
                    onMove={onMove}
                    onFollowUp={onFollowUp}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {active && <EmailModal email={active} onClose={() => setActive(null)} />}
    </SectionCard>
  );
}
