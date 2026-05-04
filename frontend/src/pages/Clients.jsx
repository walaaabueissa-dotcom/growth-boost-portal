import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Plus, PencilSimple, Trash, X } from "@phosphor-icons/react";

export default function Clients() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [edit, setEdit] = useState(null);

  const load = async () => {
    const { data } = await api.get("/clients"); setItems(data);
    const { data: t } = await api.get("/therapists").catch(() => ({ data: [] })); setTherapists(t);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const payload = { ...edit };
    if (edit.id) await api.put(`/clients/${edit.id}`, payload);
    else await api.post("/clients", payload);
    setEdit(null); load();
  };
  const remove = async (id) => { if (!window.confirm("حذف العميل وكل ملفاته؟")) return; await api.delete(`/clients/${id}`); load(); };
  const findT = id => therapists.find(t => t.id === id);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center mb-5 gap-3">
        <div className="flex-1">
          <h1 className="font-serif-en text-3xl text-ink font-semibold">Clients</h1>
          <div className="text-sm text-ink-soft">قائمة الأطفال المسجّلين</div>
        </div>
        {isAdmin && <button data-testid="add-client-btn" onClick={() => setEdit({ name: "", package: "", therapist_id: "" })} className="btn btn-primary"><Plus size={16}/> طفل جديد</button>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {items.length === 0 && <div className="card p-12 text-center text-ink-mute col-span-full">لا يوجد عملاء بعد</div>}
        {items.map(c => (
          <div key={c.id} className="card p-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-light text-brand-dark flex items-center justify-center text-xl font-bold">
                {c.name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-ink truncate">{c.name}</div>
                <div className="text-xs text-ink-mute">{c.package || "—"}</div>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <button onClick={() => setEdit({...c})} className="btn btn-ghost p-2"><PencilSimple size={16}/></button>
                  <button onClick={() => remove(c.id)} className="btn btn-ghost p-2 text-red-700"><Trash size={16}/></button>
                </div>
              )}
            </div>
            <div className="mt-3 text-sm space-y-1">
              {c.parent_name && <div className="text-ink-soft">👨‍👩‍👧 {c.parent_name}</div>}
              {c.parent_phone && <div className="text-ink-soft">📞 {c.parent_phone}</div>}
              {c.therapist_id && <div className="text-ink-soft">👩‍⚕️ {findT(c.therapist_id)?.name || "—"}</div>}
              {c.age && <div className="text-ink-soft">🎂 {c.age}</div>}
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-lg modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-serif-en text-2xl text-ink">{edit.id ? "تعديل" : "إضافة طفل"}</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-bold text-ink-soft">الاسم</label>
                <input data-testid="client-name-input" className="input" required value={edit.name} onChange={e=>setEdit({...edit, name: e.target.value})}/>
              </div>
              <div>
                <label className="text-sm font-bold text-ink-soft">العمر</label>
                <input className="input" value={edit.age || ""} onChange={e=>setEdit({...edit, age: e.target.value})}/>
              </div>
              <div>
                <label className="text-sm font-bold text-ink-soft">الباقة</label>
                <input className="input" value={edit.package || ""} onChange={e=>setEdit({...edit, package: e.target.value})}/>
              </div>
              <div>
                <label className="text-sm font-bold text-ink-soft">ولي الأمر</label>
                <input className="input" value={edit.parent_name || ""} onChange={e=>setEdit({...edit, parent_name: e.target.value})}/>
              </div>
              <div>
                <label className="text-sm font-bold text-ink-soft">الجوال</label>
                <input className="input" value={edit.parent_phone || ""} onChange={e=>setEdit({...edit, parent_phone: e.target.value})}/>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-bold text-ink-soft">الأخصائية المسؤولة</label>
                <select className="select" value={edit.therapist_id || ""} onChange={e=>setEdit({...edit, therapist_id: e.target.value || null})}>
                  <option value="">— بدون —</option>
                  {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-bold text-ink-soft">ملاحظات</label>
                <textarea className="textarea" rows={2} value={edit.notes || ""} onChange={e=>setEdit({...edit, notes: e.target.value})}/>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEdit(null)} className="btn btn-outline">إلغاء</button>
              <button data-testid="client-save-btn" onClick={save} className="btn btn-primary">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
