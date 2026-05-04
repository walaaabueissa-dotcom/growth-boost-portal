import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Plus, PencilSimple, Trash, X, ChatCircleText } from "@phosphor-icons/react";

const STATUS_MAP = {
  pending:    { label: "قيد الانتظار", cls: "bg-[#FAF0D1] text-[#6B5218]" },
  in_progress:{ label: "قيد التنفيذ",   cls: "bg-[#EAF0F3] text-[#375568]" },
  approved:   { label: "تمت الموافقة",  cls: "bg-[#E5EBE1] text-[#3D4F35]" },
  rejected:   { label: "مرفوض",         cls: "bg-[#F8EBE7] text-[#8A3F27]" },
  done:       { label: "مكتمل",         cls: "bg-brand text-white" },
};
const TYPES = ["general", "leave", "supplies", "schedule"];
const TYPE_AR = { general: "عام", leave: "إجازة", supplies: "مستلزمات", schedule: "جدول" };

export default function Requests() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [edit, setEdit] = useState(null); // new
  const [statusEdit, setStatusEdit] = useState(null);

  const load = async () => { const { data } = await api.get("/requests"); setItems(data); };
  useEffect(() => { load(); }, []);

  const submitNew = async () => {
    await api.post("/requests", edit); setEdit(null); load();
  };
  const updateStatus = async () => {
    await api.put(`/requests/${statusEdit.id}/status`, { status: statusEdit.status, admin_note: statusEdit.admin_note });
    setStatusEdit(null); load();
  };
  const remove = async (id) => { if (!window.confirm("حذف الطلب؟")) return; await api.delete(`/requests/${id}`); load(); };

  const filtered = items.filter(r => filter === "all" || r.status === filter);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center mb-5 gap-3 flex-wrap">
        <div className="flex-1">
          <h1 className="font-serif-en text-3xl text-ink font-semibold">Requests</h1>
          <div className="text-sm text-ink-soft">{isAdmin ? "إدارة جميع الطلبات" : "طلباتي"}</div>
        </div>
        {!isAdmin && <button data-testid="new-request-btn" onClick={() => setEdit({ title: "", description: "", request_type: "general", priority: "normal" })} className="btn btn-primary"><Plus size={16}/> طلب جديد</button>}
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        <button onClick={() => setFilter("all")} className={`pill ${filter==="all" ? "bg-brand text-white" : "bg-cream-warm text-ink-soft"}`}>الكل ({items.length})</button>
        {Object.entries(STATUS_MAP).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)} className={`pill ${filter===k ? "bg-brand text-white" : v.cls}`}>{v.label} ({items.filter(r=>r.status===k).length})</button>
        ))}
      </div>

      <div className="space-y-3 stagger">
        {filtered.length === 0 && <div className="card p-12 text-center text-ink-mute">لا توجد طلبات</div>}
        {filtered.map(r => {
          const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
          return (
            <div key={r.id} className="card p-5">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`pill ${st.cls}`}>{st.label}</span>
                    <span className="pill bg-cream-warm text-ink-soft">{TYPE_AR[r.request_type] || r.request_type}</span>
                    {r.priority === "urgent" && <span className="pill bg-[#F8EBE7] text-[#8A3F27]">عاجل</span>}
                  </div>
                  <div className="font-bold text-ink text-lg">{r.title}</div>
                  <div className="text-sm text-ink-soft mt-1 whitespace-pre-wrap">{r.description}</div>
                  {isAdmin && r.therapist_name && <div className="text-xs text-ink-mute mt-2">من: <strong>{r.therapist_name}</strong></div>}
                  <div className="text-[11px] text-ink-mute mt-1">{new Date(r.created_at).toLocaleString('ar-SA')}</div>
                  {r.admin_note && (
                    <div className="mt-3 p-3 bg-brand-light rounded-xl border border-[#E8E4DE]">
                      <div className="text-xs font-bold text-brand-dark flex items-center gap-1 mb-1"><ChatCircleText size={14}/> رد الإدارة</div>
                      <div className="text-sm text-ink">{r.admin_note}</div>
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  {isAdmin && <button data-testid={`update-status-${r.id}`} onClick={() => setStatusEdit({...r})} className="btn btn-secondary"><PencilSimple size={16}/> تحديث</button>}
                  <button onClick={() => remove(r.id)} className="btn btn-ghost p-2 text-red-700"><Trash size={16}/></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New request (therapist) */}
      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-lg modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-serif-en text-2xl text-ink">طلب جديد</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <label className="text-sm font-bold text-ink-soft">العنوان</label>
            <input data-testid="req-title" className="input mb-3" value={edit.title} onChange={e=>setEdit({...edit, title: e.target.value})}/>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-sm font-bold text-ink-soft">النوع</label>
                <select className="select" value={edit.request_type} onChange={e=>setEdit({...edit, request_type: e.target.value})}>
                  {TYPES.map(t => <option key={t} value={t}>{TYPE_AR[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-ink-soft">الأولوية</label>
                <select className="select" value={edit.priority} onChange={e=>setEdit({...edit, priority: e.target.value})}>
                  <option value="low">منخفض</option>
                  <option value="normal">عادي</option>
                  <option value="high">مرتفع</option>
                  <option value="urgent">عاجل</option>
                </select>
              </div>
            </div>
            <label className="text-sm font-bold text-ink-soft">التفاصيل</label>
            <textarea data-testid="req-description" className="textarea mb-4" rows={5} value={edit.description} onChange={e=>setEdit({...edit, description: e.target.value})}/>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEdit(null)} className="btn btn-outline">إلغاء</button>
              <button data-testid="req-submit-btn" onClick={submitNew} className="btn btn-primary">إرسال الطلب</button>
            </div>
          </div>
        </div>
      )}

      {/* Update status (admin) */}
      {statusEdit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setStatusEdit(null)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <div className="font-serif-en text-2xl text-ink">تحديث حالة الطلب</div>
              <button onClick={() => setStatusEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <div className="text-sm text-ink-soft mb-3">سيُرسَل إشعار للأخصائية تلقائيًا</div>
            <label className="text-sm font-bold text-ink-soft">الحالة الجديدة</label>
            <select className="select mb-3" value={statusEdit.status} onChange={e=>setStatusEdit({...statusEdit, status: e.target.value})}>
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <label className="text-sm font-bold text-ink-soft">رد/ملاحظة (اختياري)</label>
            <textarea className="textarea mb-4" rows={3} value={statusEdit.admin_note || ""} onChange={e=>setStatusEdit({...statusEdit, admin_note: e.target.value})}/>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStatusEdit(null)} className="btn btn-outline">إلغاء</button>
              <button data-testid="status-save-btn" onClick={updateStatus} className="btn btn-primary">حفظ وإشعار</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
