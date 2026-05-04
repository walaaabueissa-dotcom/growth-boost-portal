import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Plus, X, Trash, PencilSimple } from "@phosphor-icons/react";

const STATUS = { new: "جديد", contacted: "تم التواصل", scheduled: "محدّد", completed: "مكتمل" };

export default function Intake() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [tab, setTab] = useState("pre"); // pre | post

  const load = async () => { const { data } = await api.get("/intake"); setItems(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (edit.id) await api.put(`/intake/${edit.id}`, edit);
    else await api.post("/intake", edit);
    setEdit(null); load();
  };
  const remove = async (id) => { if (!window.confirm("حذف؟")) return; await api.delete(`/intake/${id}`); load(); };

  const filtered = items.filter(i => i.intake_type === tab);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center mb-5 flex-wrap gap-3">
        <div className="flex-1">
          <h1 className="font-serif-en text-3xl text-ink font-semibold">Intake List</h1>
          <div className="text-sm text-ink-soft">قائمة الانتيك (قبل / بعد)</div>
        </div>
        {isAdmin && (
          <>
            <button data-testid="add-pre-intake" onClick={() => setEdit({ child_name: "", parent_name: "", phone: "", intake_type: "pre", status: "new", notes: "" })} className="btn btn-primary"><Plus size={16}/> Pre-Intake</button>
            <button data-testid="add-post-intake" onClick={() => setEdit({ child_name: "", parent_name: "", phone: "", intake_type: "post", status: "new", notes: "" })} className="btn btn-secondary"><Plus size={16}/> Post-Intake</button>
          </>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("pre")} className={`pill px-5 py-2 text-sm ${tab==="pre" ? "bg-brand text-white" : "bg-cream-warm text-ink-soft"}`}>📋 Pre-Intake ({items.filter(i=>i.intake_type==="pre").length})</button>
        <button onClick={() => setTab("post")} className={`pill px-5 py-2 text-sm ${tab==="post" ? "bg-brand text-white" : "bg-cream-warm text-ink-soft"}`}>✅ Post-Intake ({items.filter(i=>i.intake_type==="post").length})</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-warm">
            <tr className="text-ink font-bold">
              <th className="p-3 text-start">الطفل</th>
              <th className="p-3 text-start">ولي الأمر</th>
              <th className="p-3 text-start">الجوال</th>
              <th className="p-3 text-start">الحالة</th>
              <th className="p-3 text-start">التاريخ</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-ink-mute">لا توجد سجلات</td></tr>}
            {filtered.map(i => (
              <tr key={i.id} className="border-t border-[#E8E4DE] hover:bg-brand-light/30">
                <td className="p-3 font-bold text-ink">{i.child_name}</td>
                <td className="p-3 text-ink-soft">{i.parent_name || "—"}</td>
                <td className="p-3 text-ink-soft">{i.phone || "—"}</td>
                <td className="p-3"><span className="pill bg-brand-light text-brand-dark">{STATUS[i.status] || i.status}</span></td>
                <td className="p-3 text-xs text-ink-mute">{new Date(i.created_at).toLocaleDateString('ar-SA')}</td>
                <td className="p-3 text-end whitespace-nowrap">
                  {isAdmin && (
                    <>
                      <button onClick={() => setEdit({...i})} className="btn btn-ghost p-2"><PencilSimple size={16}/></button>
                      <button onClick={() => remove(i.id)} className="btn btn-ghost p-2 text-red-700"><Trash size={16}/></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-lg modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-serif-en text-2xl">{edit.intake_type === "pre" ? "Pre-Intake" : "Post-Intake"}</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="input col-span-2" placeholder="اسم الطفل" value={edit.child_name} onChange={e=>setEdit({...edit, child_name: e.target.value})}/>
              <input className="input" placeholder="ولي الأمر" value={edit.parent_name || ""} onChange={e=>setEdit({...edit, parent_name: e.target.value})}/>
              <input className="input" placeholder="الجوال" value={edit.phone || ""} onChange={e=>setEdit({...edit, phone: e.target.value})}/>
              <select className="select col-span-2" value={edit.status} onChange={e=>setEdit({...edit, status: e.target.value})}>
                {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <textarea className="textarea col-span-2" rows={3} placeholder="ملاحظات" value={edit.notes || ""} onChange={e=>setEdit({...edit, notes: e.target.value})}/>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEdit(null)} className="btn btn-outline">إلغاء</button>
              <button onClick={save} className="btn btn-primary">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
