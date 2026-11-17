import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { adminApi, fmtDate } from '../api';
import { useToast } from '../context/AppContext';
import { useAdmin } from './AdminApp';

export default function Requests() {
  const toast = useToast();
  const { refreshCounts } = useAdmin();
  const [status, setStatus] = useState('pending');
  const [list, setList] = useState(null);
  const [codes, setCodes] = useState({});

  const load = () => adminApi.get(`/registration-requests?status=${status}`).then((d) => setList(d.requests)).catch(() => setList([]));
  useEffect(() => { setList(null); load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (r) => {
    try {
      const d = await adminApi.post(`/registration-requests/${r.id}/approve`, { customerCode: codes[r.id] || '' });
      toast(`${r.name} registered · User ID ${d.customer.customerCode}`);
      load(); refreshCounts();
    } catch (e) { toast(e.message, 'error'); }
  };
  const reject = async (r) => {
    if (!window.confirm(`Reject the request from ${r.name}?`)) return;
    await adminApi.post(`/registration-requests/${r.id}/reject`);
    load(); refreshCounts();
  };

  return (
    <div className="adm-page">
      <div className="adm-head"><h1>Registration requests</h1></div>
      <p className="muted">Visitors whose mobile number isn't registered can request access from the login page. Approving creates a customer who can then log in with OTP.</p>
      <div className="adm-filters">
        <div className="chips">
          {['pending', 'approved', 'rejected'].map((s) => <button key={s} className={`chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}
        </div>
      </div>
      <div className="adm-card no-pad">
        {!list ? <div className="page-loader"><div className="spinner" /></div> : list.length === 0 ? <div className="empty-state"><p>No {status} requests.</p></div> : (
          <div className="table-scroll">
            <table className="adm-table">
              <thead><tr><th>Name</th><th>Mobile</th><th>City / message</th><th>Received</th>{status === 'pending' && <th>User ID (optional)</th>}{status === 'pending' && <th />}</tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}{r.email && <div className="muted small">{r.email}</div>}</td>
                    <td>+91 {r.phone}</td>
                    <td>{r.city || '—'}{r.message && <div className="muted small">{r.message}</div>}</td>
                    <td className="muted">{fmtDate(r.createdAt, true)}</td>
                    {status === 'pending' && <td><input className="input input-sm" placeholder="Auto" value={codes[r.id] || ''} onChange={(e) => setCodes({ ...codes, [r.id]: e.target.value })} /></td>}
                    {status === 'pending' && (
                      <td className="row-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => approve(r)}><Check size={15} /> Approve</button>
                        <button className="icon-btn sm" onClick={() => reject(r)} aria-label="Reject"><X size={16} /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
