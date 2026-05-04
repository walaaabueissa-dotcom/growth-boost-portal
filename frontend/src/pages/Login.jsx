import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import api, { formatErr } from "../api";
import { Plant, ArrowRight, ShieldCheck, UserCircle, Backspace } from "@phosphor-icons/react";

export default function Login() {
  const { loginAdmin, loginTherapist } = useAuth();
  const [mode, setMode] = useState("choose"); // choose | admin | therapist-select | therapist-pin
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
      {/* hero header */}
      <div className="bg-sage-hero text-white py-10 px-6 relative overflow-hidden">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Plant size={32} weight="duotone" color="#FAF0D1" />
          </div>
          <div className="flex-1">
            <div className="text-xs tracking-[0.25em] opacity-80 font-bold">STAFF PORTAL</div>
            <div className="text-2xl font-serif-en font-semibold">Boost Growth</div>
            <div className="text-sm opacity-90">مركز تعزيز النمو · بوابة فريق العمل</div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-8">
          <h1 className="font-serif-en text-4xl md:text-5xl font-semibold leading-tight">
            Each growth begins<br/>with <span className="text-[#F0D88A]">seeds.</span>
          </h1>
          <div className="text-base opacity-90 mt-2">كلّ نموٍ، يبدأ ببذرة</div>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto -mt-8 mb-12 px-4 relative z-10">
        <div className="card p-7">
          {mode === "choose" && (
            <div className="stagger">
              <div className="text-sm text-ink-mute font-bold tracking-wider">WELCOME BACK 👋</div>
              <h2 className="font-serif-en text-2xl text-ink mb-5 mt-1">Sign in to continue</h2>

              <button data-testid="login-as-admin-btn" onClick={() => setMode("admin")}
                      className="w-full mb-3 p-4 rounded-2xl bg-brand text-white flex items-center gap-3 hover:bg-brand-hover transition-all active:scale-[0.99] shadow-md">
                <ShieldCheck size={28} weight="duotone" />
                <div className="flex-1 text-start">
                  <div className="font-bold">Admin / Supervisor</div>
                  <div className="text-xs opacity-80">صلاحيات كاملة · جميع العملاء · التقارير</div>
                </div>
                <ArrowRight size={20} className="rtl:rotate-180" />
              </button>

              <button data-testid="login-as-therapist-btn" onClick={() => setMode("therapist-select")}
                      className="w-full p-4 rounded-2xl bg-cream-warm text-ink flex items-center gap-3 hover:bg-[#E8E0CB] transition-all active:scale-[0.99]">
                <UserCircle size={28} weight="duotone" color="#7A8A6A" />
                <div className="flex-1 text-start">
                  <div className="font-bold">I'm a Therapist</div>
                  <div className="text-xs text-ink-soft">عملائي · أدوات الجلسة</div>
                </div>
                <ArrowRight size={20} className="rtl:rotate-180" />
              </button>

              <div className="text-center text-xs text-ink-mute mt-5">boost-growthsa.com · Staff Access Only</div>
            </div>
          )}

          {mode === "admin" && (
            <form onSubmit={submitAdmin} className="stagger">
              <button type="button" onClick={() => setMode("choose")} className="text-sm text-ink-soft hover:text-brand mb-3">← رجوع</button>
              <h2 className="font-serif-en text-2xl text-ink mb-1">Admin Login</h2>
              <div className="text-sm text-ink-soft mb-5">سجّل دخول إلى لوحة الإدارة</div>
              <label className="block text-sm font-bold text-ink-soft mb-1">البريد الإلكتروني</label>
              <input data-testid="admin-email-input" className="input mb-3" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@..." />
              <label className="block text-sm font-bold text-ink-soft mb-1">كلمة المرور</label>
              <input data-testid="admin-password-input" className="input mb-4" type="password" required value={password} onChange={e=>setPassword(e.target.value)} />
              {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg mb-3">{err}</div>}
              <button data-testid="admin-submit-btn" disabled={loading} className="btn btn-primary w-full">
                {loading ? <span className="spinner"/> : "تسجيل الدخول"}
              </button>
            </form>
          )}

          {mode === "therapist-select" && (
            <div className="stagger">
              <button onClick={() => setMode("choose")} className="text-sm text-ink-soft hover:text-brand mb-3">← رجوع</button>
              <h2 className="font-serif-en text-2xl text-ink mb-1">Therapist Login</h2>
              <div className="text-sm text-ink-soft mb-4">اختاري اسمك</div>
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {therapists.length === 0 && <div className="text-sm text-ink-mute text-center py-6">لا يوجد أخصائيات. تواصل مع الإدارة.</div>}
                {therapists.map(t => (
                  <button key={t.id} data-testid={`select-therapist-${t.id}`}
                          onClick={() => { setSelectedT(t); setMode("therapist-pin"); setPin(""); }}
                          className="p-3 rounded-xl border border-[#E8E4DE] hover:border-brand hover:bg-brand-light/40 text-start flex items-center gap-3 transition-all">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{background: t.color || "#7A8A6A"}}>
                      {t.name?.charAt(0)}
                    </div>
                    <div className="flex-1 font-bold text-ink">{t.name}</div>
                    <ArrowRight size={18} className="text-ink-mute rtl:rotate-180" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "therapist-pin" && selectedT && (
            <div className="stagger">
              <button onClick={() => setMode("therapist-select")} className="text-sm text-ink-soft hover:text-brand mb-3">← رجوع</button>
              <h2 className="font-serif-en text-2xl text-ink mb-1">Secure Access</h2>
              <div className="text-sm text-ink-soft mb-4">مرحبًا <strong>{selectedT.name}</strong> — أدخلي الرقم السري</div>
              <div className="flex justify-center gap-2 mb-5">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold ${pin.length > i ? "border-brand bg-brand-light" : "border-[#E8E4DE] bg-white"}`}>
                    {pin[i] ? "•" : ""}
                  </div>
                ))}
              </div>
              {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg mb-3 text-center">{err}</div>}
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} data-testid={`pin-${n}`} onClick={() => pin.length<6 && setPin(pin+n)}
                          className="aspect-square rounded-xl bg-cream-warm hover:bg-brand-light text-2xl font-bold text-ink active:scale-95 transition">
                    {n}
                  </button>
                ))}
                <button onClick={() => setPin("")} className="aspect-square rounded-xl bg-white border border-[#E8E4DE] hover:border-brand text-sm font-bold text-ink-soft">مسح</button>
                <button onClick={() => pin.length<6 && setPin(pin+"0")} className="aspect-square rounded-xl bg-cream-warm hover:bg-brand-light text-2xl font-bold text-ink">0</button>
                <button onClick={() => setPin(pin.slice(0,-1))} className="aspect-square rounded-xl bg-white border border-[#E8E4DE] hover:border-brand flex items-center justify-center"><Backspace size={22} /></button>
              </div>
              <button data-testid="pin-submit-btn" onClick={submitPin} disabled={loading || pin.length<4} className="btn btn-primary w-full mt-4">
                {loading ? <span className="spinner"/> : "دخول"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
