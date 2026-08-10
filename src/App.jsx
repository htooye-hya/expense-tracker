import { useState, useEffect, useMemo, useRef } from "react";
import {
  Menu, X, Eye, EyeOff, Plus, Calendar, FileDown, Trash2, LogOut,
  Globe, Tag, CreditCard, Wallet, Bell, ChevronRight, ChevronDown,
  Utensils, Coffee, Car, ShoppingBag, Home, Heart, Zap, Briefcase, Gift,
  MoreHorizontal, ArrowDownCircle, ArrowUpCircle, Receipt, Settings as SettingsIcon,
} from "lucide-react";
import {
  signInWithPopup, signOut, onAuthStateChanged,
} from "firebase/auth";
import {
  doc, collection, addDoc, deleteDoc, onSnapshot, setDoc, getDoc, getDocs, query, orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { auth, googleProvider, db } from "./firebase";

/* ---------- i18n ---------- */
const STR = {
  my: {
    appName: "Daily Ledger", balance: "လက်ကျန်ငွေ", income: "ဝင်ငွေ", expense: "ထွက်ငွေ",
    from: "စတင်မည့်ရက်", to: "ဆုံးမည့်ရက်", exportPdf: "PDF", addTxn: "မှတ်တမ်း အသစ်ထည့်ရန်",
    incomeTab: "ဝင်ငွေ (+)", expenseTab: "ထွက်ငွေ (-)", date: "ရက်စွဲ", amount: "ပမာဏ (KS)",
    category: "အမျိုးအစား", subcategory: "အမျိုးအစားခွဲ", paymentMethod: "ငွေပေးချေမှုပုံစံ",
    note: "မှတ်စု (Optional)", cancel: "မလုပ်တော့ပါ", save: "သိမ်းမည်", noTxns: "မှတ်တမ်း မရှိသေးပါ",
    menu: "မီနူး", language: "ဘာသာစကား", manageCat: "အမျိုးအစားများ စီမံရန်",
    managePm: "ငွေပေးချေမှုပုံစံများ စီမံရန်", budget: "လစဉ် Budget ကန့်သတ်ချက်", signOut: "အကောင့်ထွက်ရန်",
    budgetWarn: "ဒီလ ကုန်ကျစရိတ်သည် Budget ကို ကျော်လွန်နေပါသည်", addCategory: "အမျိုးအစားအသစ်",
    addSub: "အမျိုးအစားခွဲ အသစ်", addPm: "ပုံစံအသစ်", expenseCats: "ထွက်ငွေ အမျိုးအစားများ",
    incomeCats: "ဝင်ငွေ အမျိုးအစားများ", back: "ပြန်သွားမည်", saveBudget: "Budget သိမ်းမည်",
    total: "စုစုပေါင်း", today: "ယနေ့", month: "ဒီလ",
  },
  en: {
    appName: "Daily Ledger", balance: "Balance", income: "Income", expense: "Expense",
    from: "From", to: "To", exportPdf: "PDF", addTxn: "Add Transaction",
    incomeTab: "Income (+)", expenseTab: "Expense (-)", date: "Date", amount: "Amount (KS)",
    category: "Category", subcategory: "Sub-category", paymentMethod: "Payment Method",
    note: "Note (Optional)", cancel: "Cancel", save: "Save", noTxns: "No transactions yet",
    menu: "Menu", language: "Language", manageCat: "Manage Categories",
    managePm: "Manage Payment Methods", budget: "Monthly Budget Limit", signOut: "Sign Out",
    budgetWarn: "This month's expenses have exceeded your budget", addCategory: "New category",
    addSub: "New sub-category", addPm: "New method", expenseCats: "Expense Categories",
    incomeCats: "Income Categories", back: "Back", saveBudget: "Save Budget",
    total: "Total", today: "Today", month: "This Month",
  },
};

const ICONS = { Utensils, Coffee, Car, ShoppingBag, Home, Heart, Zap, Wallet, Briefcase, Gift, MoreHorizontal };
const ICON_KEYS = Object.keys(ICONS);

const DEFAULT_CATS = {
  expense: [
    { id: "food", name: "အစားအသောက်", icon: "Utensils", subs: ["မနက်စာ", "နေ့လည်စာ", "ညစာ", "သရေစာ"] },
    { id: "transport", name: "သွားလာစရိတ်", icon: "Car", subs: ["ဆီဖိုး", "ကားခ"] },
    { id: "bills", name: "မီတာနှင့် အထွေထွေကျသင့်ငွေ", icon: "Zap", subs: ["လျှပ်စစ်မီတာ", "ရေဖိုး", "အင်တာနက်"] },
    { id: "shopping", name: "ဈေးဝယ်ခြင်း", icon: "ShoppingBag", subs: [] },
    { id: "home", name: "အိမ်သုံးစရိတ်", icon: "Home", subs: [] },
    { id: "health", name: "ကျန်းမာရေး", icon: "Heart", subs: [] },
    { id: "other-ex", name: "အခြား", icon: "MoreHorizontal", subs: [] },
  ],
  income: [
    { id: "salary", name: "လစာ", icon: "Wallet", subs: [] },
    { id: "business", name: "စီးပွားရေး", icon: "Briefcase", subs: [] },
    { id: "gift", name: "လက်ဆောင်", icon: "Gift", subs: [] },
    { id: "other-in", name: "အခြား", icon: "MoreHorizontal", subs: [] },
  ],
};
const DEFAULT_PMS = ["CASH", "KBZ Pay", "Wave Pay", "Bank"];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmt(n) { return (n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function catIcon(key) { return ICONS[key] || MoreHorizontal; }

const fontImport = `
  @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
  *{box-sizing:border-box}
  .receipt-edge-top{height:14px;background:radial-gradient(circle at 10px 0,transparent 8px,#EEEAE0 8.5px) top left/20px 14px repeat-x}
  .receipt-edge-bottom{height:14px;background:radial-gradient(circle at 10px 14px,transparent 8px,#EEEAE0 8.5px) bottom left/20px 14px repeat-x}
  .sheet{animation:slideUp .22s ease}
  @keyframes slideUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}
  .drawer{animation:slideIn .2s ease}
  @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
  select{-webkit-appearance:none;appearance:none}
`;

/* ---------- Login Screen ---------- */
function LoginScreen({ onLogin, error }) {
  return (
    <div style={{ minHeight: "100vh", background: "#DAD4C4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", padding: 16 }}>
      <style>{fontImport}</style>
      <div style={{ background: "#EEEAE0", padding: "40px 32px", borderRadius: 8, boxShadow: "0 12px 32px -12px rgba(33,31,27,.35)", maxWidth: 360, width: "100%", textAlign: "center" }}>
        <Receipt size={28} strokeWidth={1.5} color="#57503F" style={{ marginBottom: 12 }} />
        <div style={{ fontFamily: "'Source Serif 4',serif", fontSize: 24, fontWeight: 600, color: "#211F1B", marginBottom: 6 }}>Daily Ledger</div>
        <div style={{ fontSize: 13, color: "#8A8371", marginBottom: 28 }}>Sign in to track your expenses</div>
        {error && <div style={{ color: "#AC4B2E", fontSize: 12, marginBottom: 14 }}>{error}</div>}
        <button onClick={onLogin} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#211F1B", color: "#EEEAE0", border: "none", borderRadius: 6, padding: 13, fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.8-.4-4.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3c-7.7 0-14.3 4.4-17.7 10.7z" /><path fill="#4CAF50" d="M24 45c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.5 2.5-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.6 40.5 16.3 45 24 45z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.5 5.5C41.4 36.3 45 30.7 45 24c0-1.4-.1-2.8-.4-3.5z" /></svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

/* ---------- Drawer ---------- */
function Drawer({ open, onClose, user, lang, setLang, t, onNav, onSignOut }) {
  if (!open) return null;
  const Item = ({ icon: Icon, label, onClick, danger }) => (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 18px", background: "none", border: "none", textAlign: "left", cursor: "pointer", color: danger ? "#AC4B2E" : "#211F1B", fontSize: 14, fontFamily: "'Inter',sans-serif" }}>
      <Icon size={17} strokeWidth={1.8} /> <span style={{ flex: 1 }}>{label}</span>
      {!danger && <ChevronRight size={15} color="#C7C0AE" />}
    </button>
  );
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,18,15,.45)" }} />
      <div className="drawer" style={{ position: "relative", width: 280, maxWidth: "82vw", background: "#EEEAE0", height: "100%", boxShadow: "4px 0 24px rgba(0,0,0,.2)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "26px 18px 18px", borderBottom: "1px solid #DCD4BF" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#211F1B", color: "#EEEAE0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Source Serif 4',serif", fontSize: 18, marginBottom: 10 }}>
            {(user.displayName || "U")[0]}
          </div>
          <div style={{ fontFamily: "'Source Serif 4',serif", fontSize: 16, fontWeight: 600, color: "#211F1B" }}>{user.displayName}</div>
          <div style={{ fontSize: 12, color: "#8A8371" }}>{user.email}</div>
        </div>
        <div style={{ display: "flex", gap: 6, padding: 14 }}>
          {["my", "en"].map(l => (
            <button key={l} onClick={() => setLang(l)} style={{ flex: 1, padding: "8px 0", borderRadius: 20, border: `1px solid ${lang === l ? "#211F1B" : "#C7C0AE"}`, background: lang === l ? "#211F1B" : "transparent", color: lang === l ? "#EEEAE0" : "#57503F", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {l === "my" ? "မြန်မာ" : "English"}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", paddingTop: 4 }}>
          <Item icon={Tag} label={t.manageCat} onClick={() => onNav("categories")} />
          <Item icon={CreditCard} label={t.managePm} onClick={() => onNav("paymentmethods")} />
          <Item icon={SettingsIcon} label={t.budget} onClick={() => onNav("budget")} />
        </div>
        <div style={{ borderTop: "1px solid #DCD4BF", padding: "8px 0" }}>
          <Item icon={LogOut} label={t.signOut} danger onClick={onSignOut} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Categories management screen ---------- */
function CategoriesScreen({ t, categories, setCategories, onBack }) {
  const [type, setType] = useState("expense");
  const [newName, setNewName] = useState("");
  const [openCat, setOpenCat] = useState(null);
  const [newSub, setNewSub] = useState("");
  const list = categories[type];

  function addCategory() {
    if (!newName.trim()) return;
    const icon = ICON_KEYS[list.length % ICON_KEYS.length];
    setCategories(prev => ({ ...prev, [type]: [...prev[type], { id: uid(), name: newName.trim(), icon, subs: [] }] }));
    setNewName("");
  }
  function removeCategory(id) {
    setCategories(prev => ({ ...prev, [type]: prev[type].filter(c => c.id !== id) }));
  }
  function addSub(catId) {
    if (!newSub.trim()) return;
    setCategories(prev => ({ ...prev, [type]: prev[type].map(c => c.id === catId ? { ...c, subs: [...c.subs, newSub.trim()] } : c) }));
    setNewSub("");
  }
  function removeSub(catId, sub) {
    setCategories(prev => ({ ...prev, [type]: prev[type].map(c => c.id === catId ? { ...c, subs: c.subs.filter(s => s !== sub) } : c) }));
  }

  return (
    <div style={{ minHeight: "100vh", background: "#DAD4C4", padding: "20px 16px", fontFamily: "'Inter',sans-serif" }}>
      <style>{fontImport}</style>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#57503F", fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
          <ChevronRight size={15} style={{ transform: "rotate(180deg)" }} /> {t.back}
        </button>
        <div style={{ background: "#EEEAE0", borderRadius: 10, padding: 20, boxShadow: "0 12px 32px -12px rgba(33,31,27,.35)" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {["expense", "income"].map(ty => (
              <button key={ty} onClick={() => setType(ty)} style={{ flex: 1, padding: "9px 0", borderRadius: 20, border: `1px solid ${type === ty ? "#211F1B" : "#C7C0AE"}`, background: type === ty ? "#211F1B" : "transparent", color: type === ty ? "#EEEAE0" : "#57503F", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                {ty === "expense" ? t.expenseCats : t.incomeCats}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t.addCategory} style={{ flex: 1, border: "1px solid #C7C0AE", background: "#F7F4EC", borderRadius: 6, padding: "9px 12px", fontSize: 13.5 }} />
            <button onClick={addCategory} style={{ background: "#211F1B", color: "#EEEAE0", border: "none", borderRadius: 6, padding: "0 14px", cursor: "pointer" }}><Plus size={16} /></button>
          </div>
          {list.map(c => {
            const Icon = catIcon(c.icon);
            const isOpen = openCat === c.id;
            return (
              <div key={c.id} style={{ border: "1px solid #DCD4BF", borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer" }} onClick={() => setOpenCat(isOpen ? null : c.id)}>
                  <Icon size={16} color="#57503F" />
                  <span style={{ flex: 1, fontSize: 13.5, color: "#211F1B" }}>{c.name}</span>
                  <span style={{ fontSize: 11, color: "#8A8371" }}>{c.subs.length}</span>
                  <ChevronDown size={15} color="#8A8371" style={{ transform: isOpen ? "rotate(180deg)" : "none" }} />
                  <button onClick={(e) => { e.stopPropagation(); removeCategory(c.id); }} style={{ background: "none", border: "none", color: "#C7C0AE", cursor: "pointer" }}><Trash2 size={14} /></button>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 12px 12px", background: "#F7F4EC" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, marginTop: 8 }}>
                      {c.subs.map(s => (
                        <span key={s} style={{ display: "flex", alignItems: "center", gap: 4, background: "#EEEAE0", border: "1px solid #DCD4BF", borderRadius: 14, padding: "4px 8px", fontSize: 11.5 }}>
                          {s} <X size={11} style={{ cursor: "pointer" }} onClick={() => removeSub(c.id, s)} />
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input value={newSub} onChange={e => setNewSub(e.target.value)} placeholder={t.addSub} style={{ flex: 1, border: "1px solid #C7C0AE", background: "#EEEAE0", borderRadius: 6, padding: "6px 10px", fontSize: 12.5 }} />
                      <button onClick={() => addSub(c.id)} style={{ background: "#211F1B", color: "#EEEAE0", border: "none", borderRadius: 6, padding: "0 12px", cursor: "pointer" }}><Plus size={13} /></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Payment methods screen ---------- */
function PaymentMethodsScreen({ t, paymentMethods, setPaymentMethods, onBack }) {
  const [name, setName] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: "#DAD4C4", padding: "20px 16px", fontFamily: "'Inter',sans-serif" }}>
      <style>{fontImport}</style>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#57503F", fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
          <ChevronRight size={15} style={{ transform: "rotate(180deg)" }} /> {t.back}
        </button>
        <div style={{ background: "#EEEAE0", borderRadius: 10, padding: 20, boxShadow: "0 12px 32px -12px rgba(33,31,27,.35)" }}>
          <div style={{ fontFamily: "'Source Serif 4',serif", fontSize: 17, marginBottom: 14 }}>{t.managePm}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t.addPm} style={{ flex: 1, border: "1px solid #C7C0AE", background: "#F7F4EC", borderRadius: 6, padding: "9px 12px", fontSize: 13.5 }} />
            <button onClick={() => { if (name.trim()) { setPaymentMethods(p => [...p, name.trim()]); setName(""); } }} style={{ background: "#211F1B", color: "#EEEAE0", border: "none", borderRadius: 6, padding: "0 14px", cursor: "pointer" }}><Plus size={16} /></button>
          </div>
          {paymentMethods.map(pm => (
            <div key={pm} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4px", borderBottom: "1px dotted #C7C0AE" }}>
              <Wallet size={15} color="#57503F" />
              <span style={{ flex: 1, fontSize: 13.5 }}>{pm}</span>
              <button onClick={() => setPaymentMethods(p => p.filter(x => x !== pm))} style={{ background: "none", border: "none", color: "#C7C0AE", cursor: "pointer" }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Budget screen ---------- */
function BudgetScreen({ t, budget, setBudget, onBack }) {
  const [val, setVal] = useState(budget || "");
  return (
    <div style={{ minHeight: "100vh", background: "#DAD4C4", padding: "20px 16px", fontFamily: "'Inter',sans-serif" }}>
      <style>{fontImport}</style>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#57503F", fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
          <ChevronRight size={15} style={{ transform: "rotate(180deg)" }} /> {t.back}
        </button>
        <div style={{ background: "#EEEAE0", borderRadius: 10, padding: 20, boxShadow: "0 12px 32px -12px rgba(33,31,27,.35)" }}>
          <div style={{ fontFamily: "'Source Serif 4',serif", fontSize: 17, marginBottom: 14 }}>{t.budget}</div>
          <input type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="0" style={{ width: "100%", border: "1px solid #C7C0AE", background: "#F7F4EC", borderRadius: 6, padding: "10px 12px", fontSize: 15, marginBottom: 14, fontFamily: "'IBM Plex Mono',monospace" }} />
          <button onClick={() => { setBudget(parseFloat(val) || 0); onBack(); }} style={{ width: "100%", background: "#211F1B", color: "#EEEAE0", border: "none", borderRadius: 6, padding: 12, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t.saveBudget}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Add Transaction Sheet ---------- */
function AddSheet({ t, categories, paymentMethods, onClose, onSave }) {
  const [type, setType] = useState("expense");
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState("");
  const list = categories[type];
  const [catId, setCatId] = useState(list[0]?.id || "");
  const [sub, setSub] = useState("");
  const [pm, setPm] = useState(paymentMethods[0] || "CASH");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { setCatId(categories[type][0]?.id || ""); setSub(""); }, [type]);
  const activeCat = categories[type].find(c => c.id === catId);

  function save() {
    const val = parseFloat(amount);
    if (!val || val <= 0) { setError(t.amount); return; }
    onSave({ type, date, amount: val, categoryId: catId, categoryName: activeCat?.name || "", subcategory: sub, paymentMethod: pm, note: note.trim() });
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,18,15,.45)" }} />
      <div className="sheet" style={{ position: "relative", width: "100%", maxWidth: 460, margin: "0 auto", background: "#EEEAE0", borderRadius: "16px 16px 0 0", padding: "20px 20px 28px", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, background: "#DCD4BF", borderRadius: 3, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <button onClick={() => setType("income")} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: type === "income" ? "#33513A" : "#E3DDCE", color: type === "income" ? "#EEEAE0" : "#57503F", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t.incomeTab}</button>
          <button onClick={() => setType("expense")} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: type === "expense" ? "#AC4B2E" : "#E3DDCE", color: type === "expense" ? "#EEEAE0" : "#57503F", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t.expenseTab}</button>
        </div>

        <label style={{ fontSize: 11, color: "#8A8371", fontFamily: "'IBM Plex Mono',monospace" }}>{t.date}</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "100%", border: "1px solid #C7C0AE", background: "#F7F4EC", borderRadius: 6, padding: "9px 12px", fontSize: 13.5, margin: "5px 0 12px" }} />

        <label style={{ fontSize: 11, color: "#8A8371", fontFamily: "'IBM Plex Mono',monospace" }}>{t.amount}</label>
        <input type="number" inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value); setError(""); }} placeholder="0.00" style={{ width: "100%", border: "none", borderBottom: "2px solid #211F1B", background: "transparent", fontFamily: "'IBM Plex Mono',monospace", fontSize: 24, fontWeight: 500, padding: "5px 0", margin: "5px 0 12px" }} />
        {error && <div style={{ color: "#AC4B2E", fontSize: 12, marginBottom: 10 }}>{error}</div>}

        <label style={{ fontSize: 11, color: "#8A8371", fontFamily: "'IBM Plex Mono',monospace" }}>{t.category}</label>
        <select value={catId} onChange={e => { setCatId(e.target.value); setSub(""); }} style={{ width: "100%", border: "1px solid #C7C0AE", background: "#F7F4EC", borderRadius: 6, padding: "9px 12px", fontSize: 13.5, margin: "5px 0 12px" }}>
          {list.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {activeCat && activeCat.subs.length > 0 && (
          <>
            <label style={{ fontSize: 11, color: "#8A8371", fontFamily: "'IBM Plex Mono',monospace" }}>{t.subcategory}</label>
            <select value={sub} onChange={e => setSub(e.target.value)} style={{ width: "100%", border: "1px solid #C7C0AE", background: "#F7F4EC", borderRadius: 6, padding: "9px 12px", fontSize: 13.5, margin: "5px 0 12px" }}>
              <option value="">—</option>
              {activeCat.subs.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </>
        )}

        <label style={{ fontSize: 11, color: "#8A8371", fontFamily: "'IBM Plex Mono',monospace" }}>{t.paymentMethod}</label>
        <select value={pm} onChange={e => setPm(e.target.value)} style={{ width: "100%", border: "1px solid #C7C0AE", background: "#F7F4EC", borderRadius: 6, padding: "9px 12px", fontSize: 13.5, margin: "5px 0 12px" }}>
          {paymentMethods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <input value={note} onChange={e => setNote(e.target.value)} placeholder={t.note} style={{ width: "100%", border: "1px solid #C7C0AE", background: "#F7F4EC", borderRadius: 6, padding: "9px 12px", fontSize: 13.5, margin: "5px 0 16px" }} />

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 6, border: "1px solid #C7C0AE", background: "transparent", color: "#57503F", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t.cancel}</button>
          <button onClick={save} style={{ flex: 1, padding: 12, borderRadius: 6, border: "none", background: "#211F1B", color: "#EEEAE0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t.save}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard({ t, lang, user, txns, categories, paymentMethods, budget, onAddClick, onDeleteTxn, dateFrom, dateTo, setDateFrom, setDateTo, showBalance, setShowBalance, onExportPdf, onMenu }) {
  const filtered = useMemo(() => txns.filter(tx => (!dateFrom || tx.date >= dateFrom) && (!dateTo || tx.date <= dateTo)), [txns, dateFrom, dateTo]);
  const income = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = txns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0) - txns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const monthKey = todayStr().slice(0, 7);
  const monthExpense = txns.filter(t => t.type === "expense" && t.date.startsWith(monthKey)).reduce((s, t) => s + t.amount, 0);
  const overBudget = budget > 0 && monthExpense > budget;

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(tx => { (map[tx.date] = map[tx.date] || []).push(tx); });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  return (
    <div style={{ minHeight: "100vh", background: "#DAD4C4", padding: "20px 16px 90px", fontFamily: "'Inter',sans-serif" }}>
      <style>{fontImport}</style>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, padding: "0 2px" }}>
          <button onClick={onMenu} style={{ background: "none", border: "none", cursor: "pointer", color: "#211F1B" }}><Menu size={22} /></button>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#57503F" }}>
            <Receipt size={16} /> <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: "0.16em" }}>{t.appName.toUpperCase()}</span>
          </div>
          <Bell size={19} color="#8A8371" />
        </div>

        {overBudget && (
          <div style={{ background: "#F5E3DC", border: "1px solid #E3B39C", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "#8A3B1F", marginBottom: 12 }}>⚠ {t.budgetWarn}</div>
        )}

        <div className="receipt-edge-top" />
        <div style={{ background: "#EEEAE0", padding: "22px 22px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: "0.12em", color: "#8A8371", marginBottom: 4 }}>{t.balance.toUpperCase()}</div>
              <div style={{ fontFamily: "'Source Serif 4',serif", fontSize: 30, fontWeight: 700, color: "#211F1B" }}>{showBalance ? fmt(balance) + " KS" : "••••••"}</div>
            </div>
            <button onClick={() => setShowBalance(v => !v)} style={{ background: "none", border: "none", color: "#8A8371", cursor: "pointer", marginTop: 4 }}>
              {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, background: "#E9F1EA", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#33513A", fontSize: 11, marginBottom: 3 }}><ArrowDownCircle size={13} /> {t.income}</div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, color: "#33513A" }}>+{fmt(income)}</div>
            </div>
            <div style={{ flex: 1, background: "#F5E3DC", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#AC4B2E", fontSize: 11, marginBottom: 3 }}><ArrowUpCircle size={13} /> {t.expense}</div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, color: "#AC4B2E" }}>-{fmt(expense)}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#8A8371", marginBottom: 3 }}>{t.from}</div>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: "100%", border: "1px solid #C7C0AE", background: "#F7F4EC", borderRadius: 6, padding: "7px 8px", fontSize: 12 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#8A8371", marginBottom: 3 }}>{t.to}</div>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: "100%", border: "1px solid #C7C0AE", background: "#F7F4EC", borderRadius: 6, padding: "7px 8px", fontSize: 12 }} />
            </div>
            <button onClick={() => onExportPdf(filtered, income, expense)} title={t.exportPdf} style={{ alignSelf: "flex-end", background: "#211F1B", color: "#EEEAE0", border: "none", borderRadius: 6, padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
              <FileDown size={14} /> PDF
            </button>
          </div>
        </div>

        <div style={{ background: "#EEEAE0", padding: "6px 22px 20px" }}>
          {grouped.length === 0 ? (
            <div style={{ textAlign: "center", padding: "26px 0", color: "#8A8371", fontSize: 13 }}>{t.noTxns}</div>
          ) : grouped.map(([date, items]) => {
            const dayTotal = items.reduce((s, tx) => s + (tx.type === "income" ? tx.amount : -tx.amount), 0);
            return (
              <div key={date} style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: "0.1em", color: "#8A8371" }}>{date}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: dayTotal >= 0 ? "#33513A" : "#AC4B2E" }}>{dayTotal >= 0 ? "+" : ""}{fmt(dayTotal)}</span>
                </div>
                {items.map(tx => {
                  const cat = categories[tx.type].find(c => c.id === tx.categoryId);
                  const Icon = catIcon(cat?.icon);
                  const positive = tx.type === "income";
                  return (
                    <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px dotted #C7C0AE" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: positive ? "#33513A22" : "#AC4B2E22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={13} color={positive ? "#33513A" : "#AC4B2E"} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.categoryName}{tx.subcategory ? " • " + tx.subcategory : ""}</div>
                        <div style={{ fontSize: 10.5, color: "#8A8371" }}>{tx.paymentMethod}{tx.note ? " — " + tx.note : ""}</div>
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13.5, fontWeight: 500, color: positive ? "#33513A" : "#AC4B2E" }}>{positive ? "+" : "-"}{fmt(tx.amount)}</div>
                      <button onClick={() => onDeleteTxn(tx.id)} style={{ background: "none", border: "none", color: "#C7C0AE", cursor: "pointer" }}><Trash2 size={13} /></button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="receipt-edge-bottom" />
      </div>

      <button onClick={onAddClick} style={{ position: "fixed", bottom: 24, right: "50%", transform: "translateX(230px)", width: 54, height: 54, borderRadius: "50%", background: "#211F1B", color: "#EEEAE0", border: "none", boxShadow: "0 8px 20px rgba(0,0,0,.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <Plus size={24} />
      </button>
    </div>
  );
}

/* ---------- Main App ---------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [lang, setLang] = useState(() => (typeof localStorage !== "undefined" && localStorage.getItem("ledger_lang")) || "my");
  const [txns, setTxns] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATS);
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PMS);
  const [budget, setBudget] = useState(0);
  const [view, setView] = useState("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showBalance, setShowBalance] = useState(true);
  const settingsLoaded = useRef(false);
  const t = STR[lang];

  useEffect(() => { if (typeof localStorage !== "undefined") localStorage.setItem("ledger_lang", lang); }, [lang]);

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setReady(true); }), []);

  useEffect(() => {
    if (!user) return;
    const unsubTxns = onSnapshot(query(collection(db, "users", user.uid, "transactions"), orderBy("createdAt", "desc")), snap => {
      setTxns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const loadSettings = async () => {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data().categories) {
        const d = snap.data();
        setCategories(d.categories || DEFAULT_CATS);
        setPaymentMethods(d.paymentMethods || DEFAULT_PMS);
        setBudget(d.budget || 0);
      } else {
        await setDoc(ref, { categories: DEFAULT_CATS, paymentMethods: DEFAULT_PMS, budget: 0 }, { merge: true });
      }
      // migrate legacy 'expenses' subcollection (from earlier version) if present
      try {
        const legacy = await getDocs(collection(db, "users", user.uid, "expenses"));
        if (!legacy.empty) {
          const existing = await getDocs(collection(db, "users", user.uid, "transactions"));
          if (existing.empty) {
            for (const docSnap of legacy.docs) {
              const e = docSnap.data();
              await addDoc(collection(db, "users", user.uid, "transactions"), {
                type: "expense", amount: e.amount || 0, date: e.date || todayStr(),
                categoryId: "other-ex", categoryName: e.category || "Other", subcategory: "",
                paymentMethod: "CASH", note: e.note || "", createdAt: serverTimestamp(),
              });
            }
          }
        }
      } catch (_) { /* ignore */ }
      settingsLoaded.current = true;
    };
    loadSettings();
    return unsubTxns;
  }, [user]);

  useEffect(() => {
    if (!user || !settingsLoaded.current) return;
    const h = setTimeout(() => {
      setDoc(doc(db, "users", user.uid), { categories, paymentMethods, budget }, { merge: true }).catch(() => {});
    }, 800);
    return () => clearTimeout(h);
  }, [categories, paymentMethods, budget, user]);

  async function handleLogin() {
    setError("");
    try { await signInWithPopup(auth, googleProvider); } catch (e) { setError("Sign-in failed."); }
  }
  async function handleAddTxn(data) {
    if (!user) return;
    await addDoc(collection(db, "users", user.uid, "transactions"), { ...data, createdAt: serverTimestamp() });
    setSheetOpen(false);
  }
  async function handleDeleteTxn(id) {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "transactions", id));
  }
  async function handleExportPdf(filtered, income, expense) {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFontSize(16); pdf.text(t.appName, 14, 16);
    pdf.setFontSize(10); pdf.text(`${t.income}: ${fmt(income)}   ${t.expense}: ${fmt(expense)}`, 14, 24);
    let y = 34;
    pdf.setFontSize(9);
    filtered.forEach(tx => {
      const line = `${tx.date}  ${tx.type === "income" ? "+" : "-"}${fmt(tx.amount)}  ${tx.categoryName}${tx.subcategory ? "/" + tx.subcategory : ""}  ${tx.paymentMethod}  ${tx.note || ""}`;
      if (y > 280) { pdf.addPage(); y = 16; }
      pdf.text(line, 14, y);
      y += 6;
    });
    pdf.save("daily-ledger.pdf");
  }

  if (!ready) return null;
  if (!user) return <LoginScreen onLogin={handleLogin} error={error} />;

  if (view === "categories") return <CategoriesScreen t={t} categories={categories} setCategories={setCategories} onBack={() => setView("dashboard")} />;
  if (view === "paymentmethods") return <PaymentMethodsScreen t={t} paymentMethods={paymentMethods} setPaymentMethods={setPaymentMethods} onBack={() => setView("dashboard")} />;
  if (view === "budget") return <BudgetScreen t={t} budget={budget} setBudget={setBudget} onBack={() => setView("dashboard")} />;

  return (
    <>
      <Dashboard
        t={t} lang={lang} user={user} txns={txns} categories={categories} paymentMethods={paymentMethods} budget={budget}
        onAddClick={() => setSheetOpen(true)} onDeleteTxn={handleDeleteTxn}
        dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo}
        showBalance={showBalance} setShowBalance={setShowBalance}
        onExportPdf={handleExportPdf} onMenu={() => setDrawerOpen(true)}
      />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} lang={lang} setLang={setLang} t={t}
        onNav={(v) => { setView(v); setDrawerOpen(false); }} onSignOut={() => signOut(auth)} />
      {sheetOpen && <AddSheet t={t} categories={categories} paymentMethods={paymentMethods} onClose={() => setSheetOpen(false)} onSave={handleAddTxn} />}
    </>
  );
}
