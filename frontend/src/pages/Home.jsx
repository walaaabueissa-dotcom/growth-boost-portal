import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../auth";
import { CalendarBlank, ClipboardText, UsersThree, ListChecks, Plant, ArrowRight } from "@phosphor-icons/react";

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
          clients: c.data.length,
          therapists: t.data.length,
          requests: r.data.filter(x => x.status === "pending").length,
          sessions: s.data.length,
        });
      } catch (_e) { /* ignore */ }
    })();
  }, []);

  const tiles = [
    { to: "/schedule", icon: <CalendarBlank size={28} weight="duotone"/>, title: "الجدول الأسبوعي", desc: "إدارة جلسات الأخصائيات", count: stats.sessions, color: "bg-brand-light" },
    { to: "/attendance", icon: <ClipboardText size={28} weight="duotone"/>, title: "التحضير", desc: "ورقات التحضير اليومية", count: stats.clients, color: "bg-gold/20" },
    { to: "/clients", icon: <UsersThree size={28} weight="duotone"/>, title: "العملاء", desc: "ملفات الأطفال", count: stats.clients, color: "bg-[#EAF0F3]" },
    { to: "/requests", icon: <ListChecks size={28} weight="duotone"/>, title: "الطلبات", desc: "طلبات قيد الانتظار", count: stats.requests, color: "bg-[#FAF0D1]" },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* welcome banner */}
      <div className="card p-7 mb-6 relative overflow-hidden bg-sage-hero text-white">
        <div className="absolute -end-6 -bottom-6 opacity-10"><Plant size={200} weight="duotone"/></div>
        <div className="text-xs tracking-[0.25em] opacity-80 font-bold mb-2">GOOD DAY</div>
        <h1 className="font-serif-en text-3xl md:text-4xl font-semibold leading-tight">
          Each growth begins with <span className="text-[#F0D88A] italic">seeds.</span>
        </h1>
        <div className="opacity-90 mt-1">رحلة نمو طفلكم تبدأ هنا · {new Date().toLocaleDateString('ar-SA', { dateStyle: 'full' })}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger">
        {tiles.map(t => (
          <Link key={t.to} to={t.to} className="card p-5 group" data-testid={`home-tile-${t.to.slice(1)}`}>
            <div className={`w-12 h-12 ${t.color} rounded-xl flex items-center justify-center text-brand-dark mb-3`}>{t.icon}</div>
            <div className="text-3xl font-serif-en font-semibold text-ink">{t.count}</div>
            <div className="font-bold text-ink mt-1">{t.title}</div>
            <div className="text-xs text-ink-soft">{t.desc}</div>
            <div className="text-brand text-sm flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition"><span>عرض</span><ArrowRight size={14} className="rtl:rotate-180"/></div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="card p-5">
          <div className="font-bold text-ink mb-3">روابط سريعة</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <a href="https://drive.google.com/drive/folders/1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">📁 ملفات العملاء</a>
            <a href="https://drive.google.com/drive/folders/1jWRO97gDHK_TfmZhTqCqm0SdBc6_b5bE" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">💼 موارد بشرية</a>
            <a href="https://drive.google.com/drive/folders/11VQQ-o1QoDQV-ktygB1tlnRmqCs3mxAb" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">📜 السياسات</a>
            <a href="https://boost-growthsa.com" target="_blank" rel="noreferrer" className="btn btn-outline justify-start">🌱 الموقع الرسمي</a>
          </div>
        </div>
        <div className="card p-5">
          <div className="font-bold text-ink mb-2">{user?.role === "admin" ? "نصيحة اليوم للإدارة" : "نصيحة لأخصائياتنا"}</div>
          <p className="text-sm text-ink-soft leading-relaxed">
            تذكّري أن "كل سلوك هو شكل من أشكال التواصل، وكل بيئة هي مكان للتعلم". اتركي بصمتك في رحلة كل طفل 🌱
          </p>
        </div>
      </div>
    </div>
  );
}
