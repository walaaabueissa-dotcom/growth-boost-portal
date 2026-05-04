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
    <div>
      <div className="flex items-center mb-5">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Directory</h1>
          <div className="text-sm" style={{color: "#5C6853"}}>Internal contacts</div>
        </div>
        {isAdmin && <button onClick={() => setEdit({ name: "", role: "", phone: "", email: "" })} className="btn btn-primary"><Plus size={16}/> New Contact</button>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {items.length === 0 && <div className="card p-12 text-center col-span-full" style={{color: "#8B9E7A"}}>No contacts yet</div>}
        {items.map(c => (
          <div key={c.id} className="card card-hover p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg" style={{background: "rgba(212,166,74,0.3)", color: "#2C3625"}}>{c.name?.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate" style={{color: "#2C3625"}}>{c.name}</div>
                <div className="text-xs" style={{color: "#8B9E7A"}}>{c.role || "—"}</div>
              </div>
              {isAdmin && <button onClick={() => remove(c.id)} className="btn btn-ghost p-2 text-red-700"><Trash size={16}/></button>}
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-2 hover:text-[#7A8A6A]" style={{color: "#5C6853"}}><Phone size={16}/> {c.phone}</a>}
              {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 hover:text-[#7A8A6A]" style={{color: "#5C6853"}}><Envelope size={16}/> {c.email}</a>}
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-md modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-display text-2xl">New Contact</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <input className="input mb-2" placeholder="Name" value={edit.name} onChange={e=>setEdit({...edit, name: e.target.value})}/>
            <input className="input mb-2" placeholder="Role / Title" value={edit.role} onChange={e=>setEdit({...edit, role: e.target.value})}/>
            <input className="input mb-2" placeholder="Phone" value={edit.phone} onChange={e=>setEdit({...edit, phone: e.target.value})}/>
            <input className="input mb-4" placeholder="Email" value={edit.email} onChange={e=>setEdit({...edit, email: e.target.value})}/>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEdit(null)} className="btn btn-outline">Cancel</button>
              <button onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
