import { useEffect, useMemo, useState, useCallback } from "react";
import api, { DAYS_EN, DAYS_SHORT, TIME_SLOTS, SERVICE_CODES, startOfWeek, addDays, toISODate, formatDateRange } from "../api";
import { getChildColor, readable } from "../childColors";
import { useAuth } from "../auth";
import {
  CaretLeft, CaretRight, Trash, Copy, BellRinging, X, House, MagnifyingGlass,
  MagnifyingGlassPlus, MagnifyingGlassMinus, Printer, Info, GridFour, UsersThree
} from "@phosphor-icons/react";

const STATES = [
  { id: "normal", label: "Normal", swatch: "#E5EBE1" },
  { id: "cancel_therapist", label: "Therapist Cancellation", swatch: "#FCE0E8" },
  { id: "cancel_child", label: "Client Cancellation", swatch: "#FFF4C4" },
];

function CellEvent({ cell, sc }) {
  const childColor = cell.color || (cell.child_name ? getChildColor(cell.child_name) : null);
  const isCancel = cell.state === "cancel_therapist" || cell.state === "cancel_child";
  const bgStyle = isCancel
    ? {} // CSS class handles
    : childColor
      ? { background: childColor, borderColor: childColor, color: readable(childColor) }
      : {};
  let stateClass = "";
  if (cell.state === "cancel_therapist") stateClass = "cell-cancel-therapist";
  else if (cell.state === "cancel_child") stateClass = "cell-cancel-child";
  const baseClass = childColor || isCancel ? "" : (sc?.cls || "");
  return (
    <div className={`cell-event ${baseClass} ${stateClass}`} style={bgStyle}>
      <div className="font-bold truncate text-[11px]">
        {["LEAVE","BREAK","AVC"].includes(cell.service_code) ? (cell.note || sc?.short)
          : (<>{sc?.short || cell.service_code}{cell.child_name && <> | {cell.child_name}</>}</>)}
      </div>
      {cell.custom_time && <div className="text-[9px] opacity-80 truncate">({cell.custom_time})</div>}
    </div>
  );
}

