import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { DAYS_AR, MONTHS_AR, startOfWeek, addDays, toISODate } from "../api";
import {
  CaretLeft, CaretRight, Plus, PencilSimple, Trash, Copy, BellRinging, X
} from "@phosphor-icons/react";

const TIMES = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00"];
const COLORS = [
  { id: "green", label: "أخضر", cls: "evt-green" },
  { id: "blue",  label: "أزرق",  cls: "evt-blue" },
  { id: "yellow",label: "أصفر", cls: "evt-yellow" },
  { id: "red",   label: "أحمر",  cls: "evt-red" },
  { id: "purple",label: "بنفسجي", cls: "evt-purple" },
];

export default function Schedule() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [cells, setCells] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [edit, setEdit] = useState(null); // {day, time_slot, ...} or existing cell
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, cell }
  const [notify, setNotify] = useState(null); // cell to notify

  const weekStartISO = toISODate(weekStart);

  const load = async () => {
    const [c, t] = await Promise.all([
      api.get("/schedule", { params: { week_start: weekStartISO } }),
      api.get("/therapists").catch(() => ({ data: [] })),
    ]);
    setCells(c.data); setTherapists(t.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [weekStartISO]);

  useEffect(() => {
    const close = () => setCtxMenu(null);
    if (ctxMenu) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [ctxMenu]);

  const cellsByKey = useMemo(() => {
    const m = {};
    cells.forEach(c => { m[`${c.day}_${c.time_slot}`] = c; });
    return m;
  }, [cells]);

  const findTherapist = (id) => therapists.find(t => t.id === id);

  const openCell = (day, time_slot) => {
    if (!isAdmin) return;
    const existing = cellsByKey[`${day}_${time_slot}`];
    setEdit(existing ? { ...existing } : { day, time_slot, color: "green", week_start: weekStartISO, duration: 1 });
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

  return (
    <div className="max-w-[1500px] mx-auto">
      {/* header */}
      <div className="flex items-center flex-wrap gap-3 mb-5">
        <div>
          <h1 className="font-serif-en text-3xl text-ink font-semibold">Weekly Schedule</h1>
          <div className="text-sm text-ink-soft">الجدول الأسبوعي · {isAdmin ? "اضغطي على أي خانة لإضافة جلسة" : "عرض الجلسات الخاصة بك"}</div>
        </div>
        <div className="flex-1"/>
        <button data-testid="prev-week-btn" onClick={() => setWeekStart(addDays(weekStart, -7))} className="btn btn-outline"><CaretRight size={16}/></button>
        <div className="px-4 py-2 rounded-xl bg-cream-warm font-bold text-ink min-w-44 text-center">
          {toISODate(weekStart)} → {toISODate(addDays(weekStart, 6))}
        </div>
        <button data-testid="next-week-btn" onClick={() => setWeekStart(addDays(weekStart, 7))} className="btn btn-outline"><CaretLeft size={16}/></button>
        <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="btn btn-secondary">هذا الأسبوع</button>
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        {COLORS.map(c => (<span key={c.id} className={`pill ${c.cls}`}>{c.label}</span>))}
      </div>

      <div className="overflow-x-auto card p-0">
        <div className="sched-grid" style={{"--days": 7}}>
          <div className="sched-header"></div>
          {DAYS_AR.map((d, i) => {
            const date = addDays(weekStart, i);
            return (
              <div key={i} className="sched-header">
                <div>{d}</div>
                <div className="text-xs font-normal text-ink-mute">{date.getDate()} {MONTHS_AR[date.getMonth()]}</div>
              </div>
            );
          })}
          {TIMES.map(t => (
            <>
              <div key={`tk-${t}`} className="sched-time">{t}</div>
              {DAYS_AR.map((_, di) => {
                const cell = cellsByKey[`${di}_${t}`];
                const colorCls = cell ? COLORS.find(c => c.id === cell.color)?.cls || "evt-green" : "";
                const therapist = cell?.therapist_id && findTherapist(cell.therapist_id);
                return (
                  <div key={`c-${di}-${t}`} data-testid={`cell-${di}-${t}`}
                       className={`sched-cell ${cell ? "has-event" : ""}`}
                       onClick={() => !cell && openCell(di, t)}
                       onContextMenu={(e) => onCtx(e, cell)}>
                    {cell ? (
                      <div className={`sched-event ${colorCls}`} onClick={(e) => { e.stopPropagation(); openCell(di, t); }}>
                        <div className="font-bold truncate">{cell.child_name || cell.title || "—"}</div>
                        {therapist && <div className="text-[10px] opacity-80 truncate">👩‍⚕️ {therapist.name}</div>}
                        {cell.note && <div className="text-[10px] opacity-70 truncate">{cell.note}</div>}
                      </div>
                    ) : (
                      isAdmin && <div className="opacity-0 hover:opacity-100 transition flex items-center justify-center h-full text-ink-mute"><Plus size={16}/></div>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>

      <div className="text-xs text-ink-mute mt-3">
        💡 {isAdmin ? "كليك يمين على أي خانة لنسخها أو حذفها أو إرسال تنبيه للأخصائية" : "ستظهر إشعارات على الجدول مباشرة"}
      </div>

      {/* Edit Modal */}
      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-lg modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-serif-en text-2xl text-ink">{edit.id ? "تعديل جلسة" : "إضافة جلسة"}</div>
                <div className="text-sm text-ink-soft">{DAYS_AR[edit.day]} · {edit.time_slot}</div>
              </div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <label className="block text-sm font-bold text-ink-soft mb-1">اسم الطفل / العنوان</label>
            <input data-testid="cell-child-input" className="input mb-3" value={edit.child_name || ""} onChange={e => setEdit({...edit, child_name: e.target.value})} placeholder="مثال: أحمد"/>
            <label className="block text-sm font-bold text-ink-soft mb-1">الأخصائية</label>
            <select data-testid="cell-therapist-select" className="select mb-3" value={edit.therapist_id || ""} onChange={e => setEdit({...edit, therapist_id: e.target.value || null})}>
              <option value="">— بدون —</option>
              {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label className="block text-sm font-bold text-ink-soft mb-1">ملاحظة (اختياري)</label>
            <input className="input mb-3" value={edit.note || ""} onChange={e => setEdit({...edit, note: e.target.value})}/>
            <label className="block text-sm font-bold text-ink-soft mb-2">اللون</label>
            <div className="flex gap-2 mb-4 flex-wrap">
              {COLORS.map(c => (
                <button key={c.id} onClick={() => setEdit({...edit, color: c.id})}
                        className={`pill ${c.cls} ${edit.color === c.id ? "ring-2 ring-brand" : ""}`}>{c.label}</button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              {edit.id && <button data-testid="cell-delete-btn" onClick={() => { remove(edit.id); setEdit(null); }} className="btn btn-danger"><Trash size={16}/> حذف</button>}
              {edit.id && <button onClick={() => { duplicate(edit.id); setEdit(null); }} className="btn btn-secondary"><Copy size={16}/> نسخ</button>}
              <button onClick={() => setEdit(null)} className="btn btn-outline">إلغاء</button>
              <button data-testid="cell-save-btn" onClick={save} className="btn btn-primary">حفظ</button>
            </div>
          </div>
        </div>
      )}

      {/* Right-click context menu */}
      {ctxMenu && (
        <div className="fixed card p-1 z-50 min-w-44" style={{ top: ctxMenu.y, left: ctxMenu.x }} onClick={e => e.stopPropagation()}>
          <button onClick={() => { openCell(ctxMenu.cell.day, ctxMenu.cell.time_slot); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start"><PencilSimple size={16}/> تعديل</button>
          <button onClick={() => { duplicate(ctxMenu.cell.id); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start"><Copy size={16}/> نسخ الخانة</button>
          <button onClick={() => { setNotify({ ...ctxMenu.cell, message: "" }); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start"><BellRinging size={16}/> تنبيه الأخصائية</button>
          <button onClick={() => { remove(ctxMenu.cell.id); setCtxMenu(null); }} className="btn btn-ghost w-full justify-start text-red-700"><Trash size={16}/> حذف</button>
        </div>
      )}

      {/* Notify modal */}
      {notify && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setNotify(null)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e=>e.stopPropagation()}>
            <div className="font-serif-en text-2xl text-ink mb-2">إرسال تنبيه</div>
            <div className="text-sm text-ink-soft mb-3">سيظهر التنبيه فورًا في حساب الأخصائية</div>
            <textarea data-testid="notify-message" className="textarea mb-3" rows={4} placeholder="نص التنبيه..."
                      value={notify.message} onChange={e => setNotify({...notify, message: e.target.value})}/>
            <div className="flex justify-end gap-2">
              <button onClick={() => setNotify(null)} className="btn btn-outline">إلغاء</button>
              <button data-testid="notify-send-btn" onClick={sendNotify} className="btn btn-primary"><BellRinging size={16}/> إرسال</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
