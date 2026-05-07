import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { API } from '../../api';

const SYSTEM_PROMPT = `You are CorpGMS Assistant, the official AI helper for the Corporate Guest Management System (CorpGMS).

You know everything about this platform. Here is complete knowledge about the system:

## WHAT IS CORPGMS?
CorpGMS is a modern multi-tenant SaaS platform that helps organizations manage visitors, guests, and appointments across multiple office locations. It replaces paper registers with a digital, secure, role-based workspace.

## USER ROLES (5 roles):
- **Super Admin**: SaaS platform owner. Manages all organizations, subscription plans, coupon codes, and global settings.
- **Director**: Full access inside their organization. Views all offices, manages teams, approves configurations, sees all reports.
- **Manager**: Day-to-day operations. Handles appointments, manages rooms, assigns staff, reviews visitor activity.
- **Service Staff**: Limited access. Handles pantry, logistics, AV, parking service requests assigned to them.
- **Reception / Front Desk**: Handles visitor check-in/check-out, ID verification, walk-in registrations.

## 8 MAIN MODULES:
1. **Dashboard**: Live stats — total visitors, currently inside, upcoming visits, walk-ins. Active visitor list, room occupancy, service alerts.
2. **Guest Log**: Complete visitor history. Filters by type (walk-in/pre-appointed), office, status. Export to Excel/CSV/PDF.
3. **Walk-in Check-in**: Quick registration — name, phone, company, purpose, ID verification (Emirates ID / passport / driving license), live photo, service requests, badge printing.
4. **Appointments**: Pre-scheduled visits — date/time/duration, host assignment, document requirements (ID copy, NDA, authorization letter), confirmation tracking, automatic reminders.
5. **Venues & Rooms**: Board rooms, conference rooms, cabins — capacity, live availability, booking status (Available/Occupied/Reserved/Under Maintenance), room utilization reports.
6. **Team & Staff**: Manage internal users, roles, permissions, profiles, office assignments.
7. **Services & Facilities**: Pantry (tea, coffee, snacks), logistics (parking, driver), AV setup, facility requests — assign to staff, track status (Pending/In Progress/Completed).
8. **Offices**: Multi-location support (Dubai, Abu Dhabi, Sharjah, etc.). Data separated per office, central dashboard for directors.

## VISITOR FLOW:
Registration → Check-in → ID Verification → Stay Tracking → Service Requests → Check-out

## NOTIFICATIONS:
- Email: appointment confirmations, check-in alerts, service updates
- WhatsApp: reminders, arrival messages, check-out confirmations
- In-app: real-time notification bell

## REPORTS & ANALYTICS:
- Visitor reports (daily/weekly/monthly), office comparison, peak hours analysis
- Duration tracking, service response time, no-show reports
- Room utilization
- Export: Excel, CSV, PDF

## SUBSCRIPTION PLANS:
- **Starter**: Free — up to 50 visitors/month, 1 office, basic check-in, email notifications
- **Professional**: ₹2,999/month — unlimited visitors, 5 locations, WhatsApp, analytics, room booking, custom badges
- **Enterprise**: Custom pricing — unlimited everything, dedicated support, SSO/SAML, custom integrations

## COUPON CODES:
Super Admins can create discount coupon codes. Users can apply these during subscription checkout to get percentage or flat discounts.

## REFERRAL SYSTEM:
Every user gets a unique referral code. When someone signs up using your referral code AND completes their first subscription payment, you earn a reward credit (₹500 default or percentage-based).

## SECURITY:
- Role-based access control — each role sees only their permitted modules
- Activity audit log — all actions recorded with user, date, time
- HTTPS encrypted, ID documents stored securely
- Document verification: Emirates ID, passport, driving license

## MULTI-OFFICE:
Organizations can add unlimited offices. Each office has its own reception, rooms, visitor data. Directors see all offices from one central dashboard.

## TECHNICAL:
- Backend: Node.js, Express, MongoDB
- Frontend: React with Tailwind CSS
- Auth: JWT access + refresh tokens
- Real-time notifications
- Mobile responsive

Answer questions clearly and helpfully. If asked something outside this system, politely redirect to CorpGMS topics. Be friendly, concise, and professional. Always refer to the product as "CorpGMS" or "Corporate Guest Management System".`;

// Bug #1 fix: never call Anthropic directly from the browser — that triggers CORS.
// Route through the backend proxy at POST /api/v1/chatbot/message which holds the API key.
const API_URL = `${API}/chatbot/message`;

