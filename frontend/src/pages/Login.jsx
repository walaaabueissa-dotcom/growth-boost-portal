import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import api, { formatErr } from "../api";
import { Plant, ArrowRight, ShieldCheck, UserCircle, Backspace, Leaf } from "@phosphor-icons/react";

export default function Login() {
  const { loginAdmin, loginTherapist } = useAuth();
  const [mode, setMode] = useState("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [therapists, setTherapists] = useState([]);
  const [selectedT, setSelectedT] = useState(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (mode === "therapist-select") {
      api.get("/auth/therapists-list").then(({ data }) => setTherapists(data)).catch(() => {});
    }
  }, [mode]);

  const submitAdmin = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try { await loginAdmin(email, password); }
    catch (ex) { setErr(formatErr(ex.response?.data?.detail) || ex.message); }
    finally { setLoading(false); }
  };
  const submitPin = async () => {
    if (pin.length < 4) return;
    setErr(""); setLoading(true);
    try { await loginTherapist(selectedT.id, pin); }
    catch (ex) { setErr(formatErr(ex.response?.data?.detail) || ex.message); setPin(""); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-organic flex flex-col">
      <div className="text-white py-14 px-6 relative overflow-hidden" style={{background: "linear-gradient(135deg, #7A8A6A 0%, #606E52 60%, #48543E 100%)"}}>
        <Leaf size={300} weight="duotone" className="leaf-deco" style={{ top: "-40px", right: "-40px" }} />
        <Plant size={260} weight="duotone" className="leaf-deco" style={{ bottom: "-60px", left: "-30px", animationDelay: "2s" }} />
        <div className="max-w-5xl mx-auto flex items-center gap-4 relative">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Plant size={32} weight="duotone" color="#FAF0D1" />
          </div>
          <div className="flex-1">
            <div className="text-xs tracking-[0.3em] opacity-80 font-bold">STAFF PORTAL</div>
            <div className="text-2xl font-display font-semibold">Boost Growth</div>
            <div className="text-sm opacity-90">Applied Behavior Analysis Services</div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-10 relative">
          <h1 className="font-display text-4xl md:text-6xl font-semibold leading-[1.1]">
            Each growth begins<br/>with <span className="text-[#F0D88A] italic">seeds.</span>
          </h1>
          <div className="text-base opacity-90 mt-3">Helping children achieve their full potential.</div>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto -mt-12 mb-12 px-4 relative z-10">
        <div className="card p-7 page-enter">
          {mode === "choose" && (
            <div className="stagger">
              <div className="text-xs text-ink-mute font-bold tracking-[0.25em]" style={{color: "#8B9E7A"}}>WELCOME BACK 👋</div>
              <h2 className="font-display text-2xl mt-1 mb-5" style={{color: "#2C3625"}}>Sign in to continue</h2>

              <button data-testid="login-as-admin-btn" onClick={() => setMode("admin")}
                      className="w-full mb-3 p-4 rounded-2xl text-white flex items-center gap-3 transition-all active:scale-[0.99] shadow-md"
                      style={{background: "#7A8A6A"}}>
                <ShieldCheck size={28} weight="duotone" />
                <div className="flex-1 text-left">
                  <div className="font-bold">Admin / Supervisor</div>
                  <div className="text-xs opacity-80">Full access · All clients · Reports</div>
                </div>
                <ArrowRight size={20}/>
              </button>

              <button data-testid="login-as-therapist-btn" onClick={() => setMode("therapist-select")}
                      className="w-full p-4 rounded-2xl flex items-center gap-3 transition-all active:scale-[0.99]"
                      style={{background: "#F0E9D8", color: "#2C3625"}}>
                <UserCircle size={28} weight="duotone" color="#7A8A6A" />
                <div className="flex-1 text-left">
                  <div className="font-bold">I'm a Therapist</div>
                  <div className="text-xs" style={{color: "#5C6853"}}>My clients · Session tools</div>
                </div>
                <ArrowRight size={20}/>
              </button>

              <div className="text-center text-xs mt-5" style={{color: "#8B9E7A"}}>boost-growthsa.com · Staff Access Only</div>
            </div>
          )}

          {mode === "admin" && (
            <form onSubmit={submitAdmin} className="stagger">
              <button type="button" onClick={() => setMode("choose")} className="text-sm hover:underline mb-3" style={{color: "#5C6853"}}>← Back</button>
              <h2 className="font-display text-2xl mb-1" style={{color: "#2C3625"}}>Admin Login</h2>
              <div className="text-sm mb-5" style={{color: "#5C6853"}}>Sign in to your admin dashboard</div>
              <label className="label">Email</label>
              <input data-testid="admin-email-input" className="input mb-3" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@..." />
              <label className="label">Password</label>
              <input data-testid="admin-password-input" className="input mb-4" type="password" required value={password} onChange={e=>setPassword(e.target.value)} />
              {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg mb-3">{err}</div>}
              <button data-testid="admin-submit-btn" disabled={loading} className="btn btn-primary w-full">
                {loading ? <span className="spinner"/> : "Sign In"}
              </button>
            </form>
          )}

          {mode === "therapist-select" && (
            <div className="stagger">
              <button onClick={() => setMode("choose")} className="text-sm hover:underline mb-3" style={{color: "#5C6853"}}>← Back</button>
              <h2 className="font-display text-2xl mb-1" style={{color: "#2C3625"}}>Therapist Login</h2>
              <div className="text-sm mb-4" style={{color: "#5C6853"}}>Select your name</div>
              <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
                {therapists.length === 0 && <div className="text-sm text-center py-6" style={{color: "#8B9E7A"}}>No therapists available. Contact admin.</div>}
                {therapists.map(t => (
                  <button key={t.id} data-testid={`select-therapist-${t.id}`}
                          onClick={() => { setSelectedT(t); setMode("therapist-pin"); setPin(""); }}
                          className="p-3 rounded-xl border hover:bg-white text-left flex items-center gap-3 transition-all"
                          style={{borderColor: "#E8E4DE"}}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{background: t.color || "#7A8A6A"}}>
                      {t.name?.replace("Ms. ", "").charAt(0)}
                    </div>
                    <div className="flex-1 font-bold">{t.name}</div>
                    <ArrowRight size={18} style={{color: "#8B9E7A"}}/>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "therapist-pin" && selectedT && (
            <div className="stagger">
              <button onClick={() => setMode("therapist-select")} className="text-sm hover:underline mb-3" style={{color: "#5C6853"}}>← Back</button>
              <h2 className="font-display text-2xl mb-1" style={{color: "#2C3625"}}>Secure Access</h2>
              <div className="text-sm mb-4" style={{color: "#5C6853"}}>Hello <strong>{selectedT.name}</strong> — enter your PIN</div>
              <div className="flex justify-center gap-2 mb-5">
                {[0,1,2,3].map(i => (
                  <div key={i} className="w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition"
                       style={{borderColor: pin.length > i ? "#7A8A6A" : "#E8E4DE", background: pin.length > i ? "#E5EBE1" : "white"}}>
                    {pin[i] ? "•" : ""}
                  </div>
                ))}
              </div>
              {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg mb-3 text-center">{err}</div>}
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} data-testid={`pin-${n}`} onClick={() => pin.length<6 && setPin(pin+n)}
                          className="aspect-square rounded-xl text-2xl font-bold active:scale-95 transition-all"
                          style={{background: "#F0E9D8", color: "#2C3625"}}>
                    {n}
                  </button>
                ))}
                <button onClick={() => setPin("")} className="aspect-square rounded-xl border text-sm font-bold active:scale-95 transition" style={{borderColor: "#E8E4DE", color: "#5C6853"}}>Clear</button>
                <button onClick={() => pin.length<6 && setPin(pin+"0")} className="aspect-square rounded-xl text-2xl font-bold active:scale-95 transition" style={{background: "#F0E9D8", color: "#2C3625"}}>0</button>
                <button onClick={() => setPin(pin.slice(0,-1))} className="aspect-square rounded-xl border flex items-center justify-center active:scale-95 transition" style={{borderColor: "#E8E4DE"}}><Backspace size={22} /></button>
              </div>
              <button data-testid="pin-submit-btn" onClick={submitPin} disabled={loading || pin.length<4} className="btn btn-primary w-full mt-4 disabled:opacity-50">
                {loading ? <span className="spinner"/> : "Enter"}
              </button>
              <div className="text-center text-xs mt-3" style={{color: "#8B9E7A"}}>Default PIN is 0000 — admin can change it.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
