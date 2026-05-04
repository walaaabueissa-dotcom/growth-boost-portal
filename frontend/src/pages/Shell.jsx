import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import api from "../api";
import {
  Plant, House, CalendarBlank, ClipboardText, UsersThree,
  Folders, AddressBook, Bell, SignOut, ListChecks, Gear, UserList, List, X
} from "@phosphor-icons/react";

export default function Shell() {
  const { user, logout } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const loc = useLocation();
  const isAdmin = user?.role === "admin";

  const loadNotifs = async () => {
    try { const { data } = await api.get("/notifications"); setNotifs(data); } catch(_e) { /* ignore */ }
  };
  useEffect(() => { loadNotifs(); const t = setInterval(loadNotifs, 30000); return () => clearInterval(t); }, [loc.pathname]);
  useEffect(() => { setMobileNav(false); setShowNotif(false); }, [loc.pathname]);

  const unread = notifs.filter(n => !n.read).length;

  const links = [
    { to: "/home", icon: <House size={18} weight="duotone"/>, label: "Home", testid: "nav-home" },
    { to: "/schedule", icon: <CalendarBlank size={18} weight="duotone"/>, label: "Schedule", testid: "nav-schedule" },
    { to: "/attendance", icon: <ClipboardText size={18} weight="duotone"/>, label: "Attendance", testid: "nav-attendance" },
    { to: "/clients", icon: <UsersThree size={18} weight="duotone"/>, label: "Clients", testid: "nav-clients" },
    { to: "/intake", icon: <UserList size={18} weight="duotone"/>, label: "Intake", testid: "nav-intake" },
    { to: "/requests", icon: <ListChecks size={18} weight="duotone"/>, label: "Requests", testid: "nav-requests" },
    { to: "/directory", icon: <AddressBook size={18} weight="duotone"/>, label: "Directory", testid: "nav-directory" },
    { to: "/resources", icon: <Folders size={18} weight="duotone"/>, label: "Resources", testid: "nav-resources" },
  ];
  if (isAdmin) {
    links.push({ to: "/admin", icon: <Gear size={18} weight="duotone"/>, label: "Admin", testid: "nav-admin" });
  }

  const markAllRead = async () => { await api.post("/notifications/read-all"); loadNotifs(); };

  return (
    <div className="min-h-screen bg-organic flex flex-col">
      {/* Top Nav */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-[#E8E4DE]">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="h-16 flex items-center gap-4">
            <NavLink to="/home" className="flex items-center gap-2.5 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-[#7A8A6A] flex items-center justify-center">
                <Plant size={22} weight="duotone" color="#FAF0D1" />
              </div>
              <div className="hidden sm:block">
                <div className="text-[15px] font-bold leading-tight" style={{color: "#2C3625"}}>BOOST GROWTH</div>
                <div className="text-[10px] font-bold tracking-[0.2em]" style={{color: "#8B9E7A"}}>STAFF PORTAL</div>
              </div>
            </NavLink>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1 flex-1 ml-4">
              {links.map(l => (
                <NavLink key={l.to} to={l.to} data-testid={l.testid}
                         className={({isActive}) => `nav-link ${isActive ? "active" : ""}`}>
                  {l.icon}<span>{l.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="flex-1 lg:hidden"/>

            {/* Notifications */}
            <div className="relative">
              <button data-testid="notif-bell" onClick={() => setShowNotif(s => !s)}
                      className="relative w-10 h-10 rounded-xl bg-[#F0E9D8] hover:bg-[#E5EBE1] flex items-center justify-center transition active:scale-95">
                <Bell size={20} weight="duotone" color="#48543E"/>
                {unread > 0 && <span className="absolute -top-1 -right-1 bg-[#C97B5C] text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">{unread}</span>}
              </button>
              {showNotif && (
                <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] card p-0 z-50">
                  <div className="flex items-center justify-between p-3 border-b border-[#E8E4DE]">
                    <div className="font-bold">Notifications</div>
                    {unread > 0 && <button onClick={markAllRead} className="text-xs hover:underline" style={{color: "#7A8A6A"}}>Mark all read</button>}
                  </div>
                  <div className="max-h-[28rem] overflow-y-auto">
                    {notifs.length === 0 && <div className="p-8 text-center text-sm" style={{color: "#8B9E7A"}}>No notifications yet</div>}
                    {notifs.map(n => (
                      <div key={n.id} className={`p-3 border-b border-[#F0EDE9] text-sm transition ${!n.read ? "bg-[#E5EBE1]/40" : ""}`}>
                        <div className="font-bold" style={{color: "#2C3625"}}>{n.title}</div>
                        <div className="text-xs mt-0.5" style={{color: "#5C6853"}}>{n.message}</div>
                        <div className="text-[10px] mt-1" style={{color: "#8B9E7A"}}>{new Date(n.created_at).toLocaleString('en-US')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-[#E8E4DE]">
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{background: user?.color || "#D4A64A"}}>
                {user?.name?.replace("Ms. ", "").charAt(0) || "U"}
              </div>
              <div className="text-xs leading-tight">
                <div className="font-bold truncate max-w-[120px]" style={{color: "#2C3625"}}>{user?.name?.replace("Ms. ", "") || user?.email}</div>
                <div style={{color: "#8B9E7A"}}>{isAdmin ? "Admin" : "Therapist"}</div>
              </div>
              <button data-testid="logout-btn" onClick={logout} className="btn btn-ghost p-2"><SignOut size={18}/></button>
            </div>

            {/* Mobile burger */}
            <button onClick={() => setMobileNav(true)} className="lg:hidden btn btn-ghost p-2"><List size={24}/></button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 bg-black/40 modal-backdrop lg:hidden" onClick={() => setMobileNav(false)}>
          <div className="absolute right-0 top-0 h-full w-72 bg-white shadow-2xl modal-card overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="p-4 border-b border-[#E8E4DE] flex items-center justify-between">
              <div className="font-bold">Menu</div>
              <button onClick={() => setMobileNav(false)} className="btn btn-ghost p-2"><X size={20}/></button>
            </div>
            <div className="p-3 flex flex-col gap-1">
              {links.map(l => (
                <NavLink key={l.to} to={l.to} className={({isActive}) => `nav-link ${isActive ? "active" : ""}`}>
                  {l.icon}<span>{l.label}</span>
                </NavLink>
              ))}
              <div className="divider my-3"/>
              <button onClick={logout} className="nav-link"><SignOut size={18}/> Sign out</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6 page-enter" key={loc.pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