export default function ChatbotWidget({ variant = 'floating' }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "👋 Hi! I'm the CorpGMS Assistant. I know everything about this platform — visitor management, roles, modules, subscriptions, and more. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });

      const data = await res.json();
      const reply = data?.content?.[0]?.text || "I'm sorry, I couldn't get a response. Please try again.";
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I'm having trouble connecting. Please try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (variant === 'inline') {
    return (
      <div style={styles.inlineContainer}>
        <ChatWindow
          messages={messages}
          input={input}
          loading={loading}
          bottomRef={bottomRef}
          inputRef={inputRef}
          onInput={setInput}
          onSend={sendMessage}
          onKey={handleKey}
          inline
        />
      </div>
    );
  }

  return (
    <div style={styles.fabWrap}>
      {open && (
        <div style={styles.floatWindow}>
          <div style={styles.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={styles.avatar}><Bot size={18} color="#fff" /></div>
              <div>
                <div style={styles.headerTitle}>CorpGMS Assistant</div>
                <div style={styles.headerSub}>Always here to help</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={styles.closeBtn}>
              <X size={18} />
            </button>
          </div>
          <ChatWindow
            messages={messages}
            input={input}
            loading={loading}
            bottomRef={bottomRef}
            inputRef={inputRef}
            onInput={setInput}
            onSend={sendMessage}
            onKey={handleKey}
          />
        </div>
      )}
      <button onClick={() => setOpen((p) => !p)} style={styles.fab} title="Ask CorpGMS Assistant">
        {open ? <X size={24} color="#fff" /> : <MessageCircle size={24} color="#fff" />}
      </button>
    </div>
  );
}

function ChatWindow({ messages, input, loading, bottomRef, inputRef, onInput, onSend, onKey, inline }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ ...styles.msgArea, ...(inline ? { height: 320 } : {}) }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            {m.role === 'assistant' && (
              <div style={styles.botAvatarSmall}><Bot size={13} color="#fff" /></div>
            )}
            <div style={m.role === 'user' ? styles.userBubble : styles.botBubble}>
              {m.content}
            </div>
            {m.role === 'user' && (
              <div style={styles.userAvatarSmall}><User size={13} color="#fff" /></div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontSize: 13 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={styles.inputRow}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask anything about CorpGMS..."
          rows={1}
          style={styles.textarea}
        />
        <button onClick={onSend} disabled={!input.trim() || loading} style={styles.sendBtn}>
          <Send size={16} color="#fff" />
        </button>
      </div>
    </div>
  );
}

const styles = {
  fabWrap: {
    position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12,
  },
  fab: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'linear-gradient(135deg, #0284C7, #5a4bd1)',
    border: 'none', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(2,132,199,0.4)',
    transition: 'transform .2s',
  },
  floatWindow: {
    width: 380, height: 520, borderRadius: 16, overflow: 'hidden',
    background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
    display: 'flex', flexDirection: 'column',
    border: '1px solid #E2E8F0',
  },
  header: {
    padding: '14px 16px',
    background: 'linear-gradient(135deg, #0284C7, #5a4bd1)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  avatar: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontWeight: 700, fontSize: 14 },
  headerSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#fff', padding: 4, borderRadius: 6,
  },
  msgArea: {
    flex: 1, overflowY: 'auto', padding: '16px 14px',
    display: 'flex', flexDirection: 'column', gap: 2,
    background: '#F8FAFC',
  },
  botBubble: {
    background: '#fff', border: '1px solid #E2E8F0', borderRadius: '0 12px 12px 12px',
    padding: '10px 13px', fontSize: 13, color: '#1E293B', maxWidth: '78%',
    lineHeight: 1.55, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    whiteSpace: 'pre-wrap',
  },
  userBubble: {
    background: 'linear-gradient(135deg, #0284C7, #5a4bd1)',
    borderRadius: '12px 0 12px 12px',
    padding: '10px 13px', fontSize: 13, color: '#fff', maxWidth: '78%',
    lineHeight: 1.55, whiteSpace: 'pre-wrap',
  },
  botAvatarSmall: {
    width: 24, height: 24, borderRadius: '50%',
    background: 'linear-gradient(135deg, #0284C7, #5a4bd1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginRight: 8, flexShrink: 0, marginTop: 2,
  },
  userAvatarSmall: {
    width: 24, height: 24, borderRadius: '50%',
    background: '#64748B',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginLeft: 8, flexShrink: 0, marginTop: 2,
  },
  inputRow: {
    display: 'flex', alignItems: 'flex-end', gap: 8,
    padding: '12px 14px', borderTop: '1px solid #E2E8F0',
    background: '#fff',
  },
  textarea: {
    flex: 1, resize: 'none', border: '1.5px solid #E2E8F0',
    borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none',
    fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#1E293B',
    background: '#F8FAFC', lineHeight: 1.5, maxHeight: 100,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
    background: 'linear-gradient(135deg, #0284C7, #5a4bd1)',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  inlineContainer: {
    background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0',
    overflow: 'hidden', height: 460,
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  },
};
