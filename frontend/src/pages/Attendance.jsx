import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api";
import { useAuth } from "../auth";
import {
  MagnifyingGlass, Plus, X, Trash, PencilSimple, ClipboardText, ClockCounterClockwise,
  CheckCircle, Prohibit, Warning, XCircle, Clock, MapPin
} from "@phosphor-icons/react";

const STATUS_OPTS = [
  { id: "Completed", label: "Completed", icon: <CheckCircle size={28} weight="fill"/>, color: "#3D4F35", bg: "#E5EBE1" },
  { id: "No Service", label: "No Service", icon: <Prohibit size={28} weight="fill"/>, color: "#5C6853", bg: "#F0EDE9" },
  { id: "Cancelled", label: "Cancelled", icon: <Warning size={28} weight="fill"/>, color: "#8B6918", bg: "#FAF0D1" },
  { id: "No Show", label: "No Show", icon: <XCircle size={28} weight="fill"/>, color: "#8A3F27", bg: "#F8EBE7" },
];

function getUsedHours(sessions, clientId) {
  return sessions
    .filter(s => s.client_id === clientId && s.status === "Completed")
    .reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
}
function getStatus(used, pkg) {
  const rem = pkg - used;
  const pct = rem / pkg;
  if (rem <= 0 || pct <= 0.2 || rem <= 2) return "urgent";
  if (pct <= 0.35 || rem <= 4) return "warning";
  return "ok";
}

