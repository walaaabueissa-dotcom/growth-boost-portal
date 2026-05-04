import { useEffect, useState, useMemo } from "react";
import api, { formatGregorian, MONTHS_AR } from "../api";
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
    setShowAdd(false); setForm({ title: "", session_date: "", therapist_id: "", notes: "", file: null });
    const { data } = await api.get(`/clients/${selected.id}/sheets`);
    setSheets(data); setPageIdx(data.length - 1);
  };

  const removeSheet = async () => {
    if (!currentSheet) return;
    if (!window.confirm("حذف هذه الورقة؟")) return;
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
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-5">
        <h1 className="font-serif-en text-3xl text-ink font-semibold">Attendance Sheets</h1>
        <div className="text-sm text-ink-soft">التحضير اليومي · ملفات الجلسات لكل طفل</div>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-5">
        {/* Clients sidebar */}
        <div className="card p-4 h-fit">
          <div className="relative mb-3">
            <MagnifyingGlass size={18} className="absolute top-3 start-3 text-ink-mute"/>
            <input data-testid="client-search" className="input ps-10" placeholder="ابحث عن طفل..." value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
            {filtered.length === 0 && <div className="text-sm text-ink-mute text-center py-6">لا يوجد عملاء</div>}
            {filtered.map(c => (
              <button key={c.id} data-testid={`client-${c.id}`} onClick={() => setSelected(c)}
                      className={`text-start p-3 rounded-xl transition border ${selected?.id===c.id ? "bg-brand text-white border-brand" : "border-transparent hover:bg-brand-light hover:border-[#E8E4DE]"}`}>
                <div className="font-bold">{c.name}</div>
                <div className={`text-xs ${selected?.id===c.id ? "opacity-80" : "text-ink-mute"}`}>{c.package || "—"}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Sheet viewer */}
        <div>
          {!selected ? (
            <div className="card p-12 text-center text-ink-mute">
              <FileXls size={48} weight="duotone" className="mx-auto mb-3 text-brand"/>
              <div className="font-bold text-ink">اختاري طفلًا للعرض</div>
              <div className="text-sm">سيتم عرض ملف Excel وصفحات التحضير هنا</div>
            </div>
          ) : (
            <div>
              {/* Invoice header */}
              <div className="card p-6 mb-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs tracking-[0.2em] text-ink-mute font-bold">CLIENT FILE</div>
                    <h2 className="font-serif-en text-2xl text-ink">{selected.name}</h2>
                    <div className="text-sm text-ink-soft">{selected.package || "—"} {selected.parent_name && `· ولي الأمر: ${selected.parent_name}`}</div>
                  </div>
                  {isAdmin && <button data-testid="add-sheet-btn" onClick={() => setShowAdd(true)} className="btn btn-primary"><Plus size={16}/> ورقة جديدة</button>}
                </div>
              </div>

              {/* Pagination + Sheet */}
              {sheets.length === 0 ? (
                <div className="card p-12 text-center text-ink-mute">
                  <CalendarBlank size={48} weight="duotone" className="mx-auto mb-3 text-brand"/>
                  <div className="font-bold text-ink">لا توجد صفحات تحضير بعد</div>
                  {isAdmin && <div className="text-sm mt-1">اضغطي "ورقة جديدة" لإضافة أول صفحة</div>}
                </div>
              ) : (
                <div className="card p-0 overflow-hidden">
                  {/* Sheet header bar */}
                  <div className="bg-cream-warm border-b border-[#E8E4DE] p-4 flex items-center gap-3 flex-wrap">
                    <button data-testid="prev-page-btn" onClick={() => setPageIdx(Math.max(0, pageIdx-1))} disabled={pageIdx===0} className="btn btn-outline disabled:opacity-40"><CaretRight size={16}/></button>
                    <div className="px-4 py-2 bg-white rounded-xl border border-[#E8E4DE] font-bold text-ink min-w-32 text-center">
                      الصفحة {pageIdx+1} / {sheets.length}
                    </div>
                    <button data-testid="next-page-btn" onClick={() => setPageIdx(Math.min(sheets.length-1, pageIdx+1))} disabled={pageIdx===sheets.length-1} className="btn btn-outline disabled:opacity-40"><CaretLeft size={16}/></button>
                    <div className="flex-1"/>
                    {currentSheet?.file_name && <button onClick={downloadSheet} className="btn btn-secondary"><Download size={16}/> تحميل</button>}
                    {isAdmin && <button onClick={removeSheet} className="btn btn-outline text-red-700"><Trash size={16}/></button>}
                  </div>

                  {/* Invoice-style content */}
                  <div className="p-6">
                    <div className="border-2 border-dashed border-brand-light rounded-xl p-6 bg-cream/50">
                      <div className="flex justify-between items-start flex-wrap gap-3 mb-4 pb-4 border-b border-[#E8E4DE]">
                        <div>
                          <div className="text-xs text-ink-mute font-bold tracking-wider">SHEET NO.</div>
                          <div className="font-serif-en text-3xl text-ink">#{String(currentSheet.page_number).padStart(4, '0')}</div>
                        </div>
                        <div className="text-end">
                          <div className="text-xs text-ink-mute font-bold tracking-wider">SESSION DATE</div>
                          <div className="font-bold text-ink text-lg flex items-center gap-2 justify-end">
                            <CalendarBlank size={18} className="text-brand"/> {formatGregorian(currentSheet.session_date)}
                          </div>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-xs text-ink-mute font-bold tracking-wider">TITLE</div>
                          <div className="font-bold text-ink">{currentSheet.title}</div>
                        </div>
                        <div>
                          <div className="text-xs text-ink-mute font-bold tracking-wider">THERAPIST</div>
                          <div className="font-bold text-ink flex items-center gap-2">
                            {currentSheet.therapist_id ? (<><User size={16} className="text-brand"/> {findTherapist(currentSheet.therapist_id)?.name || "—"}</>) : "—"}
                          </div>
                        </div>
                      </div>
                      {currentSheet.notes && (
                        <div className="mb-4">
                          <div className="text-xs text-ink-mute font-bold tracking-wider">NOTES</div>
                          <div className="text-ink-soft whitespace-pre-wrap">{currentSheet.notes}</div>
                        </div>
                      )}
                      {currentSheet.file_name && (
                        <div className="mt-4 p-4 bg-white rounded-xl border border-[#E8E4DE] flex items-center gap-3">
                          <FileXls size={32} weight="duotone" className="text-[#1E7E5E]"/>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-ink truncate">{currentSheet.file_name}</div>
                            <div className="text-xs text-ink-mute">ملف Excel · صفحة {currentSheet.page_number}</div>
                          </div>
                          <button onClick={downloadSheet} className="btn btn-primary"><Download size={16}/> فتح</button>
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

      {/* Add Sheet modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setShowAdd(false)}>
          <form onSubmit={submit} className="card p-6 w-full max-w-lg modal-card" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-serif-en text-2xl text-ink">إضافة ورقة تحضير</div>
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost p-2"><X size={18}/></button>
            </div>
            <label className="block text-sm font-bold text-ink-soft mb-1">العنوان</label>
            <input data-testid="sheet-title-input" className="input mb-3" required value={form.title} onChange={e=>setForm({...form, title: e.target.value})}/>

            <label className="block text-sm font-bold text-ink-soft mb-1">التاريخ (ميلادي)</label>
            <div className="flex items-center gap-2 mb-3">
              <CalendarBlank size={20} className="text-brand"/>
              <input data-testid="sheet-date-input" className="input flex-1" type="date" required value={form.session_date} onChange={e=>setForm({...form, session_date: e.target.value})}/>
              {form.session_date && <span className="text-xs text-ink-mute">{formatGregorian(form.session_date)}</span>}
            </div>

            <label className="block text-sm font-bold text-ink-soft mb-1">الأخصائية</label>
            <div className="relative mb-3">
              <input data-testid="therapist-search-input" className="input"
                     placeholder="ابحثي بالاسم..."
                     value={form.therapist_id ? findTherapist(form.therapist_id)?.name || therapistSearch : therapistSearch}
                     onChange={e => { setTherapistSearch(e.target.value); setShowTherapistDD(true); setForm({...form, therapist_id: ""}); }}
                     onFocus={() => setShowTherapistDD(true)}/>
              {showTherapistDD && (
                <div className="absolute z-20 w-full bg-white border border-[#E8E4DE] rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {filteredTherapists.map(t => (
                    <button type="button" key={t.id} onClick={() => { setForm({...form, therapist_id: t.id}); setTherapistSearch(t.name); setShowTherapistDD(false); }}
                            className="w-full text-start p-2 hover:bg-brand-light flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full text-white text-xs flex items-center justify-center font-bold" style={{background: t.color || "#7A8A6A"}}>{t.name?.charAt(0)}</div>
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="block text-sm font-bold text-ink-soft mb-1">ملاحظات</label>
            <textarea className="textarea mb-3" rows={3} value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})}/>

            <label className="block text-sm font-bold text-ink-soft mb-1">ملف Excel (اختياري)</label>
            <label className="btn btn-outline w-full justify-start cursor-pointer mb-4">
              <UploadSimple size={18}/> {form.file ? form.file.name : "رفع ملف Excel"}
              <input type="file" accept=".xls,.xlsx,.csv,.pdf" onChange={e => setForm({...form, file: e.target.files[0]})} className="hidden"/>
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-outline">إلغاء</button>
              <button data-testid="sheet-save-btn" type="submit" className="btn btn-primary">حفظ</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
