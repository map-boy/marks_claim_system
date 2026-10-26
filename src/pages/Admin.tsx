import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Submission, Status } from '../lib/types';

const STATUSES: Status[] = ['new', 'in_review', 'resolved', 'rejected'];
const PROBLEM: Record<string, string> = { cat2: 'CAT 2', fat: 'FAT', both: 'CAT 2 + FAT' };
const sel = 'rounded-xl border-2 border-sand bg-white px-3 py-2';

export default function Admin() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [fIntake, setFIntake] = useState('');
  const [fModule, setFModule] = useState('');
  const [fProblem, setFProblem] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) { nav('/admin/login'); return; }
    const { data, error } = await supabase
      .from('submissions').select('*').order('created_at', { ascending: false });
    if (error) setErr(error.message);
    else { setRows((data ?? []) as Submission[]); setErr(''); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const moduleNames = useMemo(() => Array.from(new Set(rows.map((r) => r.module_name))).sort(), [rows]);

  const shown = rows.filter((r) =>
    (!fIntake || r.intake === fIntake) &&
    (!fModule || r.module_name === fModule) &&
    (!fProblem || r.problem === fProblem) &&
    (!fStatus || r.status === fStatus) &&
    (!q || (r.full_name + ' ' + r.roll_number).toLowerCase().includes(q.toLowerCase()))
  );

  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  const allPicked = shown.length > 0 && shown.every((r) => picked.has(r.id));

  function toggle(id: string) {
    setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setPicked(allPicked ? new Set() : new Set(shown.map((r) => r.id)));
  }

  async function remove(ids: string[]) {
    if (ids.length === 0) return;
    if (!window.confirm('Delete ' + ids.length + ' submission(s) permanently? This cannot be undone.')) return;
    const { data, error } = await supabase.from('submissions').delete().in('id', ids).select('id');
    if (error) { setErr(error.message); return; }
    const gone = new Set((data ?? []).map((d: { id: string }) => d.id));
    if (gone.size === 0) { setErr('Nothing was deleted. Your user is probably not in the admins table.'); return; }
    setRows((rs) => rs.filter((r) => !gone.has(r.id)));
    setPicked(new Set());
    setErr('');
  }

  async function setStatus(id: string, status: Status) {
    const resolved_at = status === 'resolved' ? new Date().toISOString() : null;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.from('submissions').update({ status, resolved_at }).eq('id', id);
    if (error) setErr(error.message);
  }

  async function logout() {
    await supabase.auth.signOut();
    nav('/admin/login');
  }

  const filterText = [fIntake, fModule, fProblem && PROBLEM[fProblem], fStatus].filter(Boolean).join(' | ') || 'All';

  return (
    <div className="p-4">
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold text-tealdark">Marks problems</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={load} className="rounded-full bg-sand px-5 py-2 font-semibold text-tealdark">Refresh</button>
          <button onClick={() => remove(Array.from(picked))} disabled={picked.size === 0}
            className="rounded-full bg-red-600 px-5 py-2 font-semibold text-white disabled:opacity-40">
            Delete selected ({picked.size})
          </button>
          <button onClick={() => window.print()} className="rounded-full bg-tangerine px-5 py-2 font-semibold text-white">
            Print / Save as PDF
          </button>
          <button onClick={logout} className="rounded-full bg-teal px-5 py-2 font-semibold text-white">Sign out</button>
        </div>
      </div>

      <div className="no-print mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATUSES.map((s) => (
          <div key={s} className="rounded-2xl bg-white/70 p-3 text-center">
            <div className="text-3xl font-bold text-tangerine">{count(s)}</div>
            <div className="text-sm uppercase opacity-70">{s.replace('_', ' ')}</div>
          </div>
        ))}
      </div>

      <div className="no-print mb-4 flex flex-wrap gap-2">
        <select className={sel} value={fIntake} onChange={(e) => setFIntake(e.target.value)}>
          <option value="">All intakes</option>
          <option value="september">September</option>
          <option value="january">January</option>
          <option value="june">June</option>
        </select>
        <select className={sel} value={fModule} onChange={(e) => setFModule(e.target.value)}>
          <option value="">All modules</option>
          {moduleNames.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select className={sel} value={fProblem} onChange={(e) => setFProblem(e.target.value)}>
          <option value="">CAT 2 / FAT / both</option>
          <option value="cat2">CAT 2</option>
          <option value="fat">FAT</option>
          <option value="both">Both</option>
        </select>
        <select className={sel} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <input className={sel} placeholder="Search name or roll no." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="print-only mb-2">
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Marks problems report</h2>
        <p style={{ fontSize: 11 }}>
          Filters: {filterText} | Total: {shown.length} | Printed: {new Date().toLocaleString('en-GB')}
        </p>
      </div>

      {err && <p className="no-print mb-3 rounded-xl bg-orange-100 p-3 text-tangerine">{err}</p>}
      {loading && <p>Loading...</p>}
      {!loading && rows.length === 0 && !err && (
        <p className="no-print rounded-xl bg-white/70 p-3">No submissions yet.</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => (
          <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm border border-sand">
            <div className="no-print mb-2 flex items-center justify-between">
              <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
              <span className="text-xs opacity-60">{r.ref_no}</span>
            </div>
            <h3 className="font-display text-lg font-bold text-tealdark">{r.full_name}</h3>
            <p className="text-sm opacity-70">{r.roll_number} \u00b7 <span className="capitalize">{r.intake}</span></p>
            <p className="mt-2 text-sm"><b>{r.module_name}</b> \u2014 {r.lecturer}</p>
            <p className="text-sm">{PROBLEM[r.problem]}</p>
            {r.note && <p className="mt-1 text-sm italic opacity-80">"{r.note}"</p>}
            <p className="mt-1 text-xs opacity-60">{new Date(r.created_at).toLocaleDateString('en-GB')}</p>
            <div className="no-print mt-3 flex items-center justify-between">
              <select className="rounded-lg border border-sand px-2 py-1 text-sm" value={r.status}
                onChange={(e) => setStatus(r.id, e.target.value as Status)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              <div>
                <a className="mr-3 font-semibold text-teal underline" target="_blank" rel="noreferrer"
                  href={'https://wa.me/' + r.whatsapp.replace(/\D/g, '')}>WhatsApp</a>
                <button onClick={() => remove([r.id])} className="font-semibold text-red-600 underline">Delete</button>
              </div>
            </div>
            <span className="print-only">{r.status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}