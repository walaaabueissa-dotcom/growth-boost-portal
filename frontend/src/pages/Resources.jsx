import { Folders, Files, Notebook, ArrowSquareOut } from "@phosphor-icons/react";

const RES = [
  { title: "ملفات العملاء", desc: "All client folders", url: "https://drive.google.com/drive/folders/1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr", icon: <Folders size={28} weight="duotone"/>, color: "bg-brand-light text-brand-dark" },
  { title: "ملفات الموارد البشرية", desc: "Employees · Forms", url: "https://drive.google.com/drive/folders/1jWRO97gDHK_TfmZhTqCqm0SdBc6_b5bE", icon: <Files size={28} weight="duotone"/>, color: "bg-gold/20 text-[#6B5218]" },
  { title: "سياسات الشركة", desc: "Company Policies", url: "https://drive.google.com/drive/folders/11VQQ-o1QoDQV-ktygB1tlnRmqCs3mxAb", icon: <Notebook size={28} weight="duotone"/>, color: "bg-[#EAF0F3] text-[#375568]" },
];

export default function Resources() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="font-serif-en text-3xl text-ink font-semibold mb-1">Resources</h1>
      <div className="text-sm text-ink-soft mb-5">الموارد · ملفات وروابط Google Drive</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {RES.map(r => (
          <a key={r.title} href={r.url} target="_blank" rel="noreferrer" className="card p-5 group">
            <div className={`w-12 h-12 rounded-xl ${r.color} flex items-center justify-center mb-3`}>{r.icon}</div>
            <div className="font-bold text-ink">{r.title}</div>
            <div className="text-xs text-ink-mute">{r.desc}</div>
            <div className="text-brand text-sm flex items-center gap-1 mt-3 opacity-60 group-hover:opacity-100 transition"><ArrowSquareOut size={14}/> فتح</div>
          </a>
        ))}
      </div>
    </div>
  );
}
