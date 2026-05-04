import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import api from "../api";
import {
  Plant, House, CalendarBlank, ClipboardText, UsersThree,
  Folders, AddressBook, Bell, SignOut, ListChecks, Gear, UserList
} from "@phosphor-icons/react";

export default function Shell() {
  const { user, logout } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const loc = useLocation();

  const loadNotifs = async () => {
    try { const { data } = await api.get("/notifications"); setNotifs(data); } catch(_e) { /* ignore */ }
  };
  useEffect(() => { loadNotifs(); const t = setInterval(loadNotifs, 30000); return () => clearInterval(t); }, [loc.pathname]);

  const unread = notifs.filter(n => !n.read).length;
  const isAdmin = user?.role === "admin";

  const links = [
    { to: "/home", icon: <House size={22} weight="duotone"/>, label: "الرئيسية", testid: "nav-home" },
    { to: "/schedule", icon: <CalendarBlank size={22} weight="duotone"/>, label: "الجدول", testid: "nav-schedule" },
    { to: "/attendance", icon: <ClipboardText size={22} weight="duotone"/>, label: "التحضير", testid: "nav-attendance" },
    { to: "/clients", icon: <UsersThree size={22} weight="duotone"/>, label: "العملاء", testid: "nav-clients" },
    { to: "/intake", icon: <UserList size={22} weight="duotone"/>, label: "الانتيك", testid: "nav-intake" },
    { to: "/requests", icon: <ListChecks size={22} weight="duotone"/>, label: "الطلبات", testid: "nav-requests" },
    { to: "/directory", icon: <AddressBook size={22} weight="duotone"/>, label: "الدليل", testid: "nav-directory" },
    { to: "/resources", icon: <Folders size={22} weight="duotone"/>, label: "الموارد", testid: "nav-resources" },
  ];
  if (isAdmin) {
    links.push({ to: "/admin", icon: <Gear size={22} weight="duotone"/>, label: "الإدارة", testid: "nav-admin" });
  }

  const markAllRead = async () => { await api.post("/notifications/read-all"); loadNotifs(); };

  return (
    <div className="min-h-screen bg-organic flex" dir="rtl">
      {/* sidebar */}
      <aside className="w-64 shrink-0 border-l border-[#E8E4DE] bg-white/70 backdrop-blur min-h-screen sticky top-0 hidden md:flex flex-col">
        <div className="p-5 border-b border-[#E8E4DE]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center">
              <Plant size={26} weight="duotone" color="#FAF0D1" />
            </div>
            <div>
              <div className="font-bold text-ink leading-tight">BOOST GROWTH</div>
              <div className="text-[11px] text-ink-mute">ABA Services</div>
            </div>
          </div>
        </div>
        <nav className="p-3 flex-1 overflow-y-auto">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} data-testid={l.testid}
                     className={({isActive}) => `sidebar-link ${isActive ? "active" : ""}`}>
              {l.icon}<span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-[#E8E4DE]">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-gold/30 flex items-center justify-center font-bold text-ink">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-ink truncate">{user?.name || user?.email}</div>
              <div className="text-[11px] text-ink-mute">{isAdmin ? "Admin" : "Therapist"}</div>
            </div>
          </div>
          <button data-testid="logout-btn" onClick={logout} className="btn btn-outline w-full text-sm">
            <SignOut size={18} /> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* topbar */}
        <header className="h-16 bg-white/80 backdrop-blur border-b border-[#E8E4DE] sticky top-0 z-30 flex items-center px-5 gap-4">
          <div className="flex-1">
            <div className="text-xs text-ink-mute font-bold tracking-wider">STAFF PORTAL</div>
            <div className="text-sm text-ink font-bold">مرحبًا، {user?.name || "Welcome"} 👋</div>
          </div>
          <div className="relative">
            <button data-testid="notif-bell" onClick={() => setShowNotif(s => !s)}
                    className="relative w-10 h-10 rounded-xl bg-cream-warm hover:bg-brand-light flex items-center justify-center transition">
              <Bell size={22} weight="duotone" color="#48543E"/>
              {unread > 0 && <span className="absolute -top-1 -right-1 bg-[#C97B5C] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{unread}</span>}
            </button>
            {showNotif && (
              <div className="absolute end-0 mt-2 w-96 max-w-[90vw] card p-0 z-50">
                <div className="flex items-center justify-between p-3 border-b border-[#E8E4DE]">
                  <div className="font-bold">الإشعارات</div>
                  {unread > 0 && <button onClick={markAllRead} className="text-xs text-brand hover:underline">تحديد الكل كمقروء</button>}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifs.length === 0 && <div className="p-6 text-center text-ink-mute text-sm">لا توجد إشعارات</div>}
                  {notifs.map(n => (
                    <div key={n.id} className={`p-3 border-b border-[#F0EDE9] text-sm ${!n.read ? "bg-brand-light/40" : ""}`}>
                      <div className="font-bold text-ink">{n.title}</div>
                      <div className="text-ink-soft text-xs mt-0.5">{n.message}</div>
                      <div className="text-[10px] text-ink-mute mt-1">{new Date(n.created_at).toLocaleString('ar-SA')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="p-5 md:p-7 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
