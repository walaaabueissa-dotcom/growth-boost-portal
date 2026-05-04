import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../auth";
import { CalendarBlank, ClipboardText, UsersThree, ListChecks, Plant, ArrowRight, Sparkle, Leaf } from "@phosphor-icons/react";

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ clients: 0, therapists: 0, requests: 0, sessions: 0 });

  useEffect(() => {
    (async () => {
      try {
        const [c, t, r, s] = await Promise.all([
          api.get("/clients"),
          api.get("/therapists").catch(() => ({ data: [] })),
          api.get("/requests"),
          api.get("/schedule"),
        ]);
        setStats({
          clients: c.data.length, therapists: t.data.length,
          requests: r.data.filter(x => x.status === "pending").length,
          sessions: s.data.length,
        });
      } catch (_e) { /* ignore */ }
    })();
  }, []);

  const tiles = [
    { to: "/schedule", icon: <CalendarBlank size={26} weight="duotone"/>, title: "Weekly Schedule", desc: "Manage therapist sessions", count: stats.sessions, color: "#E5EBE1", iconColor: "#3D4F35" },
    { to: "/attendance", icon: <ClipboardText size={26} weight="duotone"/>, title: "Attendance", desc: "Daily preparation sheets", count: stats.clients, color: "#FAF0D1", iconColor: "#6B5218" },
    { to: "/clients", icon: <UsersThree size={26} weight="duotone"/>, title: "Clients", desc: "Children portfolios", count: stats.clients, color: "#EAF0F3", iconColor: "#375568" },
    { to: "/requests", icon: <ListChecks size={26} weight="duotone"/>, title: "Requests", desc: "Pending requests", count: stats.requests, color: "#F1ECF7", iconColor: "#4E3F70" },
  ];

  return (
    <div>
      {/* Hero banner */}
      <div className="card p-7 lg:p-10 mb-6 relative overflow-hidden text-white" style={{background: "linear-gradient(135deg, #7A8A6A 0%, #606E52 60%, #48543E 100%)", borderColor: "transparent"}}>
        <Leaf size={220} weight="duotone" className="leaf-deco" style={{ top: "-30px", right: "-20px" }} />
        <Plant size={180} weight="duotone" className="leaf-deco" style={{ bottom: "-50px", right: "30%", animationDelay: "3s" }} />
        <div className="relative">
          <div className="text-xs tracking-[0.3em] opacity-80 font-bold mb-2 flex items-center gap-2"><Sparkle size={14} weight="fill"/> WELCOME BACK</div>
          <h1 className="font-display text-3xl md:text-5xl font-semibold leading-[1.1]">
            Hello, {user?.name?.replace("Ms. ", "") || "Friend"}.
          </h1>
          <h2 className="font-display text-2xl md:text-3xl mt-2 italic opacity-95">
            Each growth begins with <span className="text-[#F0D88A]">seeds.</span>
          </h2>
          <div className="opacity-90 mt-3 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger mb-6">
        {tiles.map(t => (
          <Link key={t.to} to={t.to} className="card card-hover p-5 group" data-testid={`home-tile-${t.to.slice(1)}`}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{background: t.color, color: t.iconColor}}>{t.icon}</div>
            <div className="text-3xl font-display font-semibold" style={{color: "#2C3625"}}>{t.count}</div>
            <div className="font-bold mt-1" style={{color: "#2C3625"}}>{t.title}</div>
            <div className="text-xs" style={{color: "#5C6853"}}>{t.desc}</div>
            <div className="text-sm flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition" style={{color: "#7A8A6A"}}>
              <span>Open</span><ArrowRight size={14}/>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="font-bold mb-3" style={{color: "#2C3625"}}>Quick Links</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <a href="https://drive.google.com/drive/folders/1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">📁 Client Files</a>
            <a href="https://drive.google.com/drive/folders/1jWRO97gDHK_TfmZhTqCqm0SdBc6_b5bE" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">💼 HR</a>
            <a href="https://drive.google.com/drive/folders/11VQQ-o1QoDQV-ktygB1tlnRmqCs3mxAb" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">📜 Policies</a>
            <a href="https://boost-growthsa.com" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">🌱 Website</a>
          </div>
        </div>
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute -top-3 -right-3 opacity-10"><Plant size={130} weight="duotone"/></div>
          <div className="font-bold mb-2 relative" style={{color: "#2C3625"}}>{user?.role === "admin" ? "Admin Tip" : "Therapist Tip"}</div>
          <p className="text-sm leading-relaxed relative" style={{color: "#5C6853"}}>
            Every behavior is a form of communication, and every environment is a place for learning. Make every session count 🌱
          </p>
        </div>
      </div>
    </div>
  );
}
