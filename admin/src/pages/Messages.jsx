import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Inbox, Mail, MailOpen, MessageCircle, Phone, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { fmtDate, timeAgo } from '../lib/format';
import { Avatar, EmptyState, PageHeader, PageLoader, SearchInput, Tabs } from '../components/ui';
import { useConfirm, useToast } from '../components/feedback';
import { useAuth } from '../components/auth';

export default function Messages() {
  const toast = useToast();
  const confirm = useConfirm();
  const { refreshCounts } = useAuth();
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = () => api.get('/messages').then((d) => setList(d.messages)).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list || []).filter((m) =>
      (filter !== 'unread' || !m.read) && (!s || `${m.name} ${m.email} ${m.phone} ${m.subject} ${m.message}`.toLowerCase().includes(s)));
  }, [list, filter, q]);
  const open = list?.find((m) => m.id === openId);
  const unread = (list || []).filter((m) => !m.read).length;

  const markRead = async (m, read) => {
    setList((l) => l.map((x) => (x.id === m.id ? { ...x, read } : x)));
    try { await api.put(`/messages/${m.id}`, { read }); refreshCounts(); } catch (e) { toast(e.message, 'error'); load(); }
  };
  const select = (m) => { setOpenId(m.id); if (!m.read) markRead(m, true); };
  const remove = async (m) => {
    const ok = await confirm({ title: 'Delete this message?', body: `From ${m.name}. This cannot be undone.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.del(`/messages/${m.id}`);
      setList((l) => l.filter((x) => x.id !== m.id));
      setOpenId(null);
      refreshCounts();
      toast('Message deleted');
    } catch (e) { toast(e.message, 'error'); }
  };

  const digits = (p) => (p || '').replace(/\D/g, '').slice(-10);

  return (
    <div>
      <PageHeader eyebrow="Inbox" title="Messages" subtitle="Enquiries sent from the website's contact form." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onChange={setFilter} tabs={[{ value: '', label: 'All', count: list?.length }, { value: 'unread', label: 'Unread', count: list ? unread : undefined }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search messages" className="sm:w-72" />
      </div>

      {!list ? <div className="card"><PageLoader /></div> : list.length === 0 ? (
        <div className="card"><EmptyState icon={Inbox} title="No messages yet">Contact-form submissions will land here.</EmptyState></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <ul className={`card max-h-[70vh] divide-y divide-silver-200/80 overflow-y-auto ${open ? 'hidden lg:block' : ''}`}>
            {shown.length === 0 && <li className="p-8 text-center text-sm text-muted">No matching messages.</li>}
            {shown.map((m) => (
              <li key={m.id}>
                <button onClick={() => select(m)} className={`relative flex w-full gap-3 px-4 py-4 text-left transition ${openId === m.id ? 'bg-cream/60' : 'hover:bg-white/70'}`}>
                  {openId === m.id && <span className="absolute inset-y-0 left-0 w-1 bg-gold" />}
                  <Avatar name={m.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-sm ${m.read ? 'text-ink-2' : 'font-semibold text-ink'}`}>{m.name}</span>
                      <span className="shrink-0 text-[11px] text-muted">{timeAgo(m.createdAt)}</span>
                    </span>
                    <span className={`block truncate text-sm ${m.read ? 'text-muted' : 'font-medium text-ink-2'}`}>{m.subject || 'No subject'}</span>
                    <span className="block truncate text-xs text-muted">{m.message}</span>
                  </span>
                  {!m.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gold" aria-label="Unread" />}
                </button>
              </li>
            ))}
          </ul>

          <div className={`${open ? '' : 'hidden lg:block'}`}>
            {!open ? (
              <div className="card grid h-full min-h-80 place-items-center"><EmptyState icon={MailOpen} title="Select a message">Choose a message on the left to read it.</EmptyState></div>
            ) : (
              <article className="card card-pad animate-fade-up">
                <button className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted lg:hidden" onClick={() => setOpenId(null)}><ArrowLeft size={15} /> All messages</button>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={open.name} className="size-12 text-sm" />
                    <div>
                      <h2 className="font-sans text-lg font-semibold">{open.name}</h2>
                      <p className="text-xs text-muted">{fmtDate(open.createdAt, true)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="icon-btn" onClick={() => markRead(open, !open.read)} title={open.read ? 'Mark unread' : 'Mark read'} aria-label={open.read ? 'Mark unread' : 'Mark read'}>
                      {open.read ? <Mail size={17} /> : <MailOpen size={17} />}
                    </button>
                    <button className="icon-btn hover:text-danger" onClick={() => remove(open)} aria-label="Delete"><Trash2 size={17} /></button>
                  </div>
                </div>
                <h3 className="mt-6 text-3xl">{open.subject || 'No subject'}</h3>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-2">{open.message}</p>
                <div className="mt-8 flex flex-wrap gap-2 border-t border-silver-200 pt-5">
                  {open.email && <a className="btn-primary" href={`mailto:${open.email}?subject=${encodeURIComponent('Re: ' + (open.subject || 'Your enquiry'))}`}><Mail size={15} /> Reply by email</a>}
                  {open.phone && <a className="btn-outline" href={`tel:${open.phone}`}><Phone size={15} /> {open.phone}</a>}
                  {digits(open.phone).length === 10 && (
                    <a className="btn-outline" href={`https://wa.me/91${digits(open.phone)}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>
                  )}
                </div>
              </article>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
