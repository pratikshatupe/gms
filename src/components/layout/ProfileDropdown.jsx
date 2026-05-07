import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import ProfileModal from './ProfileModal';
import {
  profilePermissions,
  roleColor,
  roleLabel,
} from './profileRoles';

/**
 * ProfileDropdown — avatar trigger + dropdown menu in the Topbar.
 *
 * Visibility: every authenticated role sees the trigger. Menu items are
 * filtered by `profilePermissions(user.role)`:
 *   - SuperAdmin / Admin   → View Profile, Change Password, Log Out
 *   - Manager / Staff      → View Profile, Log Out
 *   - Viewer               → View Profile (read-only), Log Out
 *
 * Profile editing inside the modal is gated by `canEditProfile`.
 *
 * Props:
 *   user       — current user object from AuthContext
 *   onLogout   — () => void  (parent already clears auth + navigates to "/")
 *   isMobile   — collapses the name label on narrow screens
 */
export default function ProfileDropdown({ user, onLogout, isMobile = false }) {
  const { logout, updateUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('view');
  const [focusedIdx, setFocusedIdx] = useState(-1);

  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const perms = profilePermissions(user?.role);

  /* Build menu items dynamically so the indices line up with the rendered list. */
  const items = [
    perms.canViewProfile && {
      key: 'view',
      label: perms.isReadOnly ? 'View Profile (Read-only)' : 'View Profile',
      icon: ProfileIcon,
      onSelect: () => { setModalMode('view'); setModalOpen(true); setOpen(false); },
    },
    perms.canChangePassword && {
      key: 'password',
      label: 'Change Password',
      icon: KeyIcon,
      onSelect: () => { setModalMode('password'); setModalOpen(true); setOpen(false); },
    },
    {
      key: 'logout',
      label: 'Log Out',
      icon: LogoutIcon,
      destructive: true,
      onSelect: () => {
        setOpen(false);
        if (onLogout) onLogout(); else logout();
      },
    },
  ].filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* When opening, focus the first item so keyboard users land in the menu. */
  useEffect(() => {
    if (open) setFocusedIdx(0); else setFocusedIdx(-1);
  }, [open]);

  /* Roving focus within the menu. */
  const onMenuKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault(); setFocusedIdx(0);
    } else if (e.key === 'End') {
      e.preventDefault(); setFocusedIdx(items.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      items[focusedIdx]?.onSelect?.();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open || focusedIdx < 0) return;
    const node = menuRef.current?.querySelector(`[data-menu-idx="${focusedIdx}"]`);
    node?.focus();
  }, [open, focusedIdx]);

  const handleSave = useCallback(
    async (patch) => {
      if (typeof updateUser === 'function') {
        updateUser(patch);
      }
    },
    [updateUser],
  );

  const initials = (user?.name || 'U')
    .split(' ').filter(Boolean).slice(0, 2)
    .map((p) => p[0]?.toUpperCase()).join('') || 'U';
  const badge = roleColor(user?.role);

  if (!user) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: 36, height: 36, borderRadius: 9,
          background: 'rgba(108,92,231,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        👤
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes profileSlideDown {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        .profile-trigger { transition: border-color .2s, background .2s; }
        .profile-trigger:hover {
          border-color: rgba(108,92,231,0.6) !important;
          background: rgba(108,92,231,0.22) !important;
        }
        .profile-menu-item {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 10px 14px;
          background: transparent; border: none; cursor: pointer;
          color: #E0F2FE; font-size: 13px; font-weight: 500;
          font-family: inherit; text-align: left;
          transition: background .15s, color .15s;
          outline: none;
        }
        .profile-menu-item:hover,
        .profile-menu-item:focus-visible {
          background: rgba(108,92,231,0.18);
        }
        .profile-menu-item.destructive { color: #FCA5A5; }
        .profile-menu-item.destructive:hover,
        .profile-menu-item.destructive:focus-visible {
          background: rgba(220,38,38,0.18);
          color: #FECACA;
        }
        .profile-dropdown {
          animation: profileSlideDown .18s ease;
          transform-origin: top right;
        }
      `}</style>

      <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="profile-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Account menu for ${user.name || 'user'}`}
          title={user.name || 'Account'}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 10px',
            background: 'rgba(108,92,231,0.12)',
            border: '1px solid rgba(108,92,231,0.25)',
            borderRadius: 9,
            cursor: 'pointer',
            fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 26, height: 26, borderRadius: 7,
              background: `linear-gradient(135deg, ${badge}, #0284C7)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: 'white',
              fontFamily: 'Outfit, sans-serif',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
            }}
          >
            {initials}
          </span>
          {!isMobile && (
            <span
              style={{
                fontSize: 12, fontWeight: 600,
                color: 'rgba(125,211,252,0.9)',
                maxWidth: 90, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {user.name || 'User'}
            </span>
          )}
          <span
            aria-hidden="true"
            style={{
              fontSize: 9, color: 'rgba(125,211,252,0.6)',
              transform: open ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform .18s',
            }}
          >
            ▾
          </span>
        </button>

        {open && (
          <div
            ref={menuRef}
            role="menu"
            aria-label="Account menu"
            onKeyDown={onMenuKeyDown}
            className="profile-dropdown"
            style={{
              position: 'absolute', top: 44, right: 0,
              width: 'min(280px, 90vw)',
              background: '#0C2340',
              border: '1px solid rgba(108,92,231,0.3)',
              borderRadius: 14,
              boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
              zIndex: 300, overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'linear-gradient(135deg, rgba(108,92,231,0.25), rgba(108,92,231,0.05))',
                borderBottom: '1px solid rgba(108,92,231,0.18)',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `linear-gradient(135deg, ${badge}, #0284C7)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 800, fontSize: 13,
                  fontFamily: 'Outfit, sans-serif', flexShrink: 0,
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
                }}
              >
                {initials}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13, fontWeight: 700, color: '#E0F2FE',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  {user.name || 'Unnamed user'}
                </div>
                <div
                  style={{
                    fontSize: 10, color: 'rgba(125,211,252,0.65)',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', marginTop: 2,
                  }}
                >
                  {user.email || '—'}
                </div>
                <span
                  style={{
                    display: 'inline-block', marginTop: 6,
                    padding: '2px 7px', borderRadius: 999,
                    fontSize: 9, fontWeight: 800, color: 'white',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    background: badge,
                  }}
                >
                  {roleLabel(user.role)}
                </span>
              </div>
            </div>

            <div role="none" style={{ padding: '4px 0' }}>
              {items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    tabIndex={focusedIdx === i ? 0 : -1}
                    data-menu-idx={i}
                    onClick={item.onSelect}
                    onMouseEnter={() => setFocusedIdx(i)}
                    className={`profile-menu-item ${item.destructive ? 'destructive' : ''}`}
                  >
                    <Icon />
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ProfileModal
        open={modalOpen}
        user={user}
        canEdit={perms.canEditProfile}
        mode={modalMode}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}

/* ── Inline SVG icons — keeps this component dependency-free of an icon set. ── */

function ProfileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="m10 13 8-8 3 3-3 3 2 2-2 2-2-2-3 3" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
