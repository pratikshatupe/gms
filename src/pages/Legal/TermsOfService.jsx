import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, FileText, Users, CreditCard, Lock, AlertTriangle, Scale, Mail } from 'lucide-react';

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
      <div style={{ paddingLeft: 46, fontSize: 14, color: '#475569', lineHeight: 1.85 }}>{children}</div>
    </div>
  );
}

function SubSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: DARK }}>{title}</h3>
      <p style={{ margin: 0 }}>{children}</p>
    </div>
  );
}

export default function TermsOfService() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Terms of Service — CorpGMS';
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: `1px solid ${PBORDER}`, background: PBG, color: P, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
          >
            <ArrowLeft size={15} /> Back to Home
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg,${PL},${PD})`, padding: 'clamp(32px,5vw,64px) clamp(16px,5vw,52px)', textAlign: 'center', color: '#fff' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: '6px 16px', fontSize: 12, fontWeight: 700, marginBottom: 18, letterSpacing: '0.05em' }}>
            📄 LEGAL DOCUMENT
          </div>
          <h1 style={{ margin: '0 0 12px', fontFamily: 'Outfit,sans-serif', fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, letterSpacing: '-0.5px' }}>Terms of Service</h1>
          <p style={{ margin: 0, fontSize: 15, opacity: 0.85, lineHeight: 1.7 }}>
            Please read these terms carefully before using CorpGMS. By accessing our platform, you agree to be bound by these terms.
          </p>
          <p style={{ margin: '16px 0 0', fontSize: 12, opacity: 0.7 }}>Last Updated: April 2026 &nbsp;·&nbsp; Effective: April 1, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: 'clamp(32px,5vw,56px) clamp(16px,5vw,32px)' }}>

        {/* Intro */}
        <div style={{ background: '#fff', border: `1px solid ${PBORDER}`, borderRadius: 16, padding: 24, marginBottom: 36, fontSize: 14, color: '#475569', lineHeight: 1.8 }}>
          <strong style={{ color: DARK }}>Welcome to CorpGMS (GuestFlow)</strong>, a corporate guest management platform operated by <strong style={{ color: DARK }}>BIZZFLY Technologies Pvt. Ltd.</strong> ("Company", "we", "our", or "us"). These Terms of Service ("Terms") govern your access to and use of our website at <strong>guestm.netlify.app</strong> and all related services (collectively, the "Platform"). By accessing or using our Platform, you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.
        </div>

        <Section icon={FileText} title="1. Acceptance of Terms">
          <SubSection title="1.1 Agreement">
            By clicking "I agree," accessing, or using the CorpGMS Platform, you represent that you are authorised to enter into this agreement on behalf of your organisation ("Organisation" or "you"). If you do not agree to these Terms, do not access or use the Platform.
          </SubSection>
          <SubSection title="1.2 Eligibility">
            You must be at least 18 years old and legally authorised to enter into contracts. Use of the Platform is restricted to registered businesses and organisations. Individual consumer use is not supported.
          </SubSection>
          <SubSection title="1.3 Modifications">
            We reserve the right to modify these Terms at any time. We will provide at least 14 days' notice of material changes via email. Continued use of the Platform after the effective date constitutes acceptance of the revised Terms.
          </SubSection>
        </Section>

        <Section icon={Shield} title="2. Description of Service">
          <p>CorpGMS provides a cloud-based Software-as-a-Service (SaaS) platform for corporate visitor and guest management. Our services include:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8, lineHeight: 2 }}>
            <li><strong>Guest Log Management</strong> — Digital visitor registration, check-in/check-out tracking</li>
            <li><strong>Walk-In Check-In</strong> — Photo capture, ID verification, badge printing</li>
            <li><strong>Appointment Scheduling</strong> — Pre-scheduled visits with host notifications</li>
            <li><strong>Room & Venue Management</strong> — Booking, availability tracking, utilisation reports</li>
            <li><strong>Staff & Role Management</strong> — Role-based access control (RBAC)</li>
            <li><strong>Multi-Office Management</strong> — Centrally manage multiple locations</li>
            <li><strong>Notifications</strong> — Email and WhatsApp alerts for key events</li>
            <li><strong>Reports & Analytics</strong> — Visitor trends, export to Excel/PDF/CSV</li>
            <li><strong>Audit Logs</strong> — Full audit trail of all platform activity</li>
          </ul>
          <p style={{ marginTop: 12 }}>We reserve the right to add, modify, or remove features at any time with reasonable notice to existing subscribers.</p>
        </Section>

        <Section icon={Users} title="3. User Accounts & Organisation Access">
          <SubSection title="3.1 Organisation Onboarding">
            Access to CorpGMS is granted through a verified onboarding process. Organisations must submit a Request Organisation Access form, which is reviewed by our Super Admin team within 24 hours. Approval is at our sole discretion.
          </SubSection>
          <SubSection title="3.2 Account Responsibility">
            You are fully responsible for all activities that occur under your Organisation account. You must maintain the confidentiality of all login credentials and immediately notify us at support@corpgms.com of any suspected unauthorised access.
          </SubSection>
          <SubSection title="3.3 User Roles">
            The Platform supports multiple user roles including Super Admin, Director, Manager, Reception Staff, and Service Staff. Each role carries specific permissions. You are responsible for assigning appropriate roles and ensuring users adhere to these Terms.
          </SubSection>
          <SubSection title="3.4 Accurate Information">
            You agree to provide accurate, current, and complete information during registration and to keep such information updated. Providing false information may result in immediate account termination.
          </SubSection>
        </Section>

        <Section icon={AlertTriangle} title="4. Acceptable Use Policy">
          <p>You agree NOT to use the Platform to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8, lineHeight: 2 }}>
            <li>Violate any applicable law or regulation, including India's IT Act 2000</li>
            <li>Store, transmit, or process data without proper consent from visitors or employees</li>
            <li>Infringe upon intellectual property rights of CorpGMS or any third party</li>
            <li>Introduce malware, viruses, or any harmful code into the Platform</li>
            <li>Attempt to reverse-engineer, decompile, or extract source code</li>
            <li>Use automated bots or scrapers to access or harvest data</li>
            <li>Resell or sublicense access to the Platform without written consent</li>
            <li>Use the Platform for any purpose other than legitimate business guest management</li>
          </ul>
          <p style={{ marginTop: 12 }}>Violation of this policy may result in immediate account suspension without refund.</p>
        </Section>

        <Section icon={CreditCard} title="5. Payment & Subscription Terms">
          <SubSection title="5.1 Plans">
            CorpGMS offers multiple subscription tiers (Starter, Professional, Enterprise). Plan details, pricing, and feature limits are as described on our Pricing page and are subject to change with 30 days' notice.
          </SubSection>
          <SubSection title="5.2 Billing">
            Subscriptions are billed monthly or annually, in advance. Payments are processed via our authorised payment gateway. All prices are in INR (Indian Rupee) or USD as specified, exclusive of applicable taxes.
          </SubSection>
          <SubSection title="5.3 Taxes">
            You are responsible for all taxes, including GST, applicable to your subscription based on your jurisdiction. CorpGMS will collect GST as required under applicable Indian tax law.
          </SubSection>
          <SubSection title="5.4 Refund Policy">
            Subscription fees are non-refundable except as required by law or as expressly stated in your subscription agreement. We do not offer prorated refunds for unused periods.
          </SubSection>
          <SubSection title="5.5 Late Payment">
            Accounts with overdue payments may be suspended after a 7-day grace period. Data is retained for 30 days after suspension, after which it may be permanently deleted.
          </SubSection>
        </Section>

        <Section icon={Lock} title="6. Data Ownership & Security">
          <SubSection title="6.1 Your Data">
            You retain full ownership of all data you upload to or create within the Platform ("Organisation Data"). We do not claim any rights to your Organisation Data.
          </SubSection>
          <SubSection title="6.2 Our Licence to Your Data">
            You grant us a limited, non-exclusive licence to store, process, and transmit your Organisation Data solely to provide the Platform services to you, as detailed in our Privacy Policy.
          </SubSection>
          <SubSection title="6.3 Security Measures">
            We implement industry-standard security measures including HTTPS/TLS encryption, role-based access control, audit logging, and regular security assessments. However, no method of transmission or storage is 100% secure.
          </SubSection>
          <SubSection title="6.4 Data Export">
            You may export your Organisation Data at any time in supported formats (Excel, CSV, PDF). Upon account termination, we will provide a data export window of 30 days.
          </SubSection>
        </Section>

        <Section icon={AlertTriangle} title="7. Termination">
          <SubSection title="7.1 By You">
            You may terminate your account at any time by contacting support@corpgms.com. Termination takes effect at the end of the current billing cycle.
          </SubSection>
          <SubSection title="7.2 By Us">
            We may suspend or terminate your account immediately if you violate these Terms, fail to pay, or engage in fraudulent or illegal activity. We will provide notice where legally required and operationally feasible.
          </SubSection>
          <SubSection title="7.3 Effect of Termination">
            Upon termination, your access to the Platform will cease. We will retain your data for 30 days to allow for export, after which it will be permanently deleted unless retention is required by law.
          </SubSection>
        </Section>

        <Section icon={Scale} title="8. Limitation of Liability">
          <SubSection title="8.1 Disclaimer">
            THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING FITNESS FOR A PARTICULAR PURPOSE OR NON-INFRINGEMENT.
          </SubSection>
          <SubSection title="8.2 Liability Cap">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING UNDER THESE TERMS SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU IN THE 12 MONTHS PRECEDING THE CLAIM.
          </SubSection>
          <SubSection title="8.3 Exclusion">
            WE WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS OR DATA, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </SubSection>
        </Section>

        <Section icon={Scale} title="9. Governing Law">
          <p>These Terms shall be governed by and construed in accordance with the laws of <strong>India</strong>, including the <strong>Information Technology Act, 2000</strong> and its amendments, the <strong>Information Technology (Amendment) Act, 2008</strong>, and rules made thereunder.</p>
          <p style={{ marginTop: 12 }}>Any disputes arising under or relating to these Terms shall be subject to the exclusive jurisdiction of the courts in <strong>Mumbai, Maharashtra, India</strong>. Before initiating legal proceedings, both parties agree to attempt good-faith resolution through written notice and a 30-day negotiation period.</p>
        </Section>

        <Section icon={Mail} title="10. Contact Information">
          <p>For any questions about these Terms of Service, please contact us:</p>
          <div style={{ background: '#fff', border: `1px solid ${PBORDER}`, borderRadius: 12, padding: 20, marginTop: 12, display: 'grid', gap: 8 }}>
            <div><strong style={{ color: DARK }}>Company:</strong> BIZZFLY Technologies Pvt. Ltd.</div>
            <div><strong style={{ color: DARK }}>Platform:</strong> CorpGMS — Corporate Guest Management System</div>
            <div><strong style={{ color: DARK }}>Email:</strong> <a href="mailto:legal@corpgms.com" style={{ color: P }}>legal@corpgms.com</a></div>
            <div><strong style={{ color: DARK }}>Support:</strong> <a href="mailto:support@corpgms.com" style={{ color: P }}>support@corpgms.com</a></div>
            <div><strong style={{ color: DARK }}>Website:</strong> <a href="https://guestm.netlify.app" style={{ color: P }}>guestm.netlify.app</a></div>
          </div>
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
            Also see our <a href="/privacy" style={{ color: P, fontWeight: 700 }}>Privacy Policy</a>
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
