import { useEffect, useState, useMemo } from "react";
import api, { formatGregorian } from "../api";
import { useAuth } from "../auth";
import {
  CaretLeft, CaretRight, Plus, MagnifyingGlass, FileXls, Download, Trash,
  CalendarBlank, X, UploadSimple, User
} from "@phosphor-icons/react";

export default function Attendance() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [clients, setClients] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", session_date: "", therapist_id: "", notes: "", file: null });
  const [therapistSearch, setTherapistSearch] = useState("");
  const [showTherapistDD, setShowTherapistDD] = useState(false);

  useEffect(() => {
    api.get("/clients").then(({data}) => setClients(data));
    api.get("/therapists").then(({data}) => setTherapists(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (selected) {
      api.get(`/clients/${selected.id}/sheets`).then(({data}) => { setSheets(data); setPageIdx(Math.max(0, data.length - 1)); });
    } else { setSheets([]); }
  }, [selected]);

  const filtered = useMemo(() => clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase())), [clients, search]);
  const filteredTherapists = useMemo(() => therapists.filter(t => t.name.toLowerCase().includes(therapistSearch.toLowerCase())), [therapists, therapistSearch]);
  const currentSheet = sheets[pageIdx];
  const findTherapist = (id) => therapists.find(t => t.id === id);

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("session_date", form.session_date);
    if (form.therapist_id) fd.append("therapist_id", form.therapist_id);
    if (form.notes) fd.append("notes", form.notes);
    if (form.file) fd.append("file", form.file);
    await api.post(`/clients/${selected.id}/sheets`, fd, { headers: {"Content-Type": "multipart/form-data"}});
    setShowAdd(false); setForm({ title: "", session_date: "", therapist_id: "", notes: "", file: null }); setTherapistSearch("");
    const { data } = await api.get(`/clients/${selected.id}/sheets`);
    setSheets(data); setPageIdx(data.length - 1);
  };

  const removeSheet = async () => {
    if (!currentSheet || !window.confirm("Delete this sheet?")) return;
    await api.delete(`/sheets/${currentSheet.id}`);
    const { data } = await api.get(`/clients/${selected.id}/sheets`);
    setSheets(data); setPageIdx(Math.max(0, Math.min(pageIdx, data.length - 1)));
  };

  const downloadSheet = async () => {
    const url = `${api.defaults.baseURL}/sheets/${currentSheet.id}/download`;
    const token = localStorage.getItem("bg_token");
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: "include" });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = currentSheet.file_name || "sheet";
    a.click();
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Attendance Sheets</h1>
        <div className="text-sm" style={{color: "#5C6853"}}>Daily session sheets for each child</div>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-5">
        <div className="card p-4 h-fit">
          <div className="relative mb-3">
            <MagnifyingGlass size={18} className="absolute top-3 left-3" style={{color: "#8B9E7A"}}/>
            <input data-testid="client-search" className="input pl-10" placeholder="Search child..." value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
            {filtered.length === 0 && <div className="text-sm text-center py-6" style={{color: "#8B9E7A"}}>No clients</div>}
            {filtered.map(c => (
              <button key={c.id} data-testid={`client-${c.id}`} onClick={() => setSelected(c)}
                      className={`text-left p-3 rounded-xl transition border ${selected?.id===c.id ? "bg-[#7A8A6A] text-white border-[#7A8A6A]" : "border-transparent hover:bg-[#E5EBE1]"}`}>
                <div className="font-bold">{c.name}</div>
                <div className={`text-xs ${selected?.id===c.id ? "opacity-80" : ""}`} style={selected?.id===c.id ? {} : {color: "#8B9E7A"}}>{c.package || c.service_type || "—"}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          {!selected ? (
            <div className="card p-12 text-center" style={{color: "#8B9E7A"}}>
              <FileXls size={48} weight="duotone" className="mx-auto mb-3" style={{color: "#7A8A6A"}}/>
              <div className="font-bold" style={{color: "#2C3625"}}>Select a child</div>
              <div className="text-sm">Their session sheets will appear here.</div>
            </div>
          ) : (
            <div>
              <div className="card p-6 mb-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs tracking-[0.25em] font-bold" style={{color: "#8B9E7A"}}>CLIENT FILE</div>
                    <h2 className="font-display text-2xl" style={{color: "#2C3625"}}>{selected.name}</h2>
                    <div className="text-sm" style={{color: "#5C6853"}}>{selected.package || "—"} {selected.parent_name && `· ${selected.parent_name}`}</div>
                  </div>
                  {isAdmin && <button data-testid="add-sheet-btn" onClick={() => setShowAdd(true)} className="btn btn-primary"><Plus size={16}/> New Sheet</button>}
                </div>
              </div>

              {sheets.length === 0 ? (
                <div className="card p-12 text-center" style={{color: "#8B9E7A"}}>
                  <CalendarBlank size={48} weight="duotone" className="mx-auto mb-3" style={{color: "#7A8A6A"}}/>
                  <div className="font-bold" style={{color: "#2C3625"}}>No sheets yet</div>
                  {isAdmin && <div className="text-sm mt-1">Click "New Sheet" to add the first page.</div>}
                </div>
              ) : (
                <div className="card p-0 overflow-hidden">
                  <div className="bg-[#F0E9D8] border-b border-[#E8E4DE] p-4 flex items-center gap-3 flex-wrap">
                    <button data-testid="prev-page-btn" onClick={() => setPageIdx(Math.max(0, pageIdx-1))} disabled={pageIdx===0} className="btn btn-outline disabled:opacity-40"><CaretLeft size={16}/></button>
                    <div className="px-4 py-2 bg-white rounded-xl border border-[#E8E4DE] font-bold min-w-32 text-center" style={{color: "#2C3625"}}>
                      Page {pageIdx+1} / {sheets.length}
                    </div>
                    <button data-testid="next-page-btn" onClick={() => setPageIdx(Math.min(sheets.length-1, pageIdx+1))} disabled={pageIdx===sheets.length-1} className="btn btn-outline disabled:opacity-40"><CaretRight size={16}/></button>
                    <div className="flex-1"/>
                    {currentSheet?.file_name && <button onClick={downloadSheet} className="btn btn-secondary"><Download size={16}/> Download</button>}
                    {isAdmin && <button onClick={removeSheet} className="btn btn-outline text-red-700"><Trash size={16}/></button>}
                  </div>

                  <div className="p-6">
                    <div className="border-2 border-dashed border-[#E5EBE1] rounded-xl p-6" style={{background: "rgba(246,244,240,0.5)"}}>
                      <div className="flex justify-between items-start flex-wrap gap-3 mb-4 pb-4 border-b border-[#E8E4DE]">
                        <div>
                          <div className="text-xs font-bold tracking-wider" style={{color: "#8B9E7A"}}>SHEET NO.</div>
                          <div className="font-display text-3xl" style={{color: "#2C3625"}}>#{String(currentSheet.page_number).padStart(4, '0')}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold tracking-wider" style={{color: "#8B9E7A"}}>SESSION DATE</div>
                          <div className="font-bold text-lg flex items-center gap-2 justify-end" style={{color: "#2C3625"}}>
                            <CalendarBlank size={18} style={{color: "#7A8A6A"}}/> {formatGregorian(currentSheet.session_date)}
                          </div>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-xs font-bold tracking-wider" style={{color: "#8B9E7A"}}>TITLE</div>
                          <div className="font-bold" style={{color: "#2C3625"}}>{currentSheet.title}</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold tracking-wider" style={{color: "#8B9E7A"}}>THERAPIST</div>
                          <div className="font-bold flex items-center gap-2" style={{color: "#2C3625"}}>
                            {currentSheet.therapist_id ? (<><User size={16} style={{color: "#7A8A6A"}}/> {findTherapist(currentSheet.therapist_id)?.name || "—"}</>) : "—"}
                          </div>
                        </div>
                      </div>
                      {currentSheet.notes && (
                        <div className="mb-4">
                          <div className="text-xs font-bold tracking-wider" style={{color: "#8B9E7A"}}>NOTES</div>
                          <div className="whitespace-pre-wrap" style={{color: "#5C6853"}}>{currentSheet.notes}</div>
                        </div>
                      )}
                      {currentSheet.file_name && (
                        <div className="mt-4 p-4 bg-white rounded-xl border border-[#E8E4DE] flex items-center gap-3">
                          <FileXls size={32} weight="duotone" style={{color: "#1E7E5E"}}/>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold truncate" style={{color: "#2C3625"}}>{currentSheet.file_name}</div>
                            <div className="text-xs" style={{color: "#8B9E7A"}}>Excel · Page {currentSheet.page_number}</div>
                          </div>
                          <button onClick={downloadSheet} className="btn btn-primary"><Download size={16}/> Open</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setShowAdd(false)}>
          <form onSubmit={submit} className="card p-6 w-full max-w-lg modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-display text-2xl">New Attendance Sheet</div>
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <label className="label">Title</label>
            <input data-testid="sheet-title-input" className="input mb-3" required value={form.title} onChange={e=>setForm({...form, title: e.target.value})}/>

            <label className="label">Date (Gregorian)</label>
            <div className="flex items-center gap-2 mb-3">
              <input data-testid="sheet-date-input" className="input flex-1" type="date" required value={form.session_date} onChange={e=>setForm({...form, session_date: e.target.value})}/>
              {form.session_date && <span className="text-xs" style={{color: "#8B9E7A"}}>{formatGregorian(form.session_date)}</span>}
            </div>

            <label className="label">Therapist</label>
            <div className="relative mb-3">
              <input data-testid="therapist-search-input" className="input"
                     placeholder="Search by name..."
                     value={form.therapist_id ? findTherapist(form.therapist_id)?.name || therapistSearch : therapistSearch}
                     onChange={e => { setTherapistSearch(e.target.value); setShowTherapistDD(true); setForm({...form, therapist_id: ""}); }}
                     onFocus={() => setShowTherapistDD(true)}
                     onBlur={() => setTimeout(() => setShowTherapistDD(false), 200)}/>
              {showTherapistDD && (
                <div className="absolute z-20 w-full bg-white border border-[#E8E4DE] rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {filteredTherapists.map(t => (
                    <button type="button" key={t.id} onClick={() => { setForm({...form, therapist_id: t.id}); setTherapistSearch(t.name); setShowTherapistDD(false); }}
                            className="w-full text-left p-2 hover:bg-[#E5EBE1] flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full text-white text-xs flex items-center justify-center font-bold" style={{background: t.color || "#7A8A6A"}}>{t.name?.replace("Ms. ", "").charAt(0)}</div>
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="label">Notes</label>
            <textarea className="textarea mb-3" rows={3} value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})}/>

            <label className="label">Excel File (optional)</label>
            <label className="btn btn-outline w-full justify-start cursor-pointer mb-4">
              <UploadSimple size={18}/> {form.file ? form.file.name : "Upload Excel"}
              <input type="file" accept=".xls,.xlsx,.csv,.pdf" onChange={e => setForm({...form, file: e.target.files[0]})} className="hidden"/>
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-outline">Cancel</button>
              <button data-testid="sheet-save-btn" type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
