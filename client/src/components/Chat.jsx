import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, Paperclip, SendHorizontal, ShoppingBag, Square, Trash2, X } from 'lucide-react';
import { api, inr, tokens } from '../api';
import '../styles/chat.css';

const POLL_MS = 3000;

/* ---------------- data ---------------- */
function mergeMessages(list, incoming) {
  if (!incoming.length) return list;
  const seen = new Set(list.map((m) => m.id));
  const fresh = incoming.filter((m) => !seen.has(m.id));
  return fresh.length ? [...list, ...fresh].sort((a, b) => a.id - b.id) : list;
}

/** Loads the customer's conversation and polls for new messages while the page is visible. */
function useCustomerChat() {
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState('');
  const lastId = useRef(0);

  const add = useCallback((incoming) => {
    setMessages((l) => {
      const next = mergeMessages(l || [], incoming);
      if (next.length) lastId.current = next[next.length - 1].id;
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    try {
      const d = await api.get(`/api/chat/messages?after=${lastId.current}`);
      add(d.messages);
      setError('');
    } catch (e) { setError(e.message); }
  }, [add]);

  useEffect(() => {
    poll();
    const t = setInterval(() => { if (document.visibilityState === 'visible') poll(); }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [poll]);

  return { messages, error, add };
}

/** multipart upload with progress (fetch can't report upload progress) */
function uploadFile(file, caption, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('caption', caption || '');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/chat/upload');
    const t = tokens.get('customer');
    if (t) xhr.setRequestHeader('Authorization', `Bearer ${t}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* empty */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.message || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.send(fd);
  });
}

/* ---------------- voice recorder ---------------- */
function pickAudioType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? '';
}

export function useRecorder(onDone, onError) {
  const [seconds, setSeconds] = useState(null); // null = not recording
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

/* ---------------- message rendering ---------------- */
export function ProductCardMessage({ product, compact = false }) {
  if (!product) return null;
  const off = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  return (
    <Link to={product.type === 'combo' ? `/combo/${product.slug}` : `/product/${product.slug}`} className={`chat-product ${compact ? 'compact' : ''}`}>
      {product.image ? <img src={product.image} alt="" /> : <span className="chat-product-fallback"><ShoppingBag size={20} /></span>}
      <span className="chat-product-body">
        <span className="chat-product-label">{product.type === 'combo' ? 'Combo kit enquiry' : 'Product enquiry'}</span>
        <strong>{product.name}</strong>
        {product.size && <span className="chat-product-meta">{product.category ? `${product.category} · ` : ''}{product.size}</span>}
        <span className="chat-product-price">
          {inr(product.price)}
          {product.mrp > product.price && <><s>{inr(product.mrp)}</s><em>{off}% off</em></>}
        </span>
      </span>
    </Link>
  );
}

function Bubble({ m, mine }) {
  return (
    <div className={`chat-row ${mine ? 'mine' : 'theirs'}`}>
      <div className={`chat-bubble kind-${m.kind}`}>
        {!mine && <span className="chat-sender">{m.senderName || 'Quench Elegance'}</span>}
        {m.kind === 'product' && <ProductCardMessage product={m.product} />}
        {m.kind === 'image' && (
          <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="chat-media"><img src={m.mediaUrl} alt={m.mediaName || 'Photo'} loading="lazy" /></a>
        )}
        {m.kind === 'video' && <video className="chat-media" src={m.mediaUrl} controls preload="metadata" playsInline />}
        {m.kind === 'audio' && <audio className="chat-audio" src={m.mediaUrl} controls preload="metadata" />}
        {m.text && <p className="chat-text">{m.text}</p>}
        <span className="chat-time">{timeOf(m.createdAt)}</span>
      </div>
    </div>
  );
}

/* ---------------- main component ---------------- */
/**
 * Customer chat with the Quench Elegance team.
 * `draftProduct` (from "Buy now") is shown above the composer and sent as a product enquiry card.
 */
export default function CustomerChat({ draftProduct, onDraftSent, onDraftDismiss }) {
  const { messages, error, add } = useCustomerChat();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploads, setUploads] = useState([]); // {id, name, progress}
  const [notice, setNotice] = useState('');
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const stickToBottom = useRef(true);

  // pre-fill a polite purchase request when arriving from "Buy now"
  useEffect(() => {
    if (draftProduct) setText(`Hi, I would like to buy ${draftProduct.name}${draftProduct.size ? ` (${draftProduct.size})` : ''}. Please share the order details.`);
  }, [draftProduct]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, uploads]);

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 4000); };

  const sendFile = async (file, caption = '') => {
    const id = `${Date.now()}-${Math.random()}`;
    stickToBottom.current = true;
    setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
    try {
      const d = await uploadFile(file, caption, (p) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x))));
      add([d.message]);
    } catch (e) { flash(e.message); } finally {
      setUploads((u) => u.filter((x) => x.id !== id));
    }
  };

  const recorder = useRecorder((file) => sendFile(file), flash);

  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && !draftProduct) || sending) return;
    setSending(true);
    stickToBottom.current = true;
    try {
      const d = await api.post('/api/chat/messages', draftProduct?.type === 'combo'
        ? { text: body, comboId: draftProduct.id }
        : { text: body, productId: draftProduct?.id || null });
      add([d.message]);
      setText('');
      if (draftProduct) onDraftSent?.();
    } catch (err) { flash(err.message); } finally { setSending(false); }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  };

  const pickFiles = (e) => {
    Array.from(e.target.files || []).slice(0, 5).forEach((f) => sendFile(f));
    e.target.value = '';
  };

  let lastDay = '';
  return (
    <div className="chat card">
      <div className="chat-head">
        <span className="chat-head-avatar">QE</span>
        <div>
          <strong>Quench Elegance team</strong>
          <span className="muted small">We usually reply within a few hours</span>
        </div>
      </div>

      <div className="chat-list" ref={listRef} onScroll={onScroll}>
        {messages === null && !error && <p className="chat-empty muted">Loading your conversation…</p>}
        {messages?.length === 0 && !draftProduct && (
          <div className="chat-empty">
            <h3>Start a conversation</h3>
            <p className="muted">Ask about a product, share a photo of your hair or send a voice note. Your chat history is saved here.</p>
          </div>
        )}
        {(messages || []).map((m) => {
          const day = dayOf(m.createdAt);
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {sep && <div className="chat-day"><span>{day}</span></div>}
              <Bubble m={m} mine={m.sender === 'customer'} />
            </div>
          );
        })}
        {uploads.map((u) => (
          <div key={u.id} className="chat-row mine">
            <div className="chat-bubble chat-uploading">
              <span className="small">Sending {u.name}…</span>
              <span className="chat-progress"><span style={{ width: `${u.progress}%` }} /></span>
            </div>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error chat-alert">{error}</div>}
      {notice && <div className="alert alert-error chat-alert">{notice}</div>}

      {draftProduct && (
        <div className="chat-draft">
          <ProductCardMessage product={draftProduct} compact />
          <button type="button" className="icon-btn sm" onClick={onDraftDismiss} aria-label="Remove product"><X size={16} /></button>
        </div>
      )}

      {recorder.recording ? (
        <div className="chat-composer recording">
          <button type="button" className="icon-btn" onClick={recorder.cancel} aria-label="Discard recording" title="Discard"><Trash2 size={19} /></button>
          <span className="chat-rec"><span className="chat-rec-dot" /> Recording {mmss(recorder.seconds)}</span>
          <button type="button" className="chat-send" onClick={recorder.stop} aria-label="Stop and send voice message" title="Send voice message"><Square size={16} fill="currentColor" /></button>
        </div>
      ) : (
        <form className="chat-composer" onSubmit={send}>
          <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} aria-label="Attach photo, video or audio" title="Photo, video or audio"><Paperclip size={19} /></button>
          <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" multiple hidden onChange={pickFiles} />
          <textarea
            className="chat-input"
            rows={1}
            placeholder={draftProduct ? 'Add a note for our team…' : 'Type a message'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            maxLength={4000}
          />
          {text.trim() || draftProduct ? (
            <button className="chat-send" disabled={sending} aria-label="Send" title={draftProduct ? 'Send enquiry' : 'Send'}><SendHorizontal size={18} /></button>
          ) : (
            <button type="button" className="chat-send" onClick={recorder.start} aria-label="Record voice message" title="Record voice message"><Mic size={18} /></button>
          )}
        </form>
      )}
    </div>
  );
}
