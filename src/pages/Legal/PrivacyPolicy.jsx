import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, Database, Shield, Cookie, Globe, Clock, UserCheck, Mail } from 'lucide-react';

const P  = '#0284C7';
const PL = '#0EA5E9';
const PD = '#0D9488';
const DARK = '#0C2340';
const MUTED = '#64748B';
const PBORDER = '#BAE6FD';
const PBG = '#E0F2FE';

function Section({ icon: Icon, title, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${PL},${PD})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} color="#fff" />
        </div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: DARK, fontFamily: 'Outfit,sans-serif' }}>{title}</h2>
      </div>
      <div style={{ paddingLeft: 'clamp(8px,4vw,46px)', fontSize: 14, color: '#475569', lineHeight: 1.85 }}>{children}</div>
    </div>
  );
}

function SubSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: DARK }}>{title}</h3>
      <div style={{ margin: 0 }}>{children}</div>
    </div>
  );
}

function DataTable({ rows }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 8, WebkitOverflowScrolling: 'touch' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 360 }}>
        <thead>
          <tr style={{ background: PBG }}>
            {['Data Category', 'Examples', 'Purpose'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: P, borderBottom: `2px solid ${PBORDER}`, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([cat, ex, pur], i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : PBG }}>
              <td style={{ padding: '10px 14px', fontWeight: 600, color: DARK, borderBottom: `1px solid ${PBORDER}`, whiteSpace: 'nowrap' }}>{cat}</td>
              <td style={{ padding: '10px 14px', color: '#475569', borderBottom: `1px solid ${PBORDER}`, wordBreak: 'break-word' }}>{ex}</td>
              <td style={{ padding: '10px 14px', color: '#475569', borderBottom: `1px solid ${PBORDER}`, wordBreak: 'break-word' }}>{pur}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Privacy Policy — CorpGMS';
    return () => { document.title = 'GuestFlow — Guest Management'; };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#FAFBFF', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      {/* Navbar */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${PBORDER}`, padding: '14px clamp(16px,5vw,52px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg,${PL},${PD})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: 'white', fontFamily: 'Outfit,sans-serif' }}>G</div>
            <div>
              <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 15, color: DARK }}>CorpGMS</div>
              <div style={{ fontSize: 10, color: MUTED }}>Corporate Guest Management System</div>
            </div>
          </a>
          <button
            onClick={() => navigate('/')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: `1px solid ${PBORDER}`, background: PBG, color: P, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <ArrowLeft size={15} /> Back to Home
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg,${PL},${PD})`, padding: 'clamp(32px,5vw,64px) clamp(16px,5vw,52px)', textAlign: 'center', color: '#fff' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: '6px 16px', fontSize: 12, fontWeight: 700, marginBottom: 18, letterSpacing: '0.05em' }}>
            🔒 LEGAL DOCUMENT
          </div>
          <h1 style={{ margin: '0 0 12px', fontFamily: 'Outfit,sans-serif', fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, letterSpacing: '-0.5px' }}>Privacy Policy</h1>
          <p style={{ margin: 0, fontSize: 15, opacity: 0.85, lineHeight: 1.7 }}>
            We are committed to protecting your privacy. This policy explains how we collect, use, store, and share your information when you use CorpGMS.
          </p>
          <p style={{ margin: '16px 0 0', fontSize: 12, opacity: 0.7 }}>Last Updated: April 2026 &nbsp;·&nbsp; Effective: April 1, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: 'clamp(32px,5vw,56px) clamp(16px,5vw,32px)' }}>

        {/* Intro */}
        <div style={{ background: '#fff', border: `1px solid ${PBORDER}`, borderRadius: 16, padding: 24, marginBottom: 36, fontSize: 14, color: '#475569', lineHeight: 1.8 }}>
          <strong style={{ color: DARK }}>BIZZFLY Technologies Pvt. Ltd.</strong> ("we", "our", or "us") operates the CorpGMS platform. This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you use our Platform. This policy is compliant with India's <strong style={{ color: DARK }}>Information Technology Act, 2000</strong>, the <strong style={{ color: DARK }}>IT (Amendment) Act, 2008</strong>, the <strong style={{ color: DARK }}>Personal Data Protection Bill</strong> framework, and <strong style={{ color: DARK }}>GDPR principles</strong> for international users.
        </div>

        <Section icon={Eye} title="1. What Data We Collect">
          <p>We collect the following categories of data:</p>

          <SubSection title="1.1 Organisation & Account Data">
            <DataTable rows={[
              ['Organisation Info', 'Company name, GST number, industry, size', 'Account setup & verification'],
              ['Contact Person', 'Full name, designation, email, phone', 'Communication & support'],
              ['Location Data', 'Country, city, office addresses', 'Multi-office management'],
              ['Billing Info', 'Subscription plan, payment history (no card data stored)', 'Billing & invoicing'],
            ]} />
          </SubSection>

          <SubSection title="1.2 Visitor & Guest Data">
            <DataTable rows={[
              ['Identity', 'Full name, ID type & number, photo', 'Check-in & security compliance'],
              ['Visit Details', 'Check-in/out times, host, purpose', 'Guest log & reporting'],
              ['Contact', 'Phone number, email (optional)', 'Host notifications'],
              ['Documents', 'ID proof images (encrypted)', 'Verification & compliance'],
            ]} />
          </SubSection>

          <SubSection title="1.3 Usage & Technical Data">
            <DataTable rows={[
              ['Log Data', 'IP address, browser type, pages visited', 'Security & platform improvement'],
              ['Device Data', 'Device type, OS, screen resolution', 'Responsive optimisation'],
              ['Audit Logs', 'User actions, timestamps, module accessed', 'Security & compliance'],
              ['Performance', 'Load times, errors, feature usage', 'Platform stability'],
            ]} />
          </SubSection>
        </Section>

        <Section icon={Database} title="2. How We Use Your Data">
          <p>We use the collected data for the following purposes:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8, lineHeight: 2.2 }}>
            <li><strong>Service Delivery</strong> — To operate, maintain, and improve the CorpGMS Platform</li>
            <li><strong>Visitor Management</strong> — To enable guest check-in, badge printing, and host notifications</li>
            <li><strong>Account Management</strong> — To manage user accounts, roles, and permissions</li>
            <li><strong>Communications</strong> — To send service updates, security alerts, and support responses</li>
            <li><strong>Billing</strong> — To process subscription payments and generate invoices</li>
            <li><strong>Analytics</strong> — To provide visitor reports and insights to your organisation</li>
            <li><strong>Compliance</strong> — To maintain audit logs and comply with legal obligations</li>
            <li><strong>Security</strong> — To detect fraud, abuse, and security incidents</li>
            <li><strong>Product Improvement</strong> — To understand usage patterns and enhance features</li>
          </ul>
          <p style={{ marginTop: 12 }}>We do <strong>not</strong> sell, rent, or trade your personal data to third parties for marketing purposes.</p>
        </Section>

        <Section icon={Shield} title="3. Data Storage & Security">
          <SubSection title="3.1 Storage Location">
            Your data is stored on secure cloud infrastructure. Organisation data is logically isolated per tenant — your data is never accessible to other organisations on the Platform.
          </SubSection>
          <SubSection title="3.2 Security Measures">
            <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
              <li>HTTPS/TLS 1.3 encryption for all data in transit</li>
              <li>AES-256 encryption for sensitive data at rest (visitor IDs, photos)</li>
              <li>Role-Based Access Control (RBAC) — users only see data relevant to their role</li>
              <li>Full audit logging of all data access and modifications</li>
              <li>Regular security assessments and vulnerability testing</li>
              <li>Two-factor authentication (2FA) available for admin accounts</li>
            </ul>
          </SubSection>
          <SubSection title="3.3 Breach Notification">
            In the event of a data breach affecting your Organisation's data, we will notify you within 72 hours of discovery as required by applicable law.
          </SubSection>
        </Section>

        <Section icon={Cookie} title="4. Cookies & Tracking">
          <SubSection title="4.1 Essential Cookies">
            We use strictly necessary cookies to maintain your authenticated session and ensure the Platform functions correctly. These cannot be disabled without breaking core functionality.
          </SubSection>
          <SubSection title="4.2 Preference Cookies">
            We store your theme preference (light/dark mode) and sidebar state locally in your browser using localStorage. This data never leaves your device.
          </SubSection>
          <SubSection title="4.3 Analytics">
            We may use privacy-respecting analytics tools (without personal identifiers) to understand aggregate Platform usage. No third-party advertising trackers are used on the Platform.
          </SubSection>
          <SubSection title="4.4 Managing Cookies">
            You can manage cookies through your browser settings. Note that disabling essential cookies will prevent you from logging in to the Platform.
          </SubSection>
        </Section>

        <Section icon={Globe} title="5. Third-Party Services">
          <p>We use the following trusted third-party services to deliver the Platform. Each has been evaluated for privacy compliance:</p>
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: PBG }}>
                  {['Service', 'Provider', 'Purpose', 'Data Shared'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: P, borderBottom: `2px solid ${PBORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Cloud Hosting', 'Netlify / AWS', 'Platform infrastructure', 'Encrypted application data'],
                  ['Email Notifications', 'SMTP Provider', 'Guest & appointment alerts', 'Name, email, visit details'],
                  ['WhatsApp Alerts', 'WhatsApp Business API', 'Check-in notifications', 'Name, phone, visit time'],
                  ['Payment Processing', 'Razorpay / Stripe', 'Subscription billing', 'Billing contact info only'],
                ].map(([s, p, pu, d], i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : PBG }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: DARK, borderBottom: `1px solid ${PBORDER}` }}>{s}</td>
                    <td style={{ padding: '10px 14px', color: '#475569', borderBottom: `1px solid ${PBORDER}` }}>{p}</td>
                    <td style={{ padding: '10px 14px', color: '#475569', borderBottom: `1px solid ${PBORDER}` }}>{pu}</td>
                    <td style={{ padding: '10px 14px', color: '#475569', borderBottom: `1px solid ${PBORDER}` }}>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 12 }}>We do not share visitor data with any third party except as necessary to deliver the services described above or as required by law.</p>
        </Section>

        <Section icon={Clock} title="6. Data Retention Policy">
          <SubSection title="6.1 Active Accounts">
            We retain your Organisation data for as long as your subscription is active. Visitor logs and guest records are retained for a minimum of 2 years for compliance purposes, or longer if required by applicable law.
          </SubSection>
          <SubSection title="6.2 Account Termination">
            Upon account termination, we provide a 30-day window for you to export your data. After this period, all Organisation data is permanently and irreversibly deleted from our systems within 60 days.
          </SubSection>
          <SubSection title="6.3 Audit Logs">
            System audit logs may be retained for up to 7 years for legal and compliance purposes, in anonymised or pseudonymised form where possible.
          </SubSection>
          <SubSection title="6.4 Visitor Data">
            Individual visitor records (photos, ID scans) are subject to your Organisation's configured retention period (minimum 90 days, configurable up to 5 years). You are responsible for configuring retention in compliance with your local regulations.
          </SubSection>
        </Section>

        <Section icon={UserCheck} title="7. Your Rights">
          <p>Under applicable privacy laws (GDPR, India IT Act, PDPB framework), you have the following rights:</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,260px),1fr))', gap: 12, marginTop: 12 }}>
            {[
              { icon: '👁️', title: 'Right to Access', desc: 'Request a copy of all personal data we hold about you or your organisation.' },
              { icon: '✏️', title: 'Right to Rectification', desc: 'Correct inaccurate or incomplete data in your account at any time.' },
              { icon: '🗑️', title: 'Right to Erasure', desc: 'Request deletion of your data, subject to legal retention requirements.' },
              { icon: '📦', title: 'Right to Portability', desc: 'Export your Organisation data in Excel, CSV, or PDF format.' },
              { icon: '🚫', title: 'Right to Object', desc: 'Object to processing of your data for certain purposes.' },
              { icon: '⏸️', title: 'Right to Restriction', desc: 'Request restriction of processing in certain circumstances.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ background: '#fff', border: `1px solid ${PBORDER}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontWeight: 700, color: DARK, fontSize: 13, marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16 }}>To exercise any of these rights, contact us at <a href="mailto:privacy@corpgms.com" style={{ color: P, fontWeight: 700 }}>privacy@corpgms.com</a>. We will respond within 30 days.</p>
        </Section>

        <Section icon={Mail} title="8. Contact for Data Requests">
          <p>For privacy-related inquiries, data subject requests, or to report a concern:</p>
          <div style={{ background: '#fff', border: `1px solid ${PBORDER}`, borderRadius: 12, padding: 20, marginTop: 12, display: 'grid', gap: 8 }}>
            <div><strong style={{ color: DARK }}>Data Controller:</strong> BIZZFLY Technologies Pvt. Ltd.</div>
            <div><strong style={{ color: DARK }}>Privacy Email:</strong> <a href="mailto:privacy@corpgms.com" style={{ color: P }}>privacy@corpgms.com</a></div>
            <div><strong style={{ color: DARK }}>Legal Email:</strong> <a href="mailto:legal@corpgms.com" style={{ color: P }}>legal@corpgms.com</a></div>
            <div><strong style={{ color: DARK }}>Support:</strong> <a href="mailto:support@corpgms.com" style={{ color: P }}>support@corpgms.com</a></div>
            <div><strong style={{ color: DARK }}>Response Time:</strong> Within 30 days of request receipt</div>
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: MUTED }}>
            If you are in the EU/EEA and believe we have not adequately addressed your privacy concerns, you have the right to lodge a complaint with your local Data Protection Authority.
          </p>
        </Section>

        {/* Back button */}
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <button
            onClick={() => navigate('/')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${PL},${PD})`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif', boxShadow: '0 5px 18px rgba(14,165,233,0.32)' }}
          >
            <ArrowLeft size={16} /> Back to Home
          </button>
          <p style={{ marginTop: 16, fontSize: 12, color: '#94A3B8' }}>
            Also see our <a href="/terms" style={{ color: P, fontWeight: 700 }}>Terms of Service</a>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ padding: '24px clamp(16px,5vw,52px)', borderTop: `1px solid ${PBORDER}`, background: '#fff', textAlign: 'center' }}>
        <span style={{ fontSize: 12, color: '#C4C2DE' }}>© 2026 <strong style={{ color: MUTED }}>CorpGMS by BIZZFLY</strong> · All rights reserved.</span>
      </footer>
    </div>
  );
}
