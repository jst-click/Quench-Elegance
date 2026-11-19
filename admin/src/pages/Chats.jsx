import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, Mail, MapPin, MessagesSquare, Mic, Package, Paperclip, Phone, SendHorizontal, ShoppingBag, Square, Trash2, User, X,
} from 'lucide-react';
import { api, token } from '../lib/api';
import { fmtDate, inr, SITE_URL, timeAgo } from '../lib/format';
import { ActivePill, Avatar, EmptyState, PageHeader, PageLoader, SearchInput, StatusBadge } from '../components/ui';
import { useToast } from '../components/feedback';
import { useAuth } from '../components/auth';

const POLL_MS = 3000;
const LIST_POLL_MS = 6000;

/* ---------------- helpers ---------------- */
function mergeMessages(list, incoming) {
  if (!incoming.length) return list;
  const seen = new Set(list.map((m) => m.id));
  const fresh = incoming.filter((m) => !seen.has(m.id));
  return fresh.length ? [...list, ...fresh].sort((a, b) => a.id - b.id) : list;
}

function uploadChatFile(customerId, file, caption, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('caption', caption || '');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/admin/chats/${customerId}/upload`);
    const t = token.get();
    if (t) xhr.setRequestHeader('Authorization', `Bearer ${t}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* empty */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.message || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'));
    xhr.send(fd);
  });
}

function pickAudioType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? '';
}

