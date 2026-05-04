import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Plus, X, Trash, Phone, Envelope } from "@phosphor-icons/react";

export default function Directory() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);

  const load = async () => { const { data } = await api.get("/directory"); setItems(data); };
  useEffect(() => { load(); }, []);
  const save = async () => { await api.post("/directory", edit); setEdit(null); load(); };
  const remove = async (id) => { await api.delete(`/directory/${id}`); load(); };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center mb-5">
        <div className="flex-1">
          <h1 className="font-serif-en text-3xl text-ink font-semibold">Directory</h1>
          <div className="text-sm text-ink-soft">دليل جهات الاتصال</div>
        </div>
        {isAdmin && <button onClick={() => setEdit({ name: "", role: "", phone: "", email: "" })} className="btn btn-primary"><Plus size={16}/> جهة اتصال</button>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {items.length === 0 && <div className="card p-12 text-center text-ink-mute col-span-full">لا توجد جهات اتصال</div>}
        {items.map(c => (
          <div key={c.id} className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gold/30 flex items-center justify-center font-bold text-ink text-lg">{c.name?.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-ink truncate">{c.name}</div>
                <div className="text-xs text-ink-mute">{c.role || "—"}</div>
              </div>
              {isAdmin && <button onClick={() => remove(c.id)} className="btn btn-ghost p-2 text-red-700"><Trash size={16}/></button>}
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-ink-soft hover:text-brand"><Phone size={16}/> {c.phone}</a>}
              {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-ink-soft hover:text-brand"><Envelope size={16}/> {c.email}</a>}
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-serif-en text-2xl">جهة اتصال جديدة</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <input className="input mb-2" placeholder="الاسم" value={edit.name} onChange={e=>setEdit({...edit, name: e.target.value})}/>
            <input className="input mb-2" placeholder="الدور / المنصب" value={edit.role} onChange={e=>setEdit({...edit, role: e.target.value})}/>
            <input className="input mb-2" placeholder="الجوال" value={edit.phone} onChange={e=>setEdit({...edit, phone: e.target.value})}/>
            <input className="input mb-4" placeholder="البريد" value={edit.email} onChange={e=>setEdit({...edit, email: e.target.value})}/>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEdit(null)} className="btn btn-outline">إلغاء</button>
              <button onClick={save} className="btn btn-primary">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
