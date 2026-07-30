import { useState, useEffect, useMemo } from "react";
import {
  Plus, Trash2, Coffee, Utensils, Car, ShoppingBag, Home, Heart,
  MoreHorizontal, Receipt, LogOut,
} from "lucide-react";
import {
  signInWithPopup, signOut, onAuthStateChanged,
} from "firebase/auth";
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { auth, googleProvider, db } from "./firebase";

const CATEGORIES = [
  { id: "food", label: "Food", icon: Utensils, color: "#AC4B2E" },
  { id: "coffee", label: "Coffee", icon: Coffee, color: "#A9832E" },
  { id: "transport", label: "Transport", icon: Car, color: "#33513A" },
  { id: "shopping", label: "Shopping", icon: ShoppingBag, color: "#5B4B8A" },
  { id: "home", label: "Home", icon: Home, color: "#2E5E6B" },
  { id: "health", label: "Health", icon: Heart, color: "#8A3B5B" },
  { id: "other", label: "Other", icon: MoreHorizontal, color: "#6B6558" },
];

function catInfo(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return "TODAY";
  if (diff === 1) return "YESTERDAY";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
}

function formatMoney(n) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const fontImport = `
  @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
  * { box-sizing: border-box; }
  .receipt-edge-top { height: 14px; background: radial-gradient(circle at 10px 0, transparent 8px, #EEEAE0 8.5px) top left / 20px 14px repeat-x; }
  .receipt-edge-bottom { height: 14px; background: radial-gradient(circle at 10px 14px, transparent 8px, #EEEAE0 8.5px) bottom left / 20px 14px repeat-x; }
`;

function LoginScreen({ onLogin, error }) {
  return (
    <div style={{ minHeight: "100vh", background: "#DAD4C4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", padding: 16 }}>
      <style>{fontImport}</style>
      <div style={{ background: "#EEEAE0", padding: "40px 32px", borderRadius: 8, boxShadow: "0 12px 32px -12px rgba(33,31,27,0.35)", maxWidth: 360, width: "100%", textAlign: "center" }}>
        <Receipt size={28} strokeWidth={1.5} color="#57503F" style={{ marginBottom: 12 }} />
        <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 24, fontWeight: 600, color: "#211F1B", marginBottom: 6 }}>Daily Ledger</div>
        <div style={{ fontSize: 13, color: "#8A8371", marginBottom: 28 }}>Sign in to track your expenses</div>
        {error && <div style={{ color: "#AC4B2E", fontSize: 12, marginBottom: 14 }}>{error}</div>}
        <button
          onClick={onLogin}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            background: "#211F1B", color: "#EEEAE0", border: "none", borderRadius: 6, padding: "13px",
            fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, cursor: "pointer",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.8-.4-4.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3c-7.7 0-14.3 4.4-17.7 10.7z"/><path fill="#4CAF50" d="M24 45c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.5 2.5-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.6 40.5 16.3 45 24 45z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.5 5.5C41.4 36.3 45 30.7 45 24c0-1.4-.1-2.8-.4-3.5z"/></svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

