import { useEffect, useState } from 'react';
import { Mail, MailOpen, Phone, Trash2 } from 'lucide-react';
import { adminApi, fmtDate } from '../api';
import { useAdmin } from './AdminApp';

export default function Messages() {
  const { refreshCounts } = useAdmin();
  const [list, setList] = useState(null);
  const load = () => adminApi.get('/messages').then((d) => setList(d.messages)).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  const mark = async (m, read) => { await adminApi.put(`/messages/${m.id}`, { read }); load(); refreshCounts(); };
  const remove = async (m) => { if (!window.confirm('Delete this message?')) return; await adminApi.del(`/messages/${m.id}`); load(); refreshCounts(); };

  return (
    <div className="adm-page">
      <div className="adm-head"><h1>Messages</h1></div>
      {!list ? <div className="page-loader"><div className="spinner" /></div> : list.length === 0 ? <div className="adm-card empty-state"><p>No messages from the contact form yet.</p></div> : (
        <div className="msg-list">
          {list.map((m) => (
            <article key={m.id} className={`adm-card msg ${m.read ? '' : 'unread'}`}>
              <div className="msg-head">
                <div><strong>{m.name}</strong>{m.subject && <span className="badge">{m.subject}</span>}<div className="muted small">{fmtDate(m.createdAt, true)}</div></div>
                <div className="row-actions">
                  <button className="icon-btn sm" onClick={() => mark(m, !m.read)} title={m.read ? 'Mark unread' : 'Mark read'}>{m.read ? <Mail size={16} /> : <MailOpen size={16} />}</button>
                  <button className="icon-btn sm" onClick={() => remove(m)} title="Delete"><Trash2 size={16} /></button>
                </div>
              </div>
              <p className="msg-body">{m.message}</p>
              <div className="msg-contact">
                {m.phone && <a href={`tel:${m.phone}`}><Phone size={14} /> {m.phone}</a>}
                {m.email && <a href={`mailto:${m.email}`}><Mail size={14} /> {m.email}</a>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
