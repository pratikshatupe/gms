import React, {
  useState, useRef, useEffect, useCallback, useMemo,
} from 'react';
import {
  MessageCircle, X, Send, Minimize2, Bot, User, Loader2,
  ChevronDown, Plus, Trash2, Pencil, Search,
  PanelLeftOpen, PanelLeftClose, RotateCcw, Copy, CheckCheck,
  Clock, Sparkles, AlertTriangle,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   SYSTEM PROMPT
   ───────────────────────────────────────────────────────────── */
const CGMS_SYSTEM_PROMPT = `You are CorpGMS Assistant — a helpful, friendly support bot built into the Corporate Guest Management System (CorpGMS). You ONLY answer questions about CorpGMS and its features. If someone asks anything unrelated, politely say you can only help with CorpGMS topics.

Here is the complete knowledge base for CorpGMS:

## About CorpGMS
CorpGMS is a modern web platform for managing visitors, guests, and appointments across multiple office locations. It replaces paper registers with a secure, digital workspace covering the full visitor journey — from booking/walk-in → check-in → ID verification → room/service coordination → check-out.

## User Roles
- Super Admin: Global SaaS platform owner — manages all organizations, subscriptions, platform settings
- Director: Full control inside their organization — all offices, teams, reports
- Manager: Day-to-day operations — appointments, rooms, staff, visitor activity
- Service Staff: Pantry / Logistics / Facility tasks assigned to them
- Reception / Front Desk: Visitor entry — check-in, check-out, walk-in registration

## System Modules
1. Dashboard — Real-time view of live visitors, venue occupancy, service alerts, quick actions
2. Guest Log — Full visitor history with filters, search by name/phone/company/date, export to Excel/PDF
3. Walk-in Check-in — Fast registration form, ID verification, live photo capture, service requests, badge printing
4. Appointments — Pre-scheduled visits with host assignment, purpose tracking, document requirements, automatic reminders
5. Venues & Rooms — Board rooms, conference rooms — capacity tracking, booking status, live availability calendar
6. Team & Staff — Role-based user management, staff profiles, permission control by module, activate/deactivate accounts
7. Services & Facilities — Pantry, logistics, facility — status tracking: Pending → In Progress → Completed
8. Offices — Multi-office support, office-wise data separation, central director dashboard
9. Coupons — Super Admin can create/edit/delete discount coupons (percentage or flat), set usage limits, validity dates
10. Referrals — Generate referral links, track click counts, stages: Pending → Signed Up → Converted → Rewarded
11. Integrations — Connect external services via webhooks — Slack, MS Teams, Zapier, Custom API

## How to Add Appointments
1. Go to Appointments module from the sidebar
2. Click "New Appointment" button (top right)
3. Fill in: Guest name, contact, company, purpose of visit
4. Select Host (staff member who will receive the guest)
5. Choose Date & Time
6. Add document requirements if needed (ID, NDA, authorization letter)
7. Click Save — guest gets an automatic email/WhatsApp confirmation

## Visitor Flow Process
1. Registration — walk-in or pre-scheduled appointment
2. Check-in — reception confirms arrival, captures photo, issues badge
3. Verification — Emirates ID, passport, or driving licence
4. Entry & Stay Tracking — records entry time, live status tracking
5. Service Requests — logged and assigned to service staff
6. Check-out — visitor checked out, badge returned, visit closed

## Reports & Analytics
- Visitor reports: daily/weekly/monthly totals, walk-in vs pre-appointed, top hosts, no-shows
- Office-wise: visitor count per location, comparison, peak hours, busiest days
- Export: Excel (XLSX), CSV, PDF, print-ready layouts

## Security & Access Control
- Role-Based Access — each role sees only their permitted modules and screens
- Activity Tracking — all actions logged with user, date, time (complete audit trail via Audit Logs)
- Visitor Data Security — encrypted storage, HTTPS, access limited to authorized roles

Always respond in a friendly, concise way. Use bullet points for lists. If the user writes in Marathi or any other language, respond in that same language. Keep answers short unless detail is asked for.`;

/* ─────────────────────────────────────────────────────────────
   API CALL — calls our own backend (which holds the API key).
   Bug 5 fix: use VITE_API_URL or the dev-proxied "/api/v1" path
   so the chatbot works from any host (was hard-coded to
   http://localhost:5000 which broke when the frontend wasn't
   served on that machine, and also caused CORS preflight noise).
   ───────────────────────────────────────────────────────────── */
const CHATBOT_API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
  '/api/v1';

async function callClaudeAPI(messages) {
  let response;
  try {
    response = await fetch(`${CHATBOT_API_BASE}/chatbot/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: CGMS_SYSTEM_PROMPT,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
  } catch (networkErr) {
    console.error('[Chatbot] network error:', networkErr);
    throw new Error('Cannot reach backend at ' + CHATBOT_API_BASE + ' — is the API server running?');
  }

  /* Read as text first so we can show the body on a non-JSON failure. */
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch {
    console.error('[Chatbot] non-JSON response:', raw?.slice(0, 200));
    throw new Error('Server returned non-JSON response (status ' + response.status + ')');
  }

  if (!response.ok) {
    console.error('[Chatbot] API error:', response.status, data);
    throw new Error(data?.error?.message || `API error ${response.status}`);
  }

  if (data._fallback) {
    console.info('[Chatbot] received offline fallback response (no API key on server).');
  }

  return data.content?.[0]?.text || 'Sorry, I could not get a response. Please try again.';
}

/* ─────────────────────────────────────────────────────────────
   CONSTANTS & STORAGE
   ───────────────────────────────────────────────────────────── */
const SUGGESTIONS = [
  'What modules are available?',
  'How to add appointments?',
  'What are the user roles?',
  'How to do walk-in check-in?',
  'How to create coupons?',
  'How to export reports?',
];

const STORAGE_KEY  = 'cgms_chatbot_sessions_v2';
const MAX_SESSIONS = 50;

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveSessions(sessions) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS))); } catch {}
}

const GREETING_MSG = {
  id: 'greeting',
  role: 'assistant',
  content: 'Hello! 👋 I am the CorpGMS Assistant.\n\nFeel free to ask any questions about CorpGMS — modules, features, roles, or anything else!',
  ts: new Date().toISOString(),
};

function newSession(firstMsg = '') {
  return {
    id: `s_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    title: firstMsg ? firstMsg.slice(0, 40) + (firstMsg.length > 40 ? '…' : '') : 'New Chat',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [{ ...GREETING_MSG, ts: new Date().toISOString() }],
  };
}

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = new Date(iso);
  return d.toLocaleDateString([], { day:'2-digit', month:'short' });
}

/* ─────────────────────────────────────────────────────────────
   MESSAGE BUBBLE
   ───────────────────────────────────────────────────────────── */
function MessageBubble({ msg }) {
  const isBot = msg.role === 'assistant';
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(msg.content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple markdown renderer
  const renderContent = (text) =>
    text.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g).map((p, j) =>
        j % 2 === 1 ? <strong key={j}>{p}</strong> : p,
      );
      if (line.startsWith('- ') || line.startsWith('• '))
        return <li key={i} className="ml-4 list-disc">{parts.slice(1)}</li>;
      if (line.startsWith('## '))
        return <p key={i} className="font-bold text-[13px] mt-1">{line.slice(3)}</p>;
      if (line === '') return <div key={i} className="h-1" />;
      return <p key={i}>{parts}</p>;
    });

  return (
    <div className={`group flex gap-2.5 ${isBot ? 'items-start' : 'items-end flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center shadow-sm ${
        isBot ? 'bg-gradient-to-br from-[#6c5ce7] to-[#00cec9]' : 'bg-gradient-to-br from-sky-500 to-indigo-500'
      }`}>
        {isBot ? <Bot size={13} className="text-white" /> : <User size={12} className="text-white" />}
      </div>

      {/* Bubble */}
      <div className="relative max-w-[80%]">
        <div className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-[1.65] ${
          isBot
            ? 'bg-white text-slate-800 border border-slate-100 rounded-tl-sm shadow-sm'
            : 'bg-gradient-to-br from-sky-500 to-indigo-500 text-white rounded-br-sm shadow-sm'
        }`}>
          <div className="space-y-0.5">{renderContent(msg.content)}</div>
        </div>

        {/* Copy (bot only, on hover) */}
        {isBot && (
          <button
            onClick={copy}
            className="absolute -bottom-5 left-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-slate-400 hover:text-slate-600"
          >
            {copied ? <CheckCheck size={11} className="text-green-500" /> : <Copy size={11} />}
          </button>
        )}

        {msg.ts && (
          <p className={`text-[10px] mt-1 ${isBot ? 'text-slate-400' : 'text-right text-white/60'}`}>
            {new Date(msg.ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SIDEBAR ITEM
   ───────────────────────────────────────────────────────────── */
function SidebarItem({ session, active, onSelect, onDelete, onRename }) {
  const [renaming, setRenaming] = useState(false);
  const [val, setVal]           = useState(session.title);
  const ref                     = useRef(null);
  useEffect(() => { if (renaming) ref.current?.focus(); }, [renaming]);

  const commit = () => { if (val.trim()) onRename(session.id, val.trim()); setRenaming(false); };

  return (
    <div
      onClick={() => !renaming && onSelect(session.id)}
      className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all ${
        active
          ? 'bg-indigo-600/25 border border-indigo-500/30 text-white'
          : 'hover:bg-white/5 text-slate-400 hover:text-white border border-transparent'
      }`}
    >
      <MessageCircle size={12} className="flex-shrink-0 opacity-60" />
      <div className="flex-1 min-w-0">
        {renaming ? (
          <input
            ref={ref}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setRenaming(false); }}
            onBlur={commit}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-transparent border-b border-indigo-400 text-white text-[11px] outline-none"
          />
        ) : (
          <p className="text-[11px] font-medium truncate leading-tight">{session.title}</p>
        )}
        <p className="text-[9px] text-slate-600 mt-0.5 flex items-center gap-0.5">
          <Clock size={8} /> {timeAgo(session.updatedAt)}
        </p>
      </div>
      {!renaming && (
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setRenaming(true); setVal(session.title); }}
            className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-white transition-colors">
            <Pencil size={10} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
            className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN CHATBOT
   ───────────────────────────────────────────────────────────── */
export default function Chatboat() {
  const [open, setOpen]               = useState(false);
  const [minimized, setMinimized]     = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions]       = useState(() => loadSessions());
  const [activeId, setActiveId]       = useState(null);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [unread, setUnread]           = useState(0);
  const [search, setSearch]           = useState('');
  const [error, setError]             = useState(null);
  const [lastUserMsg, setLastUserMsg] = useState('');

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  /* Active session */
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) || null,
    [sessions, activeId],
  );

  /* Filtered sidebar list */
  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      s.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [sessions, search]);

  /* Persist */
  useEffect(() => { saveSessions(sessions); }, [sessions]);

  /* Auto-scroll */
  useEffect(() => {
    if (open && !minimized)
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, [activeSession?.messages?.length, open, minimized]);

  /* Focus input */
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 120);
      setUnread(0);
    }
  }, [open, minimized, activeId]);

  /* Ensure active session on open */
  useEffect(() => {
    if (!open) return;
    if (activeId && sessions.find((s) => s.id === activeId)) return;
    if (sessions.length > 0) { setActiveId(sessions[0].id); return; }
    const s = newSession();
    setSessions([s]);
    setActiveId(s.id);
  }, [open]); // eslint-disable-line

  /* Update a session */
  const updateSession = useCallback((id, fn) => {
    setSessions((prev) => prev.map((s) => s.id === id ? { ...fn(s), updatedAt: new Date().toISOString() } : s));
  }, []);

  /* New Chat */
  const handleNewChat = useCallback(() => {
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
    setInput('');
    setError(null);
  }, []);

  /* Delete */
  const handleDelete = useCallback((id) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeId === id) setActiveId(next[0]?.id || null);
      return next;
    });
  }, [activeId]);

  /* Rename */
  const handleRename = useCallback((id, title) => {
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title } : s));
  }, []);

  /* Send message */
  const sendMessage = useCallback(async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setError(null);
    setLastUserMsg(userText);

    /* Ensure active session */
    let sid = activeId;
    let currentMsgs = [];

    if (!sid || !sessions.find((s) => s.id === sid)) {
      const s = newSession(userText);
      setSessions((prev) => [s, ...prev]);
      setActiveId(s.id);
      sid = s.id;
      currentMsgs = [...s.messages];
    } else {
      currentMsgs = sessions.find((s) => s.id === sid)?.messages || [];
    }

    const userMsg = { id: `u_${Date.now()}`, role: 'user', content: userText, ts: new Date().toISOString() };
    const newMsgs = [...currentMsgs, userMsg];

    /* Update session with user msg + auto-rename if first user msg */
    setSessions((prev) => prev.map((s) => {
      if (s.id !== sid) return s;
      const firstUser = newMsgs.find((m) => m.role === 'user');
      const autoTitle = firstUser
        ? firstUser.content.slice(0, 42) + (firstUser.content.length > 42 ? '…' : '')
        : s.title;
      return { ...s, messages: newMsgs, title: autoTitle, updatedAt: new Date().toISOString() };
    }));

    setInput('');
    setLoading(true);

    /* Build API messages — skip the static greeting */
    const apiMsgs = newMsgs
      .filter((m) => m.id !== 'greeting')
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const reply = await callClaudeAPI(apiMsgs);
      const botMsg = { id: `b_${Date.now()}`, role: 'assistant', content: reply, ts: new Date().toISOString() };
      setSessions((prev) => prev.map((s) =>
        s.id === sid
          ? { ...s, messages: [...s.messages, botMsg], updatedAt: new Date().toISOString() }
          : s,
      ));
      if (!open || minimized) setUnread((n) => n + 1);
    } catch (err) {
      setError(err.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  }, [input, loading, activeId, sessions, open, minimized]);

  /* Retry */
  const handleRetry = useCallback(() => {
    setError(null);
    if (lastUserMsg) sendMessage(lastUserMsg);
  }, [lastUserMsg, sendMessage]);

  const messages = activeSession?.messages || [];

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Floating Button ── */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setMinimized(false); setUnread(0); }}
          className="fixed bottom-6 right-6 z-[200] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
          style={{ background:'linear-gradient(135deg,#6c5ce7,#00cec9)', boxShadow:'0 4px 24px rgba(108,92,231,0.5)' }}
        >
          <MessageCircle size={24} className="text-white" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}

      {/* ── Chat Window ── */}
      {open && (
        <div
          className={`fixed bottom-6 right-6 z-[200] flex rounded-2xl shadow-2xl overflow-hidden border border-slate-700/40 transition-all duration-300 ${minimized ? 'h-[52px]' : 'h-[580px]'}`}
          style={{
            width: minimized ? '260px' : sidebarOpen ? '680px' : '370px',
            background: '#0f0f1a',
            boxShadow: '0 20px 70px rgba(0,0,0,0.55)',
            transition: 'width 0.3s ease, height 0.3s ease',
          }}
        >
          {/* ══ SIDEBAR ══ */}
          {!minimized && sidebarOpen && (
            <div className="flex flex-col border-r border-slate-700/50 flex-shrink-0" style={{ width:210, background:'#09090f' }}>
              {/* Sidebar header */}
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
                      <Sparkles size={10} className="text-white" />
                    </div>
                    <span className="text-white text-[12px] font-bold tracking-tight">Chats</span>
                  </div>
                  <button onClick={handleNewChat}
                    className="p-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 hover:text-white transition-colors"
                    title="New Chat">
                    <Plus size={12} />
                  </button>
                </div>
                {/* Search */}
                <div className="relative">
                  <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search chats..."
                    className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[11px] text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500/40 transition-colors"
                  />
                </div>
              </div>

              {/* Session list */}
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                {filteredSessions.length === 0
                  ? <p className="text-center py-8 text-slate-600 text-[11px]">
                      {search ? 'No chats found' : 'No conversations yet'}
                    </p>
                  : filteredSessions.map((s) => (
                      <SidebarItem
                        key={s.id} session={s} active={s.id === activeId}
                        onSelect={setActiveId} onDelete={handleDelete} onRename={handleRename}
                      />
                    ))
                }
              </div>

              {/* New chat button */}
              <div className="px-2 py-2.5 border-t border-slate-800">
                <button onClick={handleNewChat}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 hover:text-white text-[11px] font-semibold transition-colors border border-indigo-500/20">
                  <Plus size={12} /> New Chat
                </button>
              </div>
            </div>
          )}

          {/* ══ MAIN CHAT ══ */}
          <div className="flex flex-col flex-1 min-w-0">

            {/* Header */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0 select-none cursor-pointer"
              style={{ background:'linear-gradient(90deg,#6c5ce7,#00cec9)' }}
              onClick={() => setMinimized((m) => !m)}
            >
              {!minimized && (
                <button
                  onClick={(e) => { e.stopPropagation(); setSidebarOpen((p) => !p); }}
                  className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                  title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                >
                  {sidebarOpen ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
                </button>
              )}
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[12px] font-bold leading-none truncate">
                  {activeSession?.title || 'CorpGMS Assistant'}
                </p>
                <p className="text-white/65 text-[10px] mt-0.5">
                  {loading ? '● typing…' : '● Online · CGMS Support'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); setMinimized((m) => !m); }}
                  className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors">
                  {minimized ? <ChevronDown size={14} /> : <Minimize2 size={13} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                  className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Messages */}
            {!minimized && (
              <>
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4" style={{ background:'#f8fafc' }}>

                  {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}

                  {/* Suggestions on fresh chat */}
                  {messages.length <= 1 && !loading && (
                    <div className="pt-1">
                      <p className="text-[10px] text-slate-400 text-center mb-2 font-semibold uppercase tracking-wider">
                        Suggested Questions
                      </p>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {SUGGESTIONS.map((s) => (
                          <button key={s} onClick={() => sendMessage(s)}
                            className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 transition-colors shadow-sm">
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Typing indicator */}
                  {loading && (
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6c5ce7] to-[#00cec9] flex items-center justify-center flex-shrink-0">
                        <Bot size={13} className="text-white" />
                      </div>
                      <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-3.5 py-3 shadow-sm flex items-center gap-1.5">
                        {[0,150,300].map((d) => (
                          <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay:`${d}ms` }} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error with retry */}
                  {error && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
                      <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                      <span className="text-red-700 text-[12px] flex-1 leading-snug">
                        {error.includes('403') || error.includes('401')
                          ? 'API key invalid or not configured.'
                          : 'Connection failed. Check your internet and try again.'}
                      </span>
                      <button onClick={handleRetry}
                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[11px] font-semibold transition-colors">
                        <RotateCcw size={10} /> Retry
                      </button>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="flex items-end gap-2 px-3 py-2.5 border-t border-slate-100" style={{ background:'#fff' }}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Ask a question…"
                    rows={1}
                    disabled={loading}
                    className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:opacity-50 transition-all"
                    style={{ maxHeight:80, overflowY:'auto' }}
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
                    }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 hover:scale-105 active:scale-95"
                    style={{ background:'linear-gradient(135deg,#6c5ce7,#00cec9)' }}
                  >
                    {loading
                      ? <Loader2 size={15} className="text-white animate-spin" />
                      : <Send size={14} className="text-white" />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}