import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown, ExternalLink, FileText, FolderTree, Gift, Inbox, LayoutDashboard, LogOut, Menu, MessagesSquare, Package, Settings, ShoppingBag, UserPlus, Users, X,
} from 'lucide-react';
import { useAuth } from './auth';
import { useToast } from './feedback';
import { Avatar } from './ui';
import { SITE_URL } from '../lib/format';

const NAV = [
  { group: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    group: 'Sales',
    items: [
      { to: '/orders', label: 'Orders', icon: ShoppingBag },
      { to: '/invoices', label: 'Invoices', icon: FileText },
      { to: '/products', label: 'Products', icon: Package },
      { to: '/combos', label: 'Combos', icon: Gift },
      { to: '/categories', label: 'Categories', icon: FolderTree },
    ],
  },
  {
    group: 'People',
    items: [
      { to: '/chats', label: 'Chats', icon: MessagesSquare, badge: 'unreadChats' },
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/requests', label: 'Registration requests', icon: UserPlus, badge: 'pendingRequests' },
      { to: '/messages', label: 'Messages', icon: Inbox, badge: 'unreadMessages' },
    ],
  },
  { group: 'Account', items: [{ to: '/settings', label: 'Settings', icon: Settings }] },
];

function Sidebar({ open, onClose }) {
  const { counts, logout } = useAuth();
  const toast = useToast();
  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col overflow-hidden bg-linear-to-b from-brown-900 via-brown-800 to-brown-950 text-white shadow-lift transition-transform duration-300 lg:translate-x-0 lg:shadow-none ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* warm gold glow, same mood as the storefront's dark sections */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_260px_at_100%_0%,rgba(201,153,92,.22),transparent_65%),radial-gradient(300px_300px_at_0%_100%,rgba(201,153,92,.12),transparent_65%)]" />

        <div className="relative flex items-center justify-between px-6 pb-5 pt-6">
          <img src="/admin/images/brand/logo-white.png" alt="Quench Elegance" className="h-11 w-auto" />
          <button className="icon-btn text-white hover:bg-white/10 lg:hidden" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <div className="relative mx-6 h-px bg-linear-to-r from-transparent via-gold/60 to-transparent" />

        <nav className="relative flex-1 space-y-6 overflow-y-auto px-4 py-6">
          {NAV.map((g) => (
            <div key={g.group}>
              <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[.3em] text-gold-soft/55">{g.group}</p>
              <div className="space-y-0.5">
                {g.items.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition ${isActive ? 'bg-white/10 font-medium text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute -left-4 top-2 bottom-2 w-1 rounded-r-full bg-gold" />}
                        <n.icon size={18} className={isActive ? 'text-gold-soft' : 'text-white/55 group-hover:text-white/80'} />
                        <span className="flex-1">{n.label}</span>
                        {n.badge && counts[n.badge] > 0 && (
                          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1.5 text-[11px] font-semibold text-brown-950">{counts[n.badge]}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative space-y-1 border-t border-white/10 p-4">
          <a href={SITE_URL + '/'} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white">
            <ExternalLink size={17} /> View website
          </a>
          <button onClick={() => { logout(); toast('Signed out'); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white">
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-40 bg-brown-950/50 backdrop-blur-[2px] lg:hidden" onClick={onClose} />}
    </>
  );
}

function UserMenu() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition hover:bg-white/60">
        <Avatar name={admin.name} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium">{admin.name}</span>
          <span className="block text-xs text-muted">{admin.email}</span>
        </span>
        <ChevronDown size={15} className="text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-52 animate-pop rounded-2xl border border-silver-200 bg-[#fbfbfb] p-1.5 shadow-lift">
          <button onClick={() => { setOpen(false); navigate('/settings'); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-silver-100">
            <Settings size={16} /> Settings
          </button>
          <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-danger hover:bg-[#f8e3e0]">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const [nav, setNav] = useState(false);
  const { pathname } = useLocation();
  const { refreshCounts } = useAuth();

  useEffect(() => { setNav(false); window.scrollTo(0, 0); refreshCounts(); }, [pathname, refreshCounts]);
  // keep sidebar badges (new chats, requests, messages) fresh while the panel is open
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && refreshCounts(), 30000);
    return () => clearInterval(t);
  }, [refreshCounts]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen">
      <Sidebar open={nav} onClose={() => setNav(false)} />
      <div className="lg:pl-[272px]">
        <header className="sticky top-0 z-30 border-b border-white/60 bg-white/55 backdrop-blur-md no-print">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-8">
            <button className="icon-btn lg:hidden" onClick={() => setNav(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <img src="/admin/images/brand/logo-brown.png" alt="" className="h-8 w-auto lg:hidden" />
            <p className="hidden text-sm text-muted lg:block">
              {greeting} · <span className="text-ink-2">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </p>
            <div className="ml-auto"><UserMenu /></div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-7 sm:px-8 sm:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
