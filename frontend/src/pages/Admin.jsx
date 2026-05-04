import { useEffect, useState } from "react";
import api from "../api";
import { Plus, PencilSimple, Trash, X, UserPlus, Key } from "@phosphor-icons/react";

export default function Admin() {
  const [therapists, setTherapists] = useState([]);
  const [edit, setEdit] = useState(null);

  const load = async () => { const { data } = await api.get("/therapists"); setTherapists(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (edit.id) {
      const payload = { name: edit.name, color: edit.color, email: edit.email, phone: edit.phone };
      if (edit.pin) payload.pin = edit.pin;
      await api.put(`/therapists/${edit.id}`, payload);
    } else {
      await api.post("/therapists", { name: edit.name, color: edit.color, pin: edit.pin || "0000", email: edit.email, phone: edit.phone });
    }
    setEdit(null); load();
  };
  const remove = async (id) => { if (!window.confirm("Delete therapist?")) return; await api.delete(`/therapists/${id}`); load(); };

  return (
    <div>
      <div className="flex items-center mb-5">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Admin Panel</h1>
          <div className="text-sm" style={{color: "#5C6853"}}>Therapists & system settings</div>
        </div>
        <button data-testid="add-therapist-btn" onClick={() => setEdit({ name: "", color: "#7A8A6A", pin: "0000" })} className="btn btn-primary"><UserPlus size={16}/> New Therapist</button>
      </div>

      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold" style={{color: "#2C3625"}}>Therapists ({therapists.length})</div>
          <div className="text-xs flex items-center gap-1" style={{color: "#8B9E7A"}}><Key size={12}/> Default PIN: 0000</div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
          {therapists.map(t => (
            <div key={t.id} className="p-4 rounded-xl border flex items-center gap-3" style={{borderColor: "#E8E4DE"}}>
              <div className="w-11 h-11 rounded-full text-white font-bold flex items-center justify-center shrink-0" style={{background: t.color}}>{t.name?.replace("Ms. ", "").charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate" style={{color: "#2C3625"}}>{t.name}</div>
                <div className="text-xs truncate" style={{color: "#8B9E7A"}}>{t.email || t.phone || "—"}</div>
              </div>
              <button onClick={() => setEdit({...t, pin: ""})} className="btn btn-ghost p-2"><PencilSimple size={16}/></button>
              <button onClick={() => remove(t.id)} className="btn btn-ghost p-2 text-red-700"><Trash size={16}/></button>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="font-bold mb-3" style={{color: "#2C3625"}}>Quick Admin Links</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <a href="https://docs.google.com/spreadsheets/d/1D2DQX0M4ieeKz4Z7c-QdO67XbDl1llnlXolLOrDXopk" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">📊 Master Sheet</a>
          <a href="https://drive.google.com/drive/folders/1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">📁 Client Files</a>
          <a href="https://boost-growthsa.com" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">🌱 Website</a>
          <a href="https://app.netlify.com/" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">🌐 Netlify</a>
        </div>
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-display text-2xl">{edit.id ? "Edit Therapist" : "New Therapist"}</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <label className="label">Name</label>
            <input data-testid="therapist-name-input" className="input mb-2" placeholder="Ms. Sarah" value={edit.name} onChange={e=>setEdit({...edit, name: e.target.value})}/>
            <label className="label">Email (optional)</label>
            <input className="input mb-2" type="email" value={edit.email || ""} onChange={e=>setEdit({...edit, email: e.target.value})}/>
            <label className="label">Phone (optional)</label>
            <input className="input mb-2" value={edit.phone || ""} onChange={e=>setEdit({...edit, phone: e.target.value})}/>
            <label className="label">Color</label>
            <div className="flex items-center gap-3 mb-2">
              <input type="color" value={edit.color} onChange={e=>setEdit({...edit, color: e.target.value})} className="w-12 h-10 rounded-lg border border-[#E8E4DE]"/>
              <span className="text-xs" style={{color: "#8B9E7A"}}>{edit.color}</span>
            </div>
            <label className="label">PIN (4-6 digits)</label>
            <input data-testid="therapist-pin-input" className="input mb-4" type="password" placeholder={edit.id ? "Leave empty to keep current" : "0000"} value={edit.pin} onChange={e=>setEdit({...edit, pin: e.target.value})}/>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEdit(null)} className="btn btn-outline">Cancel</button>
              <button data-testid="therapist-save-btn" onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
