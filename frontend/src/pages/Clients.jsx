import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Plus, PencilSimple, Trash, X, MagnifyingGlass } from "@phosphor-icons/react";

const SERVICE_OPTIONS = [
  { id: "SS", label: "School Support" },
  { id: "HS", label: "Home Session" },
  { id: "OS", label: "Outdoor Session" },
];

export default function Clients() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [edit, setEdit] = useState(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    const { data } = await api.get("/clients"); setItems(data);
    const { data: t } = await api.get("/therapists").catch(() => ({ data: [] })); setTherapists(t);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (edit.id) await api.put(`/clients/${edit.id}`, edit);
    else await api.post("/clients", edit);
    setEdit(null); load();
  };
  const remove = async (id) => { if (!window.confirm("Delete client and all their files?")) return; await api.delete(`/clients/${id}`); load(); };
  const findT = id => therapists.find(t => t.id === id);

  const filtered = items.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center mb-5 gap-3 flex-wrap">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Clients</h1>
          <div className="text-sm" style={{color: "#5C6853"}}>Children portfolio · {items.length} total</div>
        </div>
        <div className="relative">
          <MagnifyingGlass size={18} className="absolute top-3 left-3" style={{color: "#8B9E7A"}}/>
          <input className="input pl-10 max-w-sm" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {isAdmin && <button data-testid="add-client-btn" onClick={() => setEdit({ name: "", package: "", therapist_id: "", service_type: "" })} className="btn btn-primary"><Plus size={16}/> New Child</button>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger">
        {filtered.length === 0 && <div className="card p-12 text-center col-span-full" style={{color: "#8B9E7A"}}>No clients</div>}
        {filtered.map(c => (
          <div key={c.id} className="card card-hover p-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shrink-0" style={{background: "#E5EBE1", color: "#3D4F35"}}>
                {c.name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate" style={{color: "#2C3625"}}>{c.name}</div>
                <div className="text-xs" style={{color: "#8B9E7A"}}>{c.service_type || c.package || "—"}</div>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <button onClick={() => setEdit({...c})} className="btn btn-ghost p-2"><PencilSimple size={16}/></button>
                  <button onClick={() => remove(c.id)} className="btn btn-ghost p-2 text-red-700"><Trash size={16}/></button>
                </div>
              )}
            </div>
            <div className="mt-3 text-sm space-y-1">
              {c.parent_name && <div style={{color: "#5C6853"}}>👨‍👩‍👧 {c.parent_name}</div>}
              {c.parent_phone && <div style={{color: "#5C6853"}}>📞 {c.parent_phone}</div>}
              {c.therapist_id && <div style={{color: "#5C6853"}}>👩‍⚕️ {findT(c.therapist_id)?.name || "—"}</div>}
              {c.age && <div style={{color: "#5C6853"}}>🎂 {c.age}</div>}
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-lg modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-display text-2xl">{edit.id ? "Edit Client" : "New Client"}</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Name</label>
                <input data-testid="client-name-input" className="input" required value={edit.name} onChange={e=>setEdit({...edit, name: e.target.value})}/>
              </div>
              <div>
                <label className="label">Age</label>
                <input className="input" value={edit.age || ""} onChange={e=>setEdit({...edit, age: e.target.value})}/>
              </div>
              <div>
                <label className="label">Package</label>
                <input className="input" value={edit.package || ""} onChange={e=>setEdit({...edit, package: e.target.value})}/>
              </div>
              <div>
                <label className="label">Service Type</label>
                <select className="select" value={edit.service_type || ""} onChange={e=>setEdit({...edit, service_type: e.target.value})}>
                  <option value="">—</option>
                  {SERVICE_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.id} · {s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Therapist</label>
                <select className="select" value={edit.therapist_id || ""} onChange={e=>setEdit({...edit, therapist_id: e.target.value || null})}>
                  <option value="">— None —</option>
                  {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Parent Name</label>
                <input className="input" value={edit.parent_name || ""} onChange={e=>setEdit({...edit, parent_name: e.target.value})}/>
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={edit.parent_phone || ""} onChange={e=>setEdit({...edit, parent_phone: e.target.value})}/>
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea className="textarea" rows={2} value={edit.notes || ""} onChange={e=>setEdit({...edit, notes: e.target.value})}/>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEdit(null)} className="btn btn-outline">Cancel</button>
              <button data-testid="client-save-btn" onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
