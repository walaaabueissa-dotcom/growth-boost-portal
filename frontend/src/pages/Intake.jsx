import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Plus, X, Trash, PencilSimple } from "@phosphor-icons/react";

const STATUS = { new: "New", contacted: "Contacted", scheduled: "Scheduled", completed: "Completed" };
const STATUS_COLORS = {
  new: "#A4BCCB", contacted: "#D4A64A", scheduled: "#7A8A6A", completed: "#3D4F35"
};

export default function Intake() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [tab, setTab] = useState("pre");

  const load = async () => { const { data } = await api.get("/intake"); setItems(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (edit.id) await api.put(`/intake/${edit.id}`, edit);
    else await api.post("/intake", edit);
    setEdit(null); load();
  };
  const remove = async (id) => { if (!window.confirm("Delete?")) return; await api.delete(`/intake/${id}`); load(); };

  const filtered = items.filter(i => i.intake_type === tab);

  return (
    <div>
      <div className="flex items-center mb-5 flex-wrap gap-3">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Intake List</h1>
          <div className="text-sm" style={{color: "#5C6853"}}>Pre-Intake & Post-Intake registrations</div>
        </div>
        {isAdmin && (
          <>
            <button data-testid="add-pre-intake" onClick={() => setEdit({ child_name: "", parent_name: "", phone: "", intake_type: "pre", status: "new", notes: "", intake_date: "", age: "" })} className="btn btn-primary"><Plus size={16}/> Pre-Intake</button>
            <button data-testid="add-post-intake" onClick={() => setEdit({ child_name: "", parent_name: "", phone: "", intake_type: "post", status: "new", notes: "", intake_date: "", age: "" })} className="btn btn-secondary"><Plus size={16}/> Post-Intake</button>
          </>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("pre")} className={`pill px-5 py-2.5 text-sm transition-all ${tab==="pre" ? "bg-[#7A8A6A] text-white" : "bg-[#F0E9D8]"}`}>📋 Pre-Intake ({items.filter(i=>i.intake_type==="pre").length})</button>
        <button onClick={() => setTab("post")} className={`pill px-5 py-2.5 text-sm transition-all ${tab==="post" ? "bg-[#7A8A6A] text-white" : "bg-[#F0E9D8]"}`}>✅ Post-Intake ({items.filter(i=>i.intake_type==="post").length})</button>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{background: "#F0E9D8"}}>
            <tr>
              <th className="p-3 text-left font-bold" style={{color: "#2C3625"}}>Child</th>
              <th className="p-3 text-left font-bold" style={{color: "#2C3625"}}>Age</th>
              <th className="p-3 text-left font-bold" style={{color: "#2C3625"}}>Parent</th>
              <th className="p-3 text-left font-bold" style={{color: "#2C3625"}}>Phone</th>
              <th className="p-3 text-left font-bold" style={{color: "#2C3625"}}>Date</th>
              <th className="p-3 text-left font-bold" style={{color: "#2C3625"}}>Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="p-12 text-center" style={{color: "#8B9E7A"}}>No records</td></tr>}
            {filtered.map(i => (
              <tr key={i.id} className="border-t border-[#E8E4DE] hover:bg-[#E5EBE1]/30 transition">
                <td className="p-3 font-bold" style={{color: "#2C3625"}}>{i.child_name}</td>
                <td className="p-3" style={{color: "#5C6853"}}>{i.age || "—"}</td>
                <td className="p-3" style={{color: "#5C6853"}}>{i.parent_name || "—"}</td>
                <td className="p-3" style={{color: "#5C6853"}}>{i.phone || "—"}</td>
                <td className="p-3 text-xs" style={{color: "#8B9E7A"}}>{i.intake_date || new Date(i.created_at).toLocaleDateString('en-US')}</td>
                <td className="p-3"><span className="pill" style={{background: `${STATUS_COLORS[i.status]}25`, color: STATUS_COLORS[i.status]}}>{STATUS[i.status] || i.status}</span></td>
                <td className="p-3 text-right whitespace-nowrap">
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
              <div className="font-display text-2xl">{edit.intake_type === "pre" ? "Pre-Intake" : "Post-Intake"}</div>
              <button onClick={() => setEdit(null)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Child Name</label><input className="input" value={edit.child_name} onChange={e=>setEdit({...edit, child_name: e.target.value})}/></div>
              <div><label className="label">Age</label><input className="input" value={edit.age || ""} onChange={e=>setEdit({...edit, age: e.target.value})}/></div>
              <div><label className="label">Intake Date</label><input type="date" className="input" value={edit.intake_date || ""} onChange={e=>setEdit({...edit, intake_date: e.target.value})}/></div>
              <div><label className="label">Parent Name</label><input className="input" value={edit.parent_name || ""} onChange={e=>setEdit({...edit, parent_name: e.target.value})}/></div>
              <div><label className="label">Phone</label><input className="input" value={edit.phone || ""} onChange={e=>setEdit({...edit, phone: e.target.value})}/></div>
              <div className="col-span-2">
                <label className="label">Status</label>
                <select className="select" value={edit.status} onChange={e=>setEdit({...edit, status: e.target.value})}>
                  {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className="label">Notes</label><textarea className="textarea" rows={3} value={edit.notes || ""} onChange={e=>setEdit({...edit, notes: e.target.value})}/></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEdit(null)} className="btn btn-outline">Cancel</button>
              <button onClick={save} className="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
