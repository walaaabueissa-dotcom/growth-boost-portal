import { useEffect, useState } from "react";
import api from "../api";
import { Plus, PencilSimple, Trash, X, UserPlus } from "@phosphor-icons/react";

export default function Admin() {
  const [therapists, setTherapists] = useState([]);
  const [edit, setEdit] = useState(null); // {name, color, pin, ...}

  const load = async () => { const { data } = await api.get("/therapists"); setTherapists(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (edit.id) {
      const payload = { name: edit.name, color: edit.color, email: edit.email, phone: edit.phone };
      if (edit.pin) payload.pin = edit.pin;
      await api.put(`/therapists/${edit.id}`, payload);
    } else {
      await api.post("/therapists", { name: edit.name, color: edit.color, pin: edit.pin, email: edit.email, phone: edit.phone });
    }
    setEdit(null); load();
  };
  const remove = async (id) => { if (!window.confirm("حذف الأخصائية؟")) return; await api.delete(`/therapists/${id}`); load(); };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center mb-5">
        <div className="flex-1">
          <h1 className="font-serif-en text-3xl text-ink font-semibold">Admin Panel</h1>
          <div className="text-sm text-ink-soft">إدارة الأخصائيات والإعدادات</div>
        </div>
        <button data-testid="add-therapist-btn" onClick={() => setEdit({ name: "", color: "#7A8A6A", pin: "" })} className="btn btn-primary"><UserPlus size={16}/> أخصائية جديدة</button>
      </div>

      <div className="card p-5 mb-5">
        <div className="font-bold text-ink mb-3">الأخصائيات ({therapists.length})</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {therapists.map(t => (
            <div key={t.id} className="p-4 rounded-xl border border-[#E8E4DE] flex items-center gap-3">
              <div className="w-11 h-11 rounded-full text-white font-bold flex items-center justify-center" style={{background: t.color}}>{t.name?.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-ink truncate">{t.name}</div>
                <div className="text-xs text-ink-mute truncate">{t.email || t.phone || "—"}</div>
              </div>
              <button onClick={() => setEdit({...t, pin: ""})} className="btn btn-ghost p-2"><PencilSimple size={16}/></button>
              <button onClick={() => remove(t.id)} className="btn btn-ghost p-2 text-red-700"><Trash size={16}/></button>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="font-bold text-ink mb-3">الروابط الإدارية السريعة</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">🔥 Firebase</a>
          <a href="https://app.netlify.com/" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">🌐 Netlify</a>
          <a href="https://docs.google.com/spreadsheets/d/1D2DQX0M4ieeKz4Z7c-QdO67XbDl1llnlXolLOrDXopk" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">📊 Master Sheet</a>
          <a href="https://drive.google.com/drive/folders/1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">📁 Client Files</a>
        </div>
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-serif-en text-2xl">{edit.id ? "تعديل أخصائية" : "أخصائية جديدة"}</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <input data-testid="therapist-name-input" className="input mb-2" placeholder="الاسم" value={edit.name} onChange={e=>setEdit({...edit, name: e.target.value})}/>
            <input className="input mb-2" placeholder="البريد (اختياري)" value={edit.email || ""} onChange={e=>setEdit({...edit, email: e.target.value})}/>
            <input className="input mb-2" placeholder="الجوال (اختياري)" value={edit.phone || ""} onChange={e=>setEdit({...edit, phone: e.target.value})}/>
            <div className="flex items-center gap-3 mb-2">
              <label className="text-sm font-bold text-ink-soft">اللون:</label>
              <input type="color" value={edit.color} onChange={e=>setEdit({...edit, color: e.target.value})} className="w-12 h-10 rounded-lg border border-[#E8E4DE]"/>
              <span className="text-xs text-ink-mute">{edit.color}</span>
            </div>
            <input data-testid="therapist-pin-input" className="input mb-4" type="password" placeholder={edit.id ? "PIN جديد (اتركيه فارغًا للإبقاء على الحالي)" : "PIN (4-6 أرقام)"} value={edit.pin} onChange={e=>setEdit({...edit, pin: e.target.value})}/>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEdit(null)} className="btn btn-outline">إلغاء</button>
              <button data-testid="therapist-save-btn" onClick={save} className="btn btn-primary">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