function useRecorder(onDone, onError) {
  const [seconds, setSeconds] = useState(null);
  const rec = useRef(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (seconds === null) return undefined;
    const t = setTimeout(() => setSeconds((s) => (s === null ? s : s + 1)), 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  useEffect(() => () => rec.current?.stream.getTracks().forEach((tr) => tr.stop()), []);

  const start = async () => {
    const type = pickAudioType();
    if (type === null || !navigator.mediaDevices?.getUserMedia) { onError('Voice recording is not supported in this browser.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        rec.current = null;
        setSeconds(null);
        if (cancelled.current || !chunks.length) return;
        const mime = (r.mimeType || type || 'audio/webm').split(';')[0];
        const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
        onDone(new File(chunks, `voice-${Date.now()}.${ext}`, { type: mime }));
      };
      cancelled.current = false;
      rec.current = { recorder: r, stream };
      r.start();
      setSeconds(0);
    } catch {
      onError('Microphone permission was denied.');
    }
  };
  const stop = () => rec.current?.recorder.state !== 'inactive' && rec.current?.recorder.stop();
  const cancel = () => { cancelled.current = true; stop(); };
  return { recording: seconds !== null, seconds: seconds || 0, start, stop, cancel };
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const timeOf = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const dayOf = (d) => {
  const date = new Date(d);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === y.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

/* ---------------- message pieces ---------------- */
function ProductCard({ product, mine }) {
  if (!product) return null;
  const off = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  return (
    <a
      href={`${SITE_URL}/${product.type === 'combo' ? 'combo' : 'product'}/${product.slug}`}
      target="_blank"
      rel="noreferrer"
      className={`-mx-1 mb-1.5 flex min-w-60 items-center gap-3 rounded-xl border p-2 transition ${mine ? 'border-white/15 bg-white/10 hover:bg-white/15' : 'border-silver-200 bg-cream/40 hover:border-gold'}`}
    >
      {product.image
        ? <img src={product.image} alt="" className="size-16 shrink-0 rounded-lg bg-white object-cover" />
        : <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-silver-100 text-bronze"><ShoppingBag size={20} /></span>}
      <span className="grid min-w-0 gap-0.5">
        <span className={`text-[10px] font-semibold uppercase tracking-[.18em] ${mine ? 'text-gold-soft' : 'text-bronze'}`}>{product.type === 'combo' ? 'Combo kit enquiry' : 'Product enquiry'}</span>
        <strong className="text-sm leading-tight">{product.name}</strong>
        {product.size && <span className={`text-xs ${mine ? 'text-white/70' : 'text-muted'}`}>{product.category ? `${product.category} · ` : ''}{product.size}</span>}
        <span className="flex flex-wrap items-baseline gap-2 text-sm font-semibold">
          {inr(product.price)}
          {off > 0 && <><s className={`text-xs font-normal ${mine ? 'text-white/60' : 'text-muted'}`}>{inr(product.mrp)}</s><span className="text-xs text-success">{off}% off</span></>}
        </span>
        {product.inStock === false && <span className="text-xs text-danger">Out of stock when sent</span>}
      </span>
    </a>
  );
}

function Bubble({ m }) {
  const mine = m.sender === 'admin';
  return (
    <div className={`my-1 flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[85%] rounded-2xl px-3 pb-5 pt-2 shadow-soft [overflow-wrap:anywhere] sm:max-w-[70%] ${mine ? 'rounded-br-sm bg-brown-800 text-white' : 'rounded-bl-sm bg-white text-ink'}`}
      >
        {mine && <span className="mb-0.5 block text-[11px] font-medium text-gold-soft/80">{m.senderName || 'Admin'}</span>}
        {m.kind === 'product' && <ProductCard product={m.product} mine={mine} />}
        {m.kind === 'image' && (
          <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="-mx-1 mb-1 block overflow-hidden rounded-xl">
            <img src={m.mediaUrl} alt={m.mediaName || 'Photo'} loading="lazy" className="max-h-80 w-full bg-silver-100 object-cover" />
          </a>
        )}
        {m.kind === 'video' && <video src={m.mediaUrl} controls preload="metadata" playsInline className="-mx-1 mb-1 max-h-80 w-full rounded-xl bg-black" />}
        {m.kind === 'audio' && <audio src={m.mediaUrl} controls preload="metadata" className="my-1 h-10 w-64 max-w-full" />}
        {m.text && <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">{m.text}</p>}
        <span className={`absolute bottom-1 right-2.5 text-[10.5px] ${mine ? 'text-white/55' : 'text-muted'}`}>{timeOf(m.createdAt)}</span>
      </div>
    </div>
  );
}

/* ---------------- product picker (share a product card) ---------------- */
function ProductPicker({ onPick, onClose }) {
  const [products, setProducts] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/products').then((d) => setProducts(d.products)).catch(() => setProducts([])); }, []);
  const shown = (products || []).filter((p) => p.active && p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="absolute bottom-full left-2 right-2 z-20 mb-2 animate-pop rounded-2xl border border-silver-200 bg-[#fbfbfb] p-3 shadow-lift sm:right-auto sm:w-96">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Share a product</p>
        <button className="icon-btn size-7" onClick={onClose} aria-label="Close"><X size={15} /></button>
      </div>
      <SearchInput value={q} onChange={setQ} placeholder="Search products" />
      <ul className="mt-2 max-h-64 overflow-y-auto">
        {!products && <li className="p-4"><PageLoader /></li>}
        {products && shown.length === 0 && <li className="p-4 text-center text-sm text-muted">No products found.</li>}
        {shown.map((p) => (
          <li key={p.id}>
            <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-cream/50" onClick={() => onPick(p)}>
              {p.image ? <img src={p.image} alt="" className="size-10 rounded-lg object-cover" /> : <span className="size-10 rounded-lg bg-silver-100" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted">{inr(p.price)} · {p.stock} in stock</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- conversation pane ---------------- */
function ChatThread({ customerId, onActivity }) {
  const toast = useToast();
  const [data, setData] = useState(null); // {customer, orders, orderCount}
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [picker, setPicker] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const lastId = useRef(0);
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const stick = useRef(true);

  const add = useCallback((incoming) => {
    setMessages((l) => {
      const next = mergeMessages(l || [], incoming);
      if (next.length) lastId.current = next[next.length - 1].id;
      return next;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    lastId.current = 0;
    stick.current = true;
    setData(null); setMessages(null); setError(''); setText(''); setPicker(false);
    api.get(`/chats/${customerId}/messages`).then((d) => {
      if (!alive) return;
      setData({ customer: d.customer, orders: d.orders, orderCount: d.orderCount });
      add(d.messages);
      onActivity?.();
    }).catch((e) => alive && setError(e.message));

    const poll = () => {
      if (document.visibilityState !== 'visible' || !alive) return;
      api.get(`/chats/${customerId}/messages?after=${lastId.current}`)
        .then((d) => { if (alive && d.messages.length) { add(d.messages); onActivity?.(); } })
        .catch(() => {});
    };
    const t = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [customerId, add]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = listRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, uploads]);

  const sendFile = async (file) => {
    const id = `${Date.now()}-${Math.random()}`;
    stick.current = true;
    setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
    try {
      const d = await uploadChatFile(customerId, file, '', (p) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x))));
      add([d.message]);
      onActivity?.();
    } catch (e) { toast(e.message, 'error'); } finally {
      setUploads((u) => u.filter((x) => x.id !== id));
    }
  };
  const recorder = useRecorder(sendFile, (m) => toast(m, 'error'));

  const post = async (body) => {
    setSending(true);
    stick.current = true;
    try {
      const d = await api.post(`/chats/${customerId}/messages`, body);
      add([d.message]);
      onActivity?.();
      return true;
    } catch (e) { toast(e.message, 'error'); return false; } finally { setSending(false); }
  };
  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    if (await post({ text: body })) setText('');
  };
  const shareProduct = async (p) => { setPicker(false); await post({ text: '', productId: p.id }); };

  if (error) return <div className="card grid h-full place-items-center p-8"><EmptyState icon={MessagesSquare} title="Chat unavailable">{error}</EmptyState></div>;
  if (!data) return <div className="card h-full"><PageLoader /></div>;
  const c = data.customer;
  let lastDay = '';

  return (
    <div className="grid h-full min-h-0 gap-5 xl:grid-cols-[1fr_300px]">
      <section className="card flex min-h-0 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-silver-200 bg-white/70 px-4 py-3">
          <Link to="/chats" className="icon-btn lg:hidden" aria-label="All chats"><ArrowLeft size={18} /></Link>
          <Avatar name={c.name} className="size-10 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{c.name}</p>
            <p className="truncate text-xs text-muted">+91 {c.phone} · {c.customerCode}</p>
          </div>
          <a href={`tel:+91${c.phone}`} className="icon-btn" aria-label="Call customer" title="Call"><Phone size={17} /></a>
          <button className="icon-btn xl:hidden" onClick={() => setShowInfo((v) => !v)} aria-label="Customer details" title="Customer details"><User size={17} /></button>
          <Link to={`/customers/${c.id}`} className="icon-btn hidden sm:inline-grid" aria-label="Open customer profile" title="Customer profile"><ExternalLink size={17} /></Link>
        </header>

        {showInfo && <div className="max-h-[45%] overflow-y-auto border-b border-silver-200 xl:hidden"><CustomerPanel data={data} /></div>}

        <div ref={listRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto bg-linear-to-b from-[#f7f4ef] to-[#f1ece4] px-3 py-4 sm:px-5">
          {messages?.length === 0 && (
            <EmptyState icon={MessagesSquare} title="No messages yet">Send {c.name.split(' ')[0]} a message to start the conversation.</EmptyState>
          )}
          {(messages || []).map((m) => {
            const day = dayOf(m.createdAt);
            const sep = day !== lastDay;
            lastDay = day;
            return (
              <div key={m.id}>
                {sep && <div className="my-3 flex justify-center"><span className="rounded-full bg-white/80 px-3 py-1 text-[11px] uppercase tracking-wider text-muted">{day}</span></div>}
                <Bubble m={m} />
              </div>
            );
          })}
          {uploads.map((u) => (
            <div key={u.id} className="my-1 flex justify-end">
              <div className="grid w-56 gap-2 rounded-2xl rounded-br-sm bg-brown-800 px-3 py-2 text-white">
                <span className="truncate text-xs">Sending {u.name}…</span>
                <span className="h-1 overflow-hidden rounded bg-white/25"><span className="block h-full bg-gold transition-all" style={{ width: `${u.progress}%` }} /></span>
              </div>
            </div>
          ))}
        </div>

        <div className="relative border-t border-silver-200 bg-white/85 p-2.5">
          {picker && <ProductPicker onPick={shareProduct} onClose={() => setPicker(false)} />}
          {recorder.recording ? (
            <div className="flex items-center gap-2">
              <button className="icon-btn" onClick={recorder.cancel} aria-label="Discard recording" title="Discard"><Trash2 size={18} /></button>
              <span className="flex flex-1 items-center gap-2 text-sm font-medium text-danger">
                <span className="size-2.5 animate-pulse rounded-full bg-danger" /> Recording {mmss(recorder.seconds)}
              </span>
              <button className="grid size-11 place-items-center rounded-full bg-brown-800 text-white hover:bg-brown-950" onClick={recorder.stop} aria-label="Stop and send" title="Send voice message">
                <Square size={15} fill="currentColor" />
              </button>
            </div>
          ) : (
            <form onSubmit={send} className="flex items-end gap-1.5">
              <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} aria-label="Attach photo, video or audio" title="Photo, video or audio"><Paperclip size={18} /></button>
              <button type="button" className="icon-btn" onClick={() => setPicker((v) => !v)} aria-label="Share a product" title="Share a product"><Package size={18} /></button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*,audio/*"
                multiple
                hidden
                onChange={(e) => { Array.from(e.target.files || []).slice(0, 5).forEach(sendFile); e.target.value = ''; }}
              />
              <textarea
                rows={1}
                className="input max-h-36 min-h-11 flex-1 resize-none rounded-3xl [field-sizing:content]"
                placeholder="Type a reply"
                value={text}
                maxLength={4000}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
              />
              {text.trim() ? (
                <button className="grid size-11 shrink-0 place-items-center rounded-full bg-brown-800 text-white hover:bg-brown-950 disabled:opacity-50" disabled={sending} aria-label="Send"><SendHorizontal size={18} /></button>
              ) : (
                <button type="button" className="grid size-11 shrink-0 place-items-center rounded-full bg-brown-800 text-white hover:bg-brown-950" onClick={recorder.start} aria-label="Record voice message" title="Record voice message"><Mic size={18} /></button>
              )}
            </form>
          )}
        </div>
      </section>

      <aside className="card hidden min-h-0 overflow-y-auto xl:block"><CustomerPanel data={data} /></aside>
    </div>
  );
}

function CustomerPanel({ data }) {
  const { customer: c, orders, orderCount } = data;
  const address = c.addresses?.[0];
  return (
    <div className="space-y-5 p-5">
      <div className="text-center">
        <Avatar name={c.name} className="mx-auto size-16 text-lg" />
        <h3 className="mt-2 text-2xl">{c.name}</h3>
        <p className="text-xs text-muted">User ID {c.customerCode}</p>
        <div className="mt-2"><ActivePill active={c.active} /></div>
      </div>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2"><Phone size={15} className="text-bronze" /> <a className="link" href={`tel:+91${c.phone}`}>+91 {c.phone}</a></li>
        {c.email && <li className="flex items-center gap-2"><Mail size={15} className="text-bronze" /> <a className="link truncate" href={`mailto:${c.email}`}>{c.email}</a></li>}
        {address && (
          <li className="flex gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-bronze" />
            <span className="text-ink-2">{address.line1}{address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} – {address.pincode}</span>
          </li>
        )}
        <li className="text-xs text-muted">Customer since {fmtDate(c.createdAt)} · last login {c.lastLoginAt ? timeAgo(c.lastLoginAt) : 'never'}</li>
      </ul>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.16em] text-muted">Orders ({orderCount})</p>
        {orders.length === 0 ? <p className="text-sm text-muted">No orders yet.</p> : (
          <ul className="space-y-1.5">
            {orders.map((o) => (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-cream/50">
                  <span><span className="font-medium">#{o.orderNumber}</span> <span className="text-xs text-muted">{fmtDate(o.createdAt)}</span></span>
                  <span className="flex items-center gap-2"><span className="text-xs">{inr(o.total)}</span><StatusBadge status={o.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Link to={`/customers/${c.id}`} className="btn-outline w-full"><User size={15} /> Full customer profile</Link>
    </div>
  );
}

/* ---------------- page ---------------- */
export default function Chats() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshCounts } = useAuth();
  const [chats, setChats] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  const loadList = useCallback(() => {
    api.get('/chats').then((d) => setChats(d.chats)).catch(() => setChats((c) => c || []));
  }, []);
  useEffect(() => {
    loadList();
    const t = setInterval(() => document.visibilityState === 'visible' && loadList(), LIST_POLL_MS);
    return () => clearInterval(t);
  }, [loadList]);

  // opening / replying in a chat changes unread counts and ordering
  const onActivity = useCallback(() => { loadList(); refreshCounts(); }, [loadList, refreshCounts]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (chats || []).filter((c) =>
      (filter !== 'unread' || c.unreadAdmin > 0)
      && (!s || `${c.customer.name} ${c.customer.phone} ${c.customer.customerCode}`.toLowerCase().includes(s)));
  }, [chats, q, filter]);
  const unreadCount = (chats || []).filter((c) => c.unreadAdmin > 0).length;

  return (
    <div>
      <PageHeader eyebrow="Inbox" title="Chats" subtitle="Conversations with your customers — product enquiries, photos, videos and voice notes." />

      <div className="grid h-[calc(100vh-14rem)] min-h-[520px] gap-5 lg:grid-cols-[340px_1fr]">
        <aside className={`card flex min-h-0 flex-col overflow-hidden ${id ? 'hidden lg:flex' : 'flex'}`}>
          <div className="space-y-2.5 border-b border-silver-200 p-3">
            <SearchInput value={q} onChange={setQ} placeholder="Search name, phone, User ID" />
            <div className="flex gap-1.5">
              {[['all', 'All', chats?.length], ['unread', 'Unread', unreadCount]].map(([v, label, n]) => (
                <button key={v} onClick={() => setFilter(v)} className={`chip !py-1 text-xs ${filter === v ? 'chip-active' : ''}`}>
                  {label}{n != null && <span className={`rounded-full px-1.5 text-[11px] ${filter === v ? 'bg-white/20' : 'bg-silver-200 text-muted'}`}>{n}</span>}
                </button>
              ))}
            </div>
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-silver-200/80 overflow-y-auto">
            {!chats && <li><PageLoader /></li>}
            {chats && shown.length === 0 && (
              <li className="p-8 text-center text-sm text-muted">
                {chats.length === 0 ? 'No chats yet. When a customer taps “Buy now” or messages you, the conversation appears here.' : 'No matching chats.'}
              </li>
            )}
            {shown.map((c) => {
              const active = c.customerId === id;
              const unread = c.unreadAdmin > 0 && !active;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => navigate(`/chats/${c.customerId}`)}
                    className={`relative flex w-full gap-3 px-4 py-3.5 text-left transition ${active ? 'bg-cream/60' : 'hover:bg-white/70'}`}
                  >
                    {active && <span className="absolute inset-y-0 left-0 w-1 bg-gold" />}
                    <Avatar name={c.customer.name} className="size-10 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm ${unread ? 'font-semibold text-ink' : 'font-medium text-ink-2'}`}>{c.customer.name}</span>
                        <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.lastMessageAt)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-xs ${unread ? 'font-medium text-ink-2' : 'text-muted'}`}>
                          {c.lastSender === 'admin' && <span className="text-muted">You: </span>}{c.lastMessagePreview}
                        </span>
                        {unread && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-gold px-1.5 text-[11px] font-semibold text-brown-950">{c.unreadAdmin}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className={`min-h-0 ${id ? 'block' : 'hidden lg:block'}`}>
          {id ? <ChatThread key={id} customerId={id} onActivity={onActivity} /> : (
            <div className="card grid h-full place-items-center">
              <EmptyState icon={MessagesSquare} title="Select a chat">Pick a customer on the left to open the conversation.</EmptyState>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
