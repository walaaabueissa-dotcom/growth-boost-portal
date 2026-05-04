import { useEffect, useMemo, useState, useCallback } from "react";
import api, { DAYS_EN, DAYS_SHORT, TIME_SLOTS, SERVICE_CODES, startOfWeek, addDays, toISODate, formatDateRange } from "../api";
import { useAuth } from "../auth";
import {
  CaretLeft, CaretRight, Plus, Trash, Copy, BellRinging, X, House, MagnifyingGlass,
  MagnifyingGlassPlus, MagnifyingGlassMinus, Printer, Info
} from "@phosphor-icons/react";

const STATES = [
  { id: "normal", label: "Normal", swatch: "#E5EBE1" },
  { id: "cancel_therapist", label: "Therapist Cancellation", swatch: "#FCE0E8" },
  { id: "cancel_child", label: "Client Cancellation", swatch: "#FFF4C4" },
];

export default function Schedule() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [cells, setCells] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [notify, setNotify] = useState(null);
  const [zoom, setZoom] = useState(100); // 70..130

  const weekStartISO = toISODate(weekStart);

  const load = useCallback(async () => {
    const [c, t, cl] = await Promise.all([
      api.get("/schedule", { params: { week_start: weekStartISO } }),
      api.get("/therapists").catch(() => ({ data: [] })),
      api.get("/clients").catch(() => ({ data: [] })),
    ]);
    setCells(c.data); setTherapists(t.data); setClients(cl.data);
  }, [weekStartISO]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const close = () => setCtxMenu(null);
    if (ctxMenu) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [ctxMenu]);

  const cellMap = useMemo(() => {
    const m = {};
    cells.forEach(c => { m[`${c.therapist_id}_${c.day}_${c.time_slot}`] = c; });
    return m;
  }, [cells]);

  const filteredTherapists = useMemo(() => {
    if (!isAdmin && user) return therapists.filter(t => t.id === user.id);
    if (!search) return therapists;
    return therapists.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  }, [therapists, search, user, isAdmin]);

  const openCell = (therapist_id, day, time_slot) => {
    if (!isAdmin) return;
    const existing = cellMap[`${therapist_id}_${day}_${time_slot}`];
    setEdit(existing ? {...existing}
      : { therapist_id, day, time_slot, service_code: "SS", child_name: "", state: "normal", week_start: weekStartISO });
  };

  const save = async () => {
    const payload = { ...edit, week_start: weekStartISO };
    if (edit.id) await api.put(`/schedule/${edit.id}`, payload);
    else await api.post("/schedule", payload);
    setEdit(null); load();
  };
  const remove = async (id) => { await api.delete(`/schedule/${id}`); load(); };
  const duplicate = async (id) => { await api.post(`/schedule/${id}/duplicate`); load(); };
  const sendNotify = async () => {
    await api.post(`/schedule/${notify.id}/notify`, { message: notify.message });
    setNotify(null);
  };

  const onCtx = (e, cell) => {
    if (!isAdmin || !cell) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, cell });
  };

  const renderCell = (therapist, day, time_slot) => {
    const cell = cellMap[`${therapist.id}_${day}_${time_slot}`];
    const sc = SERVICE_CODES.find(s => s.id === cell?.service_code);
    let cls = "cell-base cell-empty";
    if (cell) {
      cls = "cell-base has-event";
    }
    return (
      <td key={`${day}-${time_slot}`} className={cls}
          data-testid={`cell-${therapist.id}-${day}-${time_slot}`}
          onClick={() => !cell && openCell(therapist.id, day, time_slot)}
          onContextMenu={(e) => onCtx(e, cell)}>
        {cell && (
          <div className={`cell-event ${sc?.cls || ""} ${cell.state === "cancel_therapist" ? "cell-cancel-therapist" : ""} ${cell.state === "cancel_child" ? "cell-cancel-child" : ""}`}
               onClick={(e) => { e.stopPropagation(); openCell(therapist.id, day, time_slot); }}>
            <div className="font-bold truncate">
              {cell.service_code === "LEAVE" || cell.service_code === "BREAK" || cell.service_code === "AVC" ? (
                cell.note || sc?.short
              ) : (
                <>{sc?.short || cell.service_code} {cell.child_name && <span className="opacity-90">| {cell.child_name}</span>}</>
              )}
            </div>
            {cell.custom_time && <div className="text-[10px] opacity-80 truncate">({cell.custom_time})</div>}
            {cell.note && cell.service_code !== "LEAVE" && cell.service_code !== "BREAK" && cell.service_code !== "AVC" && (
              <div className="text-[10px] opacity-70 truncate">{cell.note}</div>
            )}
          </div>
        )}
      </td>
    );
  };

  return (
    <div>
      <div className="flex items-start flex-wrap gap-3 mb-5">
        <div className="flex-1 min-w-[240px]">
          <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Weekly Schedule</h1>
          <div className="text-sm" style={{color: "#5C6853"}}>{isAdmin ? "Click any empty cell to add a session — right-click to copy / cancel / notify" : "Your assigned sessions for the week"}</div>
        </div>
        <div className="flex items-center gap-1.5 card p-1.5">
          <button data-testid="prev-week-btn" onClick={() => setWeekStart(addDays(weekStart, -7))} className="btn btn-ghost p-2"><CaretLeft size={18}/></button>
          <div className="px-3 py-1.5 text-sm font-bold min-w-[160px] text-center" style={{color: "#2C3625"}}>
            {formatDateRange(weekStart)}
          </div>
          <button data-testid="next-week-btn" onClick={() => setWeekStart(addDays(weekStart, 7))} className="btn btn-ghost p-2"><CaretRight size={18}/></button>
          <div className="w-px h-6 bg-[#E8E4DE] mx-1"/>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="btn btn-ghost text-xs"><House size={14}/> Today</button>
        </div>
        <div className="flex items-center gap-1.5 card p-1.5">
          <button onClick={() => setZoom(Math.max(70, zoom-10))} className="btn btn-ghost p-2"><MagnifyingGlassMinus size={16}/></button>
          <div className="px-2 text-xs font-bold min-w-[40px] text-center">{zoom}%</div>
          <button onClick={() => setZoom(Math.min(140, zoom+10))} className="btn btn-ghost p-2"><MagnifyingGlassPlus size={16}/></button>
          <div className="w-px h-6 bg-[#E8E4DE] mx-1"/>
          <button onClick={() => window.print()} className="btn btn-ghost p-2"><Printer size={16}/></button>
        </div>
      </div>

      {/* Legend */}
      <div className="card p-3 mb-4 flex items-center flex-wrap gap-3 text-xs">
        <div className="font-bold flex items-center gap-1" style={{color: "#5C6853"}}><Info size={14}/> Legend:</div>
        {SERVICE_CODES.slice(0, 7).map(s => (
          <span key={s.id} className={`pill ${s.cls}`}>{s.short}</span>
        ))}
        <span className="pill" style={{background: "#FCE0E8", color: "#8B3A55", border: "1px solid #E8A4BD"}}>✕ Therapist Cancel</span>
        <span className="pill" style={{background: "#FFF4C4", color: "#6B5218", border: "1px solid #E8C572"}}>✕ Client Cancel</span>
      </div>

      {/* Search */}
      {isAdmin && (
        <div className="relative max-w-sm mb-5">
          <MagnifyingGlass size={18} className="absolute top-3 left-3" style={{color: "#8B9E7A"}}/>
          <input className="input pl-10" placeholder="Search therapist..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
      )}

      {/* Therapist blocks */}
      <div className="space-y-6 stagger" style={{ zoom: `${zoom}%` }}>
        {filteredTherapists.length === 0 && <div className="card p-12 text-center" style={{color: "#8B9E7A"}}>No therapists found</div>}
        {filteredTherapists.map((therapist, idx) => (
          <div key={therapist.id} className="card p-0 overflow-hidden" data-testid={`therapist-block-${therapist.id}`}>
            {/* Header strip */}
            <div className="flex items-center gap-3 p-4 border-b" style={{borderColor: "#E8E4DE", background: `linear-gradient(90deg, ${therapist.color}15 0%, transparent 100%)`}}>
              <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold shadow-sm" style={{background: therapist.color}}>
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="text-[11px] tracking-[0.2em] font-bold" style={{color: "#8B9E7A"}}>THERAPIST</div>
                <div className="font-bold text-lg" style={{color: "#2C3625"}}>{therapist.name}</div>
              </div>
              {therapist.email && <div className="text-xs" style={{color: "#8B9E7A"}}>{therapist.email}</div>}
            </div>

            {/* Grid table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse" style={{minWidth: 1100}}>
                <thead>
                  <tr>
                    <th className="cell-base text-center font-bold" style={{minWidth: 90, background: "#F6F4F0", color: "#2C3625"}}>Day</th>
                    {TIME_SLOTS.map(ts => (
                      <th key={ts} className="cell-base text-center font-bold" style={{background: "#F6F4F0", color: "#2C3625"}}>
                        {ts.replace(' AM', 'a').replace(' PM', 'p')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS_EN.map((d, di) => (
                    <tr key={di}>
                      <td className="cell-base text-center font-bold" style={{background: "#F6F4F0", color: "#2C3625"}}>
                        <div className="text-[11px] tracking-wider">{DAYS_SHORT[di].toUpperCase()}</div>
                        <div className="text-[10px] font-normal" style={{color: "#8B9E7A"}}>{addDays(weekStart, di).getDate()}/{addDays(weekStart, di).getMonth()+1}</div>
                      </td>
                      {TIME_SLOTS.map(ts => renderCell(therapist, di, ts))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-lg modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-display text-2xl" style={{color: "#2C3625"}}>{edit.id ? "Edit Session" : "New Session"}</div>
                <div className="text-sm" style={{color: "#5C6853"}}>{therapists.find(t=>t.id===edit.therapist_id)?.name} · {DAYS_EN[edit.day]} · {edit.time_slot}</div>
              </div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>

            <label className="label">Service</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {SERVICE_CODES.map(s => (
                <button key={s.id} type="button" onClick={() => setEdit({...edit, service_code: s.id})}
                        className={`pill ${s.cls} justify-center py-2 ${edit.service_code === s.id ? "ring-2 ring-[#7A8A6A]" : ""}`}>
                  {s.short}
                </button>
              ))}
            </div>

            {!["LEAVE", "BREAK", "AVC"].includes(edit.service_code) && (
              <>
                <label className="label">Child / Subject</label>
                <input data-testid="cell-child-input" className="input mb-3" list="clients-list" value={edit.child_name || ""} onChange={e => setEdit({...edit, child_name: e.target.value})} placeholder="Child name"/>
                <datalist id="clients-list">{clients.map(c => <option key={c.id} value={c.name}/>)}</datalist>
              </>
            )}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Custom Time (optional)</label>
                <input className="input" placeholder="e.g. 2:30-4:30" value={edit.custom_time || ""} onChange={e=>setEdit({...edit, custom_time: e.target.value})}/>
              </div>
              <div>
                <label className="label">Note (optional)</label>
                <input className="input" value={edit.note || ""} onChange={e=>setEdit({...edit, note: e.target.value})}/>
              </div>
            </div>

            <label className="label">State</label>
            <div className="flex gap-2 mb-4 flex-wrap">
              {STATES.map(s => (
                <button key={s.id} type="button" onClick={() => setEdit({...edit, state: s.id})}
                        className={`pill ${edit.state === s.id ? "ring-2 ring-[#7A8A6A]" : ""}`}
                        style={{background: s.swatch, color: "#2C3625", border: `1px solid ${s.swatch}`}}>
                  {s.id !== "normal" && "✕ "}{s.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 justify-end flex-wrap">
              {edit.id && <button data-testid="cell-delete-btn" onClick={() => { remove(edit.id); setEdit(null); }} className="btn btn-danger"><Trash size={16}/> Delete</button>}
              {edit.id && <button onClick={() => { duplicate(edit.id); setEdit(null); }} className="btn btn-secondary"><Copy size={16}/> Duplicate</button>}
              {edit.id && edit.state !== "normal" && <button onClick={() => { setNotify({...edit, message: ""}); setEdit(null); }} className="btn btn-gold"><BellRinging size={16}/> Notify</button>}
              <button onClick={() => setEdit(null)} className="btn btn-outline">Cancel</button>
              <button data-testid="cell-save-btn" onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Right-click context menu */}
      {ctxMenu && (
        <div className="fixed card p-1 z-50 min-w-48" style={{ top: ctxMenu.y, left: ctxMenu.x }} onClick={e => e.stopPropagation()}>
          <button onClick={() => { openCell(ctxMenu.cell.therapist_id, ctxMenu.cell.day, ctxMenu.cell.time_slot); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-sm">Edit</button>
          <button onClick={() => { duplicate(ctxMenu.cell.id); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-sm"><Copy size={14}/> Duplicate</button>
          <div className="divider my-1"/>
          <button onClick={async () => { await api.put(`/schedule/${ctxMenu.cell.id}`, {...ctxMenu.cell, state: "cancel_child"}); setCtxMenu(null); load(); }} className="btn btn-ghost w-full justify-start text-sm" style={{color: "#8B6918"}}>🟡 Mark Client Cancel</button>
          <button onClick={async () => { await api.put(`/schedule/${ctxMenu.cell.id}`, {...ctxMenu.cell, state: "cancel_therapist"}); setCtxMenu(null); load(); }} className="btn btn-ghost w-full justify-start text-sm" style={{color: "#8B3A55"}}>🩷 Mark Therapist Cancel</button>
          <button onClick={async () => { await api.put(`/schedule/${ctxMenu.cell.id}`, {...ctxMenu.cell, state: "normal"}); setCtxMenu(null); load(); }} className="btn btn-ghost w-full justify-start text-sm">✓ Mark Normal</button>
          <div className="divider my-1"/>
          <button onClick={() => { setNotify({ ...ctxMenu.cell, message: "" }); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-sm"><BellRinging size={14}/> Notify Therapist</button>
          <button onClick={() => { remove(ctxMenu.cell.id); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-sm text-red-700"><Trash size={14}/> Delete</button>
        </div>
      )}

      {/* Notify modal */}
      {notify && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setNotify(null)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e=>e.stopPropagation()}>
            <div className="font-display text-2xl mb-2">Notify Therapist</div>
            <div className="text-sm mb-3" style={{color: "#5C6853"}}>An in-app notification will be sent immediately.</div>
            <textarea data-testid="notify-message" className="textarea mb-3" rows={4} placeholder="Notification message..."
                      value={notify.message} onChange={e => setNotify({...notify, message: e.target.value})}/>
            <div className="flex justify-end gap-2">
              <button onClick={() => setNotify(null)} className="btn btn-outline">Cancel</button>
              <button data-testid="notify-send-btn" onClick={sendNotify} className="btn btn-primary"><BellRinging size={16}/> Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
