import React, { useEffect, useMemo, useState } from 'react';
import {
  MESSAGE_LOG_EVENT,
  clearMessageLog,
  readMessageLog,
} from '../utils/messaging';

const CHANNEL_META = {
  email: {
    label: 'Email ID',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
    icon:  '✉️',
  },
  whatsapp: {
    label: 'WhatsApp',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon:  '💬',
  },
};

const FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'email',    label: 'Email ID' },
  { id: 'whatsapp', label: 'WhatsApp' },
];

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function SentMessagesPanel() {
  const [messages, setMessages] = useState(readMessageLog);
  const [filter, setFilter] = useState('all');

  /* Same-tab updates come through the dispatched event; cross-tab updates
     come through the browser's native storage event. */
  useEffect(() => {
    const reload = () => setMessages(readMessageLog());
    window.addEventListener(MESSAGE_LOG_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(MESSAGE_LOG_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const counts = useMemo(() => ({
    all:      messages.length,
    email:    messages.filter((m) => m.channel === 'email').length,
    whatsapp: messages.filter((m) => m.channel === 'whatsapp').length,
  }), [messages]);

  const filtered = useMemo(
    () => (filter === 'all' ? messages : messages.filter((m) => m.channel === filter)),
    [messages, filter],
  );

  return (
    <section className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Sent Messages</h3>
          <p className="text-xs text-slate-500">
            Delivery log for the email / WhatsApp stubs — simulated until a backend is wired in.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {FILTERS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilter(opt.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  filter === opt.id ? 'bg-sky-500 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
                <span className="ml-1 opacity-70">{counts[opt.id]}</span>
              </button>
            ))}
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => { clearMessageLog(); setMessages([]); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Clear log
            </button>
          )}
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="flex min-h-[160px] flex-col items-center justify-center p-8 text-center">
          <div className="mb-3 text-4xl" aria-hidden="true">✉️</div>
          <h4 className="text-sm font-semibold text-slate-700">No messages yet</h4>
          <p className="mt-1 text-xs text-slate-400">
            {messages.length === 0
              ? 'Appointment confirmations, reminders, and check-in alerts will appear here.'
              : 'No messages match this filter.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((m) => {
            const meta = CHANNEL_META[m.channel] || CHANNEL_META.email;
            return (
              <li key={m.id} className="flex gap-3 p-4">
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${meta.badge}`}
                  aria-hidden="true"
                >
                  <span className="text-base">{meta.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                    <span className="truncate text-xs font-semibold text-slate-700">
                      to {m.to || '(unknown)'}
                    </span>
                    <span className="ml-auto text-[11px] text-slate-400">
                      {formatTime(m.sentAt || m.queuedAt)}
                    </span>
                  </div>
                  {m.subject && (
                    <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                      {m.subject}
                    </p>
                  )}
                  {m.message && (
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-slate-500">
                      {m.message}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