export default function Schedule() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [view, setView] = useState("blocks"); // "blocks" or "master"
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [cells, setCells] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [notify, setNotify] = useState(null);
  const [zoom, setZoom] = useState(100);

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

  // Track time-slot indices that are "covered" by an earlier cell with duration > 1
  const coveredSet = useMemo(() => {
    const cov = new Set();
    cells.forEach(c => {
      const dur = c.duration || 1;
      if (dur <= 1) return;
      const startIdx = TIME_SLOTS.indexOf(c.time_slot);
      if (startIdx < 0) return;
      for (let k = 1; k < dur; k++) {
        const idx = startIdx + k;
        if (idx < TIME_SLOTS.length) cov.add(`${c.therapist_id}_${c.day}_${TIME_SLOTS[idx]}`);
      }
    });
    return cov;
  }, [cells]);

  const visibleTherapists = useMemo(() => {
    let list = therapists;
    if (search) list = list.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [therapists, search]);

  const handleCellClick = (e, therapist_id, day, time_slot, existing) => {
    e.stopPropagation();
    if (!isAdmin) return;
    setEdit(existing ? {...existing}
      : { therapist_id, day, time_slot, service_code: "SS", child_name: "", state: "normal", week_start: weekStartISO, color: null });
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
  const setState = async (cell, state) => {
    await api.put(`/schedule/${cell.id}`, {...cell, state});
    setCtxMenu(null); load();
  };

  const onCtx = (e, cell) => {
    if (!isAdmin || !cell) return;
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, cell });
  };

  // === BLOCKS VIEW (per-therapist) ===
  const renderTherapistBlock = (therapist, idx) => (
    <div key={therapist.id} className="card p-0 overflow-hidden" data-testid={`therapist-block-${therapist.id}`}>
      <div className="flex items-center gap-3 p-4 border-b" style={{borderColor: "#E8E4DE", background: `linear-gradient(90deg, ${therapist.color}15 0%, transparent 100%)`}}>
        <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold shadow-sm" style={{background: therapist.color}}>{idx + 1}</div>
        <div className="flex-1">
          <div className="text-[11px] tracking-[0.2em] font-bold" style={{color: "#8B9E7A"}}>THERAPIST</div>
          <div className="font-bold text-lg" style={{color: "#2C3625"}}>{therapist.name}</div>
        </div>
        {therapist.email && <div className="text-xs" style={{color: "#8B9E7A"}}>{therapist.email}</div>}
      </div>
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
                {TIME_SLOTS.map(ts => {
                  const cell = cellMap[`${therapist.id}_${di}_${ts}`];
                  const isCovered = coveredSet.has(`${therapist.id}_${di}_${ts}`);
                  if (isCovered) return null;
                  const sc = SERVICE_CODES.find(s => s.id === cell?.service_code);
                  const dur = cell?.duration || 1;
                  return (
                    <td key={ts} className={`cell-base ${cell ? 'has-event' : 'cell-empty'}`}
                        colSpan={dur}
                        data-testid={`cell-${therapist.id}-${di}-${ts}`}
                        onClick={(e) => handleCellClick(e, therapist.id, di, ts, cell)}
                        onContextMenu={(e) => onCtx(e, cell)}>
                      {cell && <CellEvent cell={cell} sc={sc}/>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // === MASTER VIEW (all therapists in one big grid) — by day-tabs to keep it readable ===
  const [masterDay, setMasterDay] = useState(0);
  const renderMaster = () => (
    <div className="card p-0 overflow-hidden">
      <div className="p-3 border-b border-[#E8E4DE] flex items-center gap-2 flex-wrap" style={{background: "#F6F4F0"}}>
        <UsersThree size={20} weight="duotone" style={{color: "#7A8A6A"}}/>
        <span className="font-bold mr-2">All Therapists ·</span>
        {DAYS_EN.map((d, i) => (
          <button key={i} onClick={() => setMasterDay(i)}
                  className={`pill px-4 py-1.5 text-sm transition ${masterDay === i ? "bg-[#7A8A6A] text-white" : "bg-white border border-[#E8E4DE]"}`}>
            {d} <span className="opacity-60 text-[10px]">{addDays(weekStart, i).getDate()}/{addDays(weekStart, i).getMonth()+1}</span>
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{minWidth: 1300}}>
          <thead>
            <tr>
              <th className="cell-base text-center font-bold" style={{minWidth: 130, background: "#F6F4F0", color: "#2C3625", position: "sticky", left: 0, zIndex: 2}}>Therapist</th>
              {TIME_SLOTS.map(ts => (
                <th key={ts} className="cell-base text-center font-bold" style={{background: "#F6F4F0", color: "#2C3625"}}>
                  {ts.replace(' AM', 'a').replace(' PM', 'p')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleTherapists.map(t => (
              <tr key={t.id}>
                <td className="cell-base font-bold" style={{background: "#FAFAF7", position: "sticky", left: 0, zIndex: 1}}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center font-bold shrink-0" style={{background: t.color}}>{t.name.replace("Ms. ","").charAt(0)}</div>
                    <span className="text-[12px]">{t.name}</span>
                  </div>
                </td>
                {TIME_SLOTS.map(ts => {
                  const cell = cellMap[`${t.id}_${masterDay}_${ts}`];
                  const isCovered = coveredSet.has(`${t.id}_${masterDay}_${ts}`);
                  if (isCovered) return null;
                  const sc = SERVICE_CODES.find(s => s.id === cell?.service_code);
                  const dur = cell?.duration || 1;
                  return (
                    <td key={ts} className={`cell-base ${cell ? 'has-event' : 'cell-empty'}`}
                        colSpan={dur}
                        onClick={(e) => handleCellClick(e, t.id, masterDay, ts, cell)}
                        onContextMenu={(e) => onCtx(e, cell)}>
                      {cell && <CellEvent cell={cell} sc={sc}/>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-start flex-wrap gap-3 mb-5">
        <div className="flex-1 min-w-[240px]">
          <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Weekly Schedule</h1>
          <div className="text-sm" style={{color: "#5C6853"}}>{isAdmin ? "Click any cell to add/edit. Right-click for quick actions (cancel/notify/duplicate)." : "Read-only view of all therapists' schedule"}</div>
        </div>
        <div className="flex items-center gap-1.5 card p-1.5">
          <button onClick={() => setView("blocks")} className={`btn ${view==="blocks" ? "btn-primary" : "btn-ghost"} text-xs`}><GridFour size={14}/> Per Therapist</button>
          <button onClick={() => setView("master")} className={`btn ${view==="master" ? "btn-primary" : "btn-ghost"} text-xs`}><UsersThree size={14}/> All Therapists</button>
        </div>
        <div className="flex items-center gap-1.5 card p-1.5">
          <button data-testid="prev-week-btn" onClick={() => setWeekStart(addDays(weekStart, -7))} className="btn btn-ghost p-2"><CaretLeft size={18}/></button>
          <div className="px-3 py-1.5 text-sm font-bold min-w-[160px] text-center" style={{color: "#2C3625"}}>{formatDateRange(weekStart)}</div>
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

      <div className="card p-3 mb-4 flex items-center flex-wrap gap-3 text-xs">
        <div className="font-bold flex items-center gap-1" style={{color: "#5C6853"}}><Info size={14}/> Legend:</div>
        {SERVICE_CODES.slice(0, 7).map(s => (<span key={s.id} className={`pill ${s.cls}`}>{s.short}</span>))}
        <span className="pill" style={{background: "#FCE0E8", color: "#8B3A55", border: "1px solid #E8A4BD"}}>✕ Therapist Cancel</span>
        <span className="pill" style={{background: "#FFF4C4", color: "#6B5218", border: "1px solid #E8C572"}}>✕ Client Cancel</span>
        <span className="ml-auto text-[11px]" style={{color: "#8B9E7A"}}>Each child has a unique color · {clients.length} clients</span>
      </div>

      {isAdmin && view === "blocks" && (
        <div className="relative max-w-sm mb-5">
          <MagnifyingGlass size={18} className="absolute top-3 left-3" style={{color: "#8B9E7A"}}/>
          <input className="input pl-10" placeholder="Search therapist..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
      )}

      <div style={{ zoom: `${zoom}%` }}>
        {view === "master" ? renderMaster() : (
          <div className="space-y-6 stagger">
            {visibleTherapists.length === 0 && <div className="card p-12 text-center" style={{color: "#8B9E7A"}}>No therapists found</div>}
            {visibleTherapists.map((t, i) => renderTherapistBlock(t, i))}
          </div>
        )}
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
                        className={`pill ${s.cls} justify-center py-2 ${edit.service_code === s.id ? "ring-2 ring-[#7A8A6A]" : ""}`}>{s.short}</button>
              ))}
            </div>

            {!["LEAVE","BREAK","AVC"].includes(edit.service_code) && (
              <>
                <label className="label">Child / Subject</label>
                <input data-testid="cell-child-input" className="input mb-3" list="clients-list" value={edit.child_name || ""} onChange={e => setEdit({...edit, child_name: e.target.value, color: null})} placeholder="Child name"/>
                <datalist id="clients-list">{clients.map(c => <option key={c.id} value={c.name}/>)}</datalist>
                {edit.child_name && (
                  <div className="text-xs flex items-center gap-2 mb-3" style={{color: "#5C6853"}}>
                    Auto-color: <span className="w-5 h-5 rounded border border-[#E8E4DE] inline-block" style={{background: edit.color || getChildColor(edit.child_name) || "#E5EBE1"}}/>
                    <button type="button" onClick={() => setEdit({...edit, color: null})} className="text-[11px] underline">use child default</button>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Custom Time</label>
                <input className="input" placeholder="2:30-4:30" value={edit.custom_time || ""} onChange={e=>setEdit({...edit, custom_time: e.target.value})}/>
              </div>
              <div>
                <label className="label">Duration (slots)</label>
                <select className="select" value={edit.duration || 1} onChange={e=>setEdit({...edit, duration: parseInt(e.target.value)})}>
                  <option value={1}>1 slot (1 hour)</option>
                  <option value={2}>2 slots (merge 2 hours)</option>
                  <option value={3}>3 slots (merge 3 hours)</option>
                  <option value={4}>4 slots (merge 4 hours)</option>
                </select>
              </div>
            </div>
            <label className="label">Note</label>
            <input className="input mb-3" value={edit.note || ""} onChange={e=>setEdit({...edit, note: e.target.value})}/>

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

      {ctxMenu && (
        <div className="fixed card p-1 z-50 min-w-48" style={{ top: ctxMenu.y, left: ctxMenu.x }} onClick={e => e.stopPropagation()}>
          <button onClick={() => { handleCellClick({stopPropagation: () => {}}, ctxMenu.cell.therapist_id, ctxMenu.cell.day, ctxMenu.cell.time_slot, ctxMenu.cell); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-sm">Edit</button>
          <button onClick={() => { duplicate(ctxMenu.cell.id); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-sm"><Copy size={14}/> Duplicate</button>
          <div className="divider my-1"/>
          <button onClick={() => setState(ctxMenu.cell, "cancel_child")} className="btn btn-ghost w-full justify-start text-sm" style={{color: "#8B6918"}}>🟡 Mark Client Cancel</button>
          <button onClick={() => setState(ctxMenu.cell, "cancel_therapist")} className="btn btn-ghost w-full justify-start text-sm" style={{color: "#8B3A55"}}>🩷 Mark Therapist Cancel</button>
          <button onClick={() => setState(ctxMenu.cell, "normal")} className="btn btn-ghost w-full justify-start text-sm">✓ Mark Normal</button>
          <div className="divider my-1"/>
          <button onClick={() => { setNotify({ ...ctxMenu.cell, message: "" }); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-sm"><BellRinging size={14}/> Notify Therapist</button>
          <button onClick={() => { remove(ctxMenu.cell.id); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-sm text-red-700"><Trash size={14}/> Delete</button>
        </div>
      )}

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