function ExpenseTracker({ user }) {
  const [entries, setEntries] = useState([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("food");
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query(collection(db, "users", user.uid, "expenses"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user.uid]);

  const grouped = useMemo(() => {
    const map = {};
    for (const e of entries) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  const todayTotal = useMemo(
    () => entries.filter((e) => e.date === todayStr()).reduce((s, e) => s + e.amount, 0),
    [entries]
  );
  const monthTotal = useMemo(() => {
    const m = todayStr().slice(0, 7);
    return entries.filter((e) => e.date.startsWith(m)).reduce((s, e) => s + e.amount, 0);
  }, [entries]);

  async function addEntry() {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      setError("Enter an amount greater than 0");
      return;
    }
    setError("");
    try {
      await addDoc(collection(db, "users", user.uid, "expenses"), {
        amount: Math.round(val * 100) / 100,
        category,
        note: note.trim(),
        date: todayStr(),
        time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        createdAt: serverTimestamp(),
      });
      setAmount("");
      setNote("");
    } catch (e) {
      setError("Could not save. Try again.");
    }
  }

  async function removeEntry(id) {
    await deleteDoc(doc(db, "users", user.uid, "expenses", id));
  }

  return (
    <div style={{ minHeight: "100vh", background: "#DAD4C4", padding: "32px 16px", fontFamily: "'Inter', sans-serif" }}>
      <style>{fontImport}</style>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, padding: "0 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#57503F" }}>
            <Receipt size={18} strokeWidth={1.75} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: "0.18em" }}>DAILY LEDGER</span>
          </div>
          <button
            onClick={() => signOut(auth)}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#8A8371", fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
          >
            <LogOut size={13} /> {user.displayName?.split(" ")[0] || "Sign out"}
          </button>
        </div>

        <div className="receipt-edge-top" />
        <div style={{ background: "#EEEAE0", padding: "28px 26px", boxShadow: "0 12px 32px -12px rgba(33,31,27,0.35)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22, paddingBottom: 18, borderBottom: "1px dashed #C7C0AE" }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#8A8371", marginBottom: 4 }}>TODAY</div>
              <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 28, fontWeight: 600, color: "#211F1B" }}>${formatMoney(todayTotal)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#8A8371", marginBottom: 4 }}>THIS MONTH</div>
              <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 28, fontWeight: 600, color: "#57503F" }}>${formatMoney(monthTotal)}</div>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
              <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: 22, color: "#57503F" }}>$</span>
              <input
                type="number" inputMode="decimal" placeholder="0.00" value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && addEntry()}
                style={{ flex: 1, border: "none", borderBottom: "2px solid #211F1B", background: "transparent", fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 500, color: "#211F1B", padding: "2px 0" }}
              />
            </div>
            {error && <div style={{ color: "#AC4B2E", fontSize: 12, marginBottom: 10, fontFamily: "'IBM Plex Mono', monospace" }}>{error}</div>}
            <input
              type="text" placeholder="What was it for?" value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEntry()}
              style={{ width: "100%", border: "1px solid #C7C0AE", background: "#F7F4EC", borderRadius: 6, padding: "9px 12px", fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#211F1B", marginBottom: 12 }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = category === c.id;
                return (
                  <button key={c.id} onClick={() => setCategory(c.id)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 20, border: `1px solid ${active ? c.color : "#C7C0AE"}`, background: active ? c.color : "transparent", color: active ? "#F7F4EC" : "#57503F", fontSize: 12, fontFamily: "'Inter', sans-serif", fontWeight: 500, cursor: "pointer" }}>
                    <Icon size={13} strokeWidth={2} /> {c.label}
                  </button>
                );
              })}
            </div>
            <button onClick={addEntry}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#211F1B", color: "#EEEAE0", border: "none", borderRadius: 6, padding: "12px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, letterSpacing: "0.08em", cursor: "pointer" }}>
              <Plus size={15} /> ADD EXPENSE
            </button>
          </div>

          {grouped.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#8A8371", fontSize: 13 }}>No expenses yet. Add your first one above.</div>
          ) : (
            grouped.map(([date, items]) => {
              const dayTotal = items.reduce((s, e) => s + e.amount, 0);
              return (
                <div key={date} style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#8A8371" }}>{formatDateLabel(date)}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#8A8371" }}>${formatMoney(dayTotal)}</span>
                  </div>
                  {items.map((e) => {
                    const c = catInfo(e.category);
                    const Icon = c.icon;
                    return (
                      <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px dotted #C7C0AE" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: c.color + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={13} color={c.color} strokeWidth={2} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, color: "#211F1B", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.note || c.label}</div>
                          <div style={{ fontSize: 11, color: "#8A8371", fontFamily: "'IBM Plex Mono', monospace" }}>{e.time}</div>
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 500, color: "#211F1B" }}>${formatMoney(e.amount)}</div>
                        <button onClick={() => removeEntry(e.id)} aria-label="Delete entry" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#C7C0AE" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        <div className="receipt-edge-bottom" />
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return unsub;
  }, []);

  async function handleLogin() {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError("Sign-in failed. Please try again.");
    }
  }

  if (!ready) return null;
  if (!user) return <LoginScreen onLogin={handleLogin} error={error} />;
  return <ExpenseTracker user={user} />;
}
