import { Folders, Files, Notebook, ArrowSquareOut } from "@phosphor-icons/react";

const RES = [
  { title: "Client Files", desc: "All client folders", url: "https://drive.google.com/drive/folders/1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr", icon: <Folders size={28} weight="duotone"/>, bg: "#E5EBE1", color: "#3D4F35" },
  { title: "HR Files", desc: "Employees · Forms", url: "https://drive.google.com/drive/folders/1jWRO97gDHK_TfmZhTqCqm0SdBc6_b5bE", icon: <Files size={28} weight="duotone"/>, bg: "#FAF0D1", color: "#6B5218" },
  { title: "Company Policies", desc: "Internal documents", url: "https://drive.google.com/drive/folders/11VQQ-o1QoDQV-ktygB1tlnRmqCs3mxAb", icon: <Notebook size={28} weight="duotone"/>, bg: "#EAF0F3", color: "#375568" },
];

export default function Resources() {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold" style={{color: "#2C3625"}}>Resources</h1>
      <div className="text-sm mb-5" style={{color: "#5C6853"}}>Drive folders & shared documents</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {RES.map(r => (
          <a key={r.title} href={r.url} target="_blank" rel="noreferrer" className="card card-hover p-5 group">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{background: r.bg, color: r.color}}>{r.icon}</div>
            <div className="font-bold" style={{color: "#2C3625"}}>{r.title}</div>
            <div className="text-xs" style={{color: "#8B9E7A"}}>{r.desc}</div>
            <div className="text-sm flex items-center gap-1 mt-3 opacity-60 group-hover:opacity-100 transition" style={{color: "#7A8A6A"}}><ArrowSquareOut size={14}/> Open</div>
          </a>
        ))}
      </div>
    </div>
  );
}