export default function Attendance() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [clients, setClients] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [logFor, setLogFor] = useState(null); // client OR null OR "__pick__"
  const [editingSess, setEditingSess] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);

  const load = useCallback(async () => {
    const [c, t, s] = await Promise.all([
      api.get("/clients"),
      api.get("/therapists").catch(() => ({ data: [] })),
      api.get("/sessions"),
    ]);
    setClients(c.data); setTherapists(t.data); setSessions(s.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const enriched = useMemo(() => clients.map(c => {
    const used = getUsedHours(sessions, c.id);
    const pkg = c.package_hours || 24;
    const rem = Math.max(0, pkg - used);
    return { ...c, used, pkg, rem, pct: Math.min(100, Math.round(used/pkg*100)), status: getStatus(used, pkg) };
  }), [clients, sessions]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (filter !== "all") list = list.filter(c => c.status === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.file_no || "").includes(q));
    }
    const order = { urgent: 0, warning: 1, ok: 2 };
    return [...list].sort((a, b) => order[a.status] - order[b.status]);
  }, [enriched, filter, search]);

  const counts = {
    all: enriched.length,
    urgent: enriched.filter(c => c.status === "urgent").length,
    warning: enriched.filter(c => c.status === "warning").length,
    ok: enriched.filter(c => c.status === "ok").length,
  };

  const findT = id => therapists.find(t => t.id === id);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Attendance</h1>
          <div className="text-sm" style={{color: "#5C6853"}}>Log sessions, track hours, monitor packages</div>
        </div>
        <button data-testid="log-session-picker" onClick={() => setLogFor("__pick__")} className="btn btn-primary"><Plus size={16}/> Log Session</button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap mb-3">
        {[
          {id:"all", label:"All", color:"#7A8A6A"},
          {id:"urgent", label:"🔴 Urgent", color:"#C97B5C"},
          {id:"warning", label:"🟡 Warning", color:"#D4A64A"},
          {id:"ok", label:"🟢 OK", color:"#7A8A6A"},
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
                  className={`pill px-4 py-2 text-sm transition border-2 ${filter === f.id ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : "bg-white border-[#E8E4DE]"}`}>
            {f.label} <span className="opacity-60 text-xs">({counts[f.id]})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <MagnifyingGlass size={18} className="absolute top-3 left-3" style={{color: "#8B9E7A"}}/>
        <input data-testid="att-search" className="input pl-10" placeholder="Search client by name or file #..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {/* Client cards */}
      <div className="space-y-3 stagger">
        {filtered.length === 0 && <div className="card p-12 text-center" style={{color: "#8B9E7A"}}>No clients</div>}
        {filtered.map(c => {
          const fillColor = c.status === "urgent" ? "#C97B5C" : c.status === "warning" ? "#D4A64A" : "#7A8A6A";
          const stCls = c.status === "urgent" ? "bg-[#F8EBE7] text-[#8A3F27]" : c.status === "warning" ? "bg-[#FAF0D1] text-[#6B5218]" : "bg-[#E5EBE1] text-[#3D4F35]";
          const stIcon = c.status === "urgent" ? "🔴" : c.status === "warning" ? "🟡" : "🟢";
          return (
            <div key={c.id} className="card p-5" style={{borderColor: c.status === "ok" ? "#E8E4DE" : fillColor, borderWidth: c.status === "ok" ? 1 : 2}}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold shrink-0 text-white" style={{background: c.color || "#7A8A6A", color: "#2C3625"}}>
                    {(c.name || "?").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-lg" style={{color: "#2C3625"}}>{c.name} <span className="text-xs font-normal ml-1" style={{color: "#8B9E7A"}}>#{c.file_no}</span></div>
                    <div className="text-xs mt-0.5" style={{color: "#8B9E7A"}}>
                      Pkg {c.pkg}h · Used {c.used.toFixed(1)}h · Main: {findT(c.main_therapist_id)?.name || "—"}
                    </div>
                  </div>
                </div>
                <span className={`pill ${stCls} font-bold`}>{stIcon} {c.status.toUpperCase()}</span>
              </div>

              <div className="flex items-center gap-2 mt-3 mb-3">
                <div className="flex-1 h-2 bg-[#F0EDE9] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, background: fillColor }}/>
                </div>
                <span className="text-xs min-w-[80px] text-right font-bold" style={{color: "#5C6853"}}>{c.rem}/{c.pkg}h left</span>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button data-testid={`log-${c.id}`} onClick={() => setLogFor(c)} className="btn btn-primary text-xs"><Plus size={14}/> Log Session</button>
                <button onClick={() => setHistoryFor(c)} className="btn btn-secondary text-xs"><ClockCounterClockwise size={14}/> History</button>
                <button onClick={() => setHistoryFor(c)} className="btn btn-gold text-xs"><ClipboardText size={14}/> Invoice Sheet</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Picker modal */}
      {logFor === "__pick__" && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setLogFor(null)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <div className="font-display text-2xl">Select Client</div>
              <button onClick={() => setLogFor(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <div className="max-h-96 overflow-y-auto flex flex-col gap-2">
              {enriched.map(c => (
                <button key={c.id} onClick={() => setLogFor(c)} className="text-left p-3 rounded-xl border border-[#E8E4DE] hover:bg-[#E5EBE1] flex items-center gap-3 transition">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold" style={{background: c.color || "#E5EBE1"}}>{c.name.charAt(0)}</div>
                  <div className="flex-1">
                    <div className="font-bold text-sm" style={{color: "#2C3625"}}>{c.name}</div>
                    <div className="text-[11px]" style={{color: "#8B9E7A"}}>#{c.file_no} · {c.rem}/{c.pkg}h left</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Log Session form */}
      {logFor && logFor !== "__pick__" && (
        <LogSessionForm client={logFor} therapists={therapists} currentUser={user} onClose={() => setLogFor(null)} onSaved={() => { setLogFor(null); load(); }}/>
      )}

      {/* History / Invoice */}
      {historyFor && (
        <HistoryModal client={historyFor} sessions={sessions.filter(s => s.client_id === historyFor.id)}
                      therapists={therapists} isAdmin={isAdmin} currentUserId={user?.id}
                      onClose={() => setHistoryFor(null)}
                      onEdit={(s) => { setEditingSess(s); }}
                      onDeleted={() => load()}/>
      )}

      {editingSess && (
        <LogSessionForm session={editingSess} client={clients.find(c => c.id === editingSess.client_id)} therapists={therapists} currentUser={user}
                        onClose={() => setEditingSess(null)} onSaved={() => { setEditingSess(null); load(); }}/>
      )}
    </div>
  );
}

function LogSessionForm({ client, therapists, currentUser, onClose, onSaved, session }) {
  const [form, setForm] = useState(session ? {...session} : {
    client_id: client.id,
    session_date: new Date().toISOString().slice(0, 10),
    start_time: "14:00", end_time: "16:00", hours: 2,
    status: "Completed",
    therapist_ids: currentUser?.role === "therapist" ? [currentUser.id] : [client.main_therapist_id].filter(Boolean),
    note: "", location: client.locations?.[0]?.address || "",
  });

  const computeHours = (st, et) => {
    if (!st || !et) return 0;
    const [h1,m1] = st.split(":").map(Number); const [h2,m2] = et.split(":").map(Number);
    let diff = (h2*60+m2) - (h1*60+m1); if (diff < 0) diff += 24*60;
    return Math.round(diff / 30) / 2;
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = {...form, hours: computeHours(form.start_time, form.end_time)};
    if (session?.id) await api.put(`/sessions/${session.id}`, payload);
    else await api.post("/sessions", payload);
    onSaved();
  };

  const toggleT = (id) => {
    setForm(f => ({...f, therapist_ids: f.therapist_ids.includes(id) ? f.therapist_ids.filter(x => x !== id) : [...f.therapist_ids, id]}));
  };

  return (
    <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form onSubmit={submit} className="card p-6 w-full max-w-lg modal-card max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-display text-2xl" style={{color: "#2C3625"}}>{session ? "Edit Session" : "Log Session"}</div>
            <div className="text-sm" style={{color: "#5C6853"}}>{client?.name} <span className="text-xs">#{client?.file_no}</span></div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost p-2"><X size={18}/></button>
        </div>

        {client?.locations?.length > 0 && (
          <>
            <label className="label">Location</label>
            <select data-testid="sess-location" className="select mb-3" value={form.location} onChange={e=>setForm({...form, location: e.target.value})}>
              {client.locations.map((l, i) => <option key={i} value={l.address}>{l.service} | {l.address}</option>)}
            </select>
          </>
        )}

        <label className="label">Status</label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {STATUS_OPTS.map(s => (
            <button key={s.id} type="button" onClick={() => setForm({...form, status: s.id})}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${form.status === s.id ? "ring-2 ring-[#7A8A6A]" : ""}`}
                    style={{background: s.bg, borderColor: form.status === s.id ? "#7A8A6A" : s.bg, color: s.color}}>
              {s.icon}
              <div className="font-bold text-sm">{s.label}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="label">Date</label>
            <input data-testid="sess-date" type="date" className="input" required value={form.session_date} onChange={e=>setForm({...form, session_date: e.target.value})}/>
          </div>
          <div>
            <label className="label">Start</label>
            <input type="time" className="input" value={form.start_time} onChange={e=>setForm({...form, start_time: e.target.value})}/>
          </div>
          <div>
            <label className="label">End</label>
            <input type="time" className="input" value={form.end_time} onChange={e=>setForm({...form, end_time: e.target.value})}/>
          </div>
        </div>
        <div className="text-xs mb-3" style={{color: "#8B9E7A"}}>
          <Clock size={12} className="inline mr-1"/> Calculated: <strong>{computeHours(form.start_time, form.end_time)}h</strong>
        </div>

        <label className="label">Therapist(s)</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {therapists.map(t => {
            const sel = form.therapist_ids.includes(t.id);
            return (
              <button key={t.id} type="button" onClick={() => toggleT(t.id)}
                      className={`pill px-3 py-1.5 text-xs transition ${sel ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : "bg-white border border-[#E8E4DE]"}`}>
                {t.name}
              </button>
            );
          })}
        </div>

        <label className="label">Note (optional)</label>
        <textarea className="textarea mb-4" rows={3} value={form.note || ""} onChange={e=>setForm({...form, note: e.target.value})}/>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button data-testid="sess-save" type="submit" className="btn btn-primary">{session ? "Save changes" : "Log Session"}</button>
        </div>
      </form>
    </div>
  );
}

function HistoryModal({ client, sessions, therapists, isAdmin, currentUserId, onClose, onEdit, onDeleted }) {
  const [page, setPage] = useState(0);
  const findT = id => therapists.find(t => t.id === id);
  const used = sessions.filter(s => s.status === "Completed").reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
  const pkg = client.package_hours || 24;
  const rem = Math.max(0, pkg - used);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const pageSessions = sessions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const removeSess = async (sid) => {
    if (!window.confirm("Delete this session?")) return;
    await api.delete(`/sessions/${sid}`);
    onDeleted();
  };

  return (
    <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card p-0 w-full max-w-3xl modal-card max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        {/* Invoice header */}
        <div className="p-6 border-b border-[#E8E4DE]" style={{background: `${client.color || "#E5EBE1"}30`}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold" style={{background: client.color || "#E5EBE1", color: "#2C3625"}}>{client.name.charAt(0)}</div>
              <div>
                <div className="text-xs font-bold tracking-[0.2em]" style={{color: "#8B9E7A"}}>INVOICE / ATTENDANCE SHEET</div>
                <div className="font-display text-2xl" style={{color: "#2C3625"}}>{client.name}</div>
                <div className="text-xs" style={{color: "#5C6853"}}>File #{client.file_no} · {client.locations?.[0]?.address}</div>
              </div>
            </div>
            <button onClick={onClose} className="btn btn-ghost p-2"><X size={20}/></button>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
            <div className="bg-white rounded-xl p-3 border border-[#E8E4DE]">
              <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>PACKAGE</div>
              <div className="font-display text-xl" style={{color: "#2C3625"}}>{pkg}h</div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-[#E8E4DE]">
              <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>USED</div>
              <div className="font-display text-xl" style={{color: "#7A8A6A"}}>{used.toFixed(1)}h</div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-[#E8E4DE]">
              <div className="text-[10px] font-bold tracking-wider" style={{color: "#8B9E7A"}}>REMAINING</div>
              <div className="font-display text-xl" style={{color: rem <= 4 ? "#C97B5C" : "#3D4F35"}}>{rem}h</div>
            </div>
          </div>
        </div>

        {/* Sessions table */}
        <div className="flex-1 overflow-y-auto p-4">
          {sessions.length === 0 ? (
            <div className="p-12 text-center" style={{color: "#8B9E7A"}}>No sessions logged yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead style={{background: "#F6F4F0"}}>
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Time</th>
                  <th className="p-2 text-left">Hrs</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Therapist(s)</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {pageSessions.map((s, i) => {
                  const stCls = s.status === "Completed" ? "bg-[#E5EBE1] text-[#3D4F35]" :
                                s.status === "Cancelled" ? "bg-[#FAF0D1] text-[#6B5218]" :
                                s.status === "No Show" ? "bg-[#F8EBE7] text-[#8A3F27]" : "bg-[#F0EDE9] text-[#5C6853]";
                  const tNames = (s.therapist_ids || []).map(id => findT(id)?.name?.replace("Ms. ", "")).filter(Boolean).join(", ");
                  const canEdit = isAdmin || (s.therapist_ids || []).includes(currentUserId);
                  return (
                    <tr key={s.id} className="border-t border-[#E8E4DE] hover:bg-[#FAFAF7]">
                      <td className="p-2 text-xs" style={{color: "#8B9E7A"}}>{page * PAGE_SIZE + i + 1}</td>
                      <td className="p-2 font-bold">{s.session_date}</td>
                      <td className="p-2 text-xs">{s.start_time} – {s.end_time}</td>
                      <td className="p-2 font-bold">{s.hours}h</td>
                      <td className="p-2"><span className={`pill ${stCls} text-[10px]`}>{s.status}</span></td>
                      <td className="p-2 text-xs">{tNames || "—"}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {canEdit && <button onClick={() => onEdit(s)} className="btn btn-ghost p-1.5"><PencilSimple size={14}/></button>}
                        {canEdit && <button onClick={() => removeSess(s.id)} className="btn btn-ghost p-1.5 text-red-700"><Trash size={14}/></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="p-3 border-t border-[#E8E4DE] flex items-center justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0} className="btn btn-outline text-xs disabled:opacity-40">← Prev</button>
            <div className="text-xs font-bold" style={{color: "#5C6853"}}>Page {page+1} / {totalPages}</div>
            <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page===totalPages-1} className="btn btn-outline text-xs disabled:opacity-40">Next →</button>
          </div>
        )}

        <div className="p-3 border-t border-[#E8E4DE] text-[10px] text-center" style={{color: "#8B9E7A"}}>
          Generated {new Date().toLocaleString('en-US')} · Boost Growth Center
        </div>
      </div>
    </div>
  );
}
