import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, UserPlus, X } from 'lucide-react';
import { api } from '../lib/api';
import { fmtDate, timeAgo } from '../lib/format';
import { Avatar, EmptyState, PageHeader, PageLoader, SearchInput, Tabs } from '../components/ui';
import { ConcernChips, FlagIcon } from '../components/Consultation';
import { useConfirm, useToast } from '../components/feedback';
import { useAuth } from '../components/auth';

export default function Requests() {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { counts, refreshCounts } = useAuth();
  const [status, setStatus] = useState('pending');
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');

  const load = () => api.get(`/registration-requests?status=${status}`).then((d) => setList(d.requests)).catch(() => setList([]));
  useEffect(() => { setList(null); load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list || [];
    return (list || []).filter((r) =>
      [r.name, r.phone, r.email, r.city, ...(r.consultation?.concerns || [])].join(' ').toLowerCase().includes(s));
  }, [list, q]);

  const reject = async (r) => {
    const ok = await confirm({ title: `Reject ${r.name}?`, body: 'They will not be able to log in. They can register again later.', confirmLabel: 'Reject', danger: true });
    if (!ok) return;
    setBusy(r.id);
    try {
      await api.post(`/registration-requests/${r.id}/reject`);
      toast('Request rejected');
      load();
      refreshCounts();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  };

  const pending = status === 'pending';

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Registration requests"
        subtitle="New customers register by completing the Hair & Scalp consultation. Review it, add your assessment, and approve — only approved customers can log in."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={status}
          onChange={setStatus}
          tabs={[
            { value: 'pending', label: 'Pending review', count: counts.pendingRequests ?? undefined },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Name, mobile, city, concern" className="sm:w-80" />
      </div>

      <div className="card overflow-hidden">
        {!list ? <PageLoader /> : shown.length === 0 ? (
          <EmptyState icon={UserPlus} title={q ? 'No matching requests' : `No ${pending ? 'pending' : status} requests`}>
            {q ? 'Try a different search.' : pending ? "You're all caught up." : null}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Mobile</th>
                  <th>City</th>
                  <th>Primary concerns</th>
                  <th>Duration</th>
                  <th>Submitted</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const c = r.consultation;
                  const submitted = c?.submittedAt || r.createdAt;
                  return (
                    <tr key={r.id} className="cursor-pointer" onClick={() => navigate(`/requests/${r.id}`)}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={r.name} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Link to={`/requests/${r.id}`} onClick={(e) => e.stopPropagation()} className="truncate font-medium hover:text-brown-800 hover:underline">{r.name}</Link>
                              <FlagIcon flags={c?.flags} />
                            </div>
                            {r.email && <div className="max-w-52 truncate text-xs text-muted">{r.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">+91 {r.phone}</td>
                      <td className="whitespace-nowrap text-ink-2">{r.city || <span className="text-muted">—</span>}</td>
                      <td className="min-w-44 max-w-64">
                        {c ? <ConcernChips concerns={c.concerns} max={2} /> : <span className="text-xs text-muted">No consultation</span>}
                      </td>
                      <td className="whitespace-nowrap text-sm text-ink-2">{c?.duration || <span className="text-muted">—</span>}</td>
                      <td className="whitespace-nowrap">
                        <div className="text-sm">{timeAgo(submitted)}</div>
                        <div className="text-xs text-muted">{fmtDate(submitted)}</div>
                      </td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        {pending ? (
                          <div className="flex items-center justify-end gap-1">
                            <Link to={`/requests/${r.id}`} className="btn-primary btn-sm whitespace-nowrap">Review <ArrowRight size={13} /></Link>
                            <button className="icon-btn text-danger hover:bg-danger/10" onClick={() => reject(r)} disabled={busy === r.id} aria-label={`Reject ${r.name}`} title="Reject">
                              <X size={17} />
                            </button>
                          </div>
                        ) : r.status === 'approved' && r.customerId ? (
                          <Link to={`/customers/${r.customerId}?tab=consultation`} className="link whitespace-nowrap text-sm">Customer →</Link>
                        ) : (
                          <Link to={`/requests/${r.id}`} className="link whitespace-nowrap text-sm">View</Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
