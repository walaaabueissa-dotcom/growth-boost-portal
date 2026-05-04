import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Plus, PencilSimple, Trash, X, MagnifyingGlass, MapPin, User, Phone, Hash } from "@phosphor-icons/react";

export default function Clients() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [edit, setEdit] = useState(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    const [c, t] = await Promise.all([api.get("/clients"), api.get("/therapists").catch(() => ({data:[]}))]);
    setItems(c.data); setTherapists(t.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (edit.id) await api.put(`/clients/${edit.id}`, edit);
    else await api.post("/clients", edit);
    setEdit(null); load();
  };
  const remove = async (id) => { if (!window.confirm("Delete client and all their files?")) return; await api.delete(`/clients/${id}`); load(); };
  const findT = id => therapists.find(t => t.id === id);

  const filtered = items.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.file_no || "").includes(search)
  );

  return (
    <div>
      <div className="flex items-center mb-5 gap-3 flex-wrap">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Clients</h1>
          <div className="text-sm" style={{color: "#5C6853"}}>{items.length} clients · all profile information</div>
        </div>
        <div className="relative">
          <MagnifyingGlass size={18} className="absolute top-3 left-3" style={{color: "#8B9E7A"}}/>
          <input className="input pl-10 max-w-sm" placeholder="Search by name or file #..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {isAdmin && <button data-testid="add-client-btn" onClick={() => setEdit({ name: "", file_no: "", package_hours: 24, color: "#A2C4C9", main_therapist_id: "", co_therapist_ids: [], locations: [] })} className="btn btn-primary"><Plus size={16}/> New Child</button>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {filtered.length === 0 && <div className="card p-12 text-center col-span-full" style={{color: "#8B9E7A"}}>No clients</div>}
        {filtered.map(c => (
          <div key={c.id} className="card card-hover p-0 overflow-hidden">
            <div className="h-2" style={{background: c.color || "#7A8A6A"}}/>
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold shrink-0" style={{background: c.color || "#E5EBE1", color: "#2C3625"}}>
                  {c.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg truncate" style={{color: "#2C3625"}}>{c.name}</div>
                  <div className="text-xs flex items-center gap-1" style={{color: "#8B9E7A"}}><Hash size={10}/>{c.file_no || "—"} · Pkg {c.package_hours || 24}h</div>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setEdit({...c, co_therapist_ids: c.co_therapist_ids || [], locations: c.locations || []})} className="btn btn-ghost p-1.5"><PencilSimple size={14}/></button>
                    <button onClick={() => remove(c.id)} className="btn btn-ghost p-1.5 text-red-700"><Trash size={14}/></button>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-1.5 text-xs">
                {c.supervisor && <div style={{color: "#5C6853"}}><User size={12} className="inline mr-1.5"/><strong>Supervisor:</strong> {c.supervisor}</div>}
                {c.main_therapist_id && <div style={{color: "#5C6853"}}><User size={12} className="inline mr-1.5"/><strong>Main:</strong> {findT(c.main_therapist_id)?.name || "—"}</div>}
                {c.co_therapist_ids?.length > 0 && (
                  <div style={{color: "#5C6853"}}><User size={12} className="inline mr-1.5"/><strong>Co:</strong> {c.co_therapist_ids.map(id => findT(id)?.name?.replace("Ms. ", "")).filter(Boolean).join(", ")}</div>
                )}
                {c.parent_phone && <div style={{color: "#5C6853"}}><Phone size={12} className="inline mr-1.5"/>{c.parent_phone}</div>}
              </div>

              {c.locations?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#F0EDE9] space-y-1.5">
                  {c.locations.map((l, i) => (
                    <div key={i} className="text-xs flex items-start gap-1.5">
                      <span className="pill text-[9px] py-0.5 px-1.5" style={{background: l.service === "SS" ? "#E5EBE1" : "#EAF0F3", color: l.service === "SS" ? "#3D4F35" : "#375568"}}>{l.service}</span>
                      <span style={{color: "#5C6853"}}><MapPin size={11} className="inline mr-0.5"/>{l.address}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="card p-6 w-full max-w-2xl modal-card max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-display text-2xl">{edit.id ? "Edit Client" : "New Client"}</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Full Name</label><input data-testid="client-name-input" className="input" required value={edit.name} onChange={e=>setEdit({...edit, name: e.target.value})}/></div>
              <div><label className="label">File #</label><input className="input" value={edit.file_no || ""} onChange={e=>setEdit({...edit, file_no: e.target.value})} placeholder="009"/></div>
              <div><label className="label">Package (hours)</label><input type="number" className="input" value={edit.package_hours || 24} onChange={e=>setEdit({...edit, package_hours: parseFloat(e.target.value) || 24})}/></div>
              <div>
                <label className="label">Color</label>
                <div className="flex items-center gap-2"><input type="color" value={edit.color || "#A2C4C9"} onChange={e=>setEdit({...edit, color: e.target.value})} className="w-10 h-10 rounded-lg border border-[#E8E4DE]"/><span className="text-xs" style={{color: "#8B9E7A"}}>{edit.color}</span></div>
              </div>
              <div>
                <label className="label">Supervisor</label>
                <input className="input" value={edit.supervisor || ""} onChange={e=>setEdit({...edit, supervisor: e.target.value})}/>
              </div>
              <div>
                <label className="label">Age</label>
                <input className="input" value={edit.age || ""} onChange={e=>setEdit({...edit, age: e.target.value})}/>
              </div>
              <div>
                <label className="label">Parent Name</label>
                <input className="input" value={edit.parent_name || ""} onChange={e=>setEdit({...edit, parent_name: e.target.value})}/>
              </div>
              <div>
                <label className="label">Parent Phone</label>
                <input className="input" value={edit.parent_phone || ""} onChange={e=>setEdit({...edit, parent_phone: e.target.value})}/>
              </div>
              <div className="col-span-2">
                <label className="label">Main Therapist</label>
                <select className="select" value={edit.main_therapist_id || ""} onChange={e=>setEdit({...edit, main_therapist_id: e.target.value || null})}>
                  <option value="">— None —</option>
                  {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Co-Therapists (multi)</label>
                <div className="flex flex-wrap gap-1.5">
                  {therapists.map(t => {
                    const sel = (edit.co_therapist_ids || []).includes(t.id);
                    return (
                      <button key={t.id} type="button" onClick={() => setEdit({...edit, co_therapist_ids: sel ? edit.co_therapist_ids.filter(x=>x!==t.id) : [...(edit.co_therapist_ids||[]), t.id]})}
                              className={`pill text-xs px-2 py-1 ${sel ? "bg-[#7A8A6A] text-white" : "bg-white border border-[#E8E4DE]"}`}>
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="col-span-2">
                <label className="label">Locations (Service + Address)</label>
                <div className="space-y-2">
                  {(edit.locations || []).map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <select className="select w-24" value={l.service} onChange={e => { const ll = [...edit.locations]; ll[i] = {...ll[i], service: e.target.value}; setEdit({...edit, locations: ll}); }}>
                        <option value="HS">HS</option><option value="SS">SS</option><option value="OS">OS</option>
                      </select>
                      <input className="input flex-1" placeholder="Address" value={l.address} onChange={e => { const ll = [...edit.locations]; ll[i] = {...ll[i], address: e.target.value}; setEdit({...edit, locations: ll}); }}/>
                      <button type="button" onClick={() => setEdit({...edit, locations: edit.locations.filter((_,j)=>j!==i)})} className="btn btn-ghost p-2 text-red-700"><Trash size={14}/></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEdit({...edit, locations: [...(edit.locations||[]), {service:"HS", address:""}]})} className="btn btn-outline text-xs"><Plus size={14}/> Add location</button>
                </div>
              </div>
              <div className="col-span-2"><label className="label">Notes</label><textarea className="textarea" rows={2} value={edit.notes || ""} onChange={e=>setEdit({...edit, notes: e.target.value})}/></div>
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
