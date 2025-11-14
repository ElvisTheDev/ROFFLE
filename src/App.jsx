import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

/* ================= CORE WHEEL CONSTANTS ================= */
const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°
const START_OFFSET = -90; // pointer at top

/* Base (Free) spin settings */
const BASE_CAP = 20;
const BASE_REGEN_MS = 10 * 60 * 1000; // 10 minutes (non-additive!)
const TICK_MS = 1000;
const API_BASE = "https://roffle-bot.onrender.com";

/* Premium tiers (names per your mapping) */
const TIERS = {
  free: { key: "free", name: "Free",              regenMult: 1, cap: 20,  prizeMult: 1,  inviteBonus: 0 },
  plus: { key: "plus", name: "$ROF Premium⚡️",   regenMult: 2, cap: 40,  prizeMult: 2,  inviteBonus: 50 },
  pro:  { key: "pro",  name: "$ROF Plus⭐️",      regenMult: 3, cap: 60,  prizeMult: 3,  inviteBonus: 75 },
  prem: { key: "prem", name: "$ROF Pro👑",        regenMult: 5, cap: 100, prizeMult: 5,  inviteBonus: 100 },
};
const TEST_PRICE_COINS = 1;

/* Tier ranking: used to prevent downgrade */
const TIER_ORDER = { free: 0, plus: 1, pro: 2, prem: 3 };

/* RNG helpers (cryptographically strong) */
function randUint32() {
  const a = new Uint32Array(1);
  window.crypto.getRandomValues(a);
  return a[0];
}
function randFloat() {
  return randUint32() / 0xffffffff;
}
function randInt(min, max) {
  const span = max - min + 1;
  const limit = Math.floor(0xffffffff / span) * span;
  let r;
  do {
    r = randUint32();
  } while (r >= limit);
  return min + (r % span);
}

/* Payouts (base values before multiplier) */
function buildSlots() {
  const arr = Array(SEGMENTS_TOTAL).fill(null);
  // Section 1 -> 100 (MAX)
  arr[0] = { amount: 100, label: "100", type: "max" };

  const put = (idxs, amt) =>
    idxs.forEach((n) => {
      const i = n - 1;
      if (!arr[i]) arr[i] = { amount: amt };
      arr[i].label = String(amt);
    });
  // Even positions (2,4,...,24) -> 1
  put([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24], 1);
  // 3,7,11,15,19,23 -> 2
  put([3, 7, 11, 15, 19, 23], 2);
  // 5,9,13 -> 5
  put([5, 9, 13], 5);
  // 17,25 -> 20
  put([17, 25], 20);
  // 21 -> 50
  put([21], 50);

  return arr;
}

/* Geometry helpers (LOCAL around (0,0)) */
function polarToCartesianLocal(r, aDeg) {
  const a = (aDeg * Math.PI) / 180;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}
function wedgePathLocal(r, startDeg, endDeg) {
  const start = polarToCartesianLocal(r, startDeg);
  const end = polarToCartesianLocal(r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M 0 0 L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

/* Time */
function formatMs(ms) {
  if (!ms || ms <= 0) return "Ready";
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${m}:${pad(r)}`;
}

/* Easing */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/* Assets */
const CENTER_LOGO_SRC = "/logo.png";
const BRAND_LOGO_SRC = "/rof-lg.png";
const ROF_ICON_SRC = "/rof-bn.png";

/* ===== Avatar helpers & fallback colors ===== */
const DEMO_AVATAR_COLORS = [
  "#6c5ce7","#00cec9","#fd79a8","#ffeaa7",
  "#55efc4","#a29bfe","#fab1a0","#81ecec","#ffd6a5"
];

function initials(name){
  return name.split(" ").map(s=>s[0]).join("").slice(0,2).toUpperCase();
}
function randomItem(a){ return a[Math.floor(Math.random()*a.length)] }

/* Tier badges for UI */
function TierBadge({tierKey}){
  if (tierKey === "free" || !tierKey) return <span className="badge free">No status</span>;
  if (tierKey === "plus") return <span className="badge premium">Premium⚡️</span>;
  if (tierKey === "pro")  return <span className="badge plus">Plus⭐️</span>;
  return <span className="badge pro">Pro👑</span>;
}

/* --------- Earn helpers --------- */
function getTGUser(){
  const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (!u) return null;
  return {
    id: u.id,
    name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || `User ${u.id}`,
    username: u.username ? `@${u.username}` : "",
    photo: u.photo_url || "",
  };
}
function getOrCreateMyRefCode(){
  try{
    const tgUser = getTGUser();
    const key = "rof_ref_code";
    let code = localStorage.getItem(key);
    if (!code) {
      const seed = tgUser?.id ? String(tgUser.id) : String(Math.floor(Math.random()*1e10));
      code = Number.parseInt(seed,10).toString(36);
      localStorage.setItem(key, code);
    }
    return code;
  }catch{ return Math.floor(Math.random()*1e9).toString(36); }
}
function readReferrals(){
  try { return JSON.parse(localStorage.getItem("rof_referrals")||"[]"); } catch { return []; }
}
function writeReferrals(arr){
  try { localStorage.setItem("rof_referrals", JSON.stringify(arr)); } catch {}
}
function addReferralRow(row){
  const arr = readReferrals();
  arr.unshift(row);
  writeReferrals(arr.slice(0,500));
}

/* ==================== Top100 Screen (LIVE) ==================== */
const TopScreen = React.memo(function TopScreen({ lbTab, onTabChange, myTgId }) {
  const [players, setPlayers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [errMsg, setErrMsg] = useState(null);
  const [loadedPlayers, setLoadedPlayers] = useState(false);
  const [loadedInvites, setLoadedInvites] = useState(false);

  function Avatar({ name, photo }) {
    if (photo) return <img className="lb-avatar" src={photo} alt={name} />;
    const bg = randomItem(DEMO_AVATAR_COLORS);
    return (
      <div className="lb-avatar fallback" style={{ background: bg }}>
        {initials(name)}
      </div>
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchPlayers() {
      if (loadedPlayers) return; // already loaded once
      setErrMsg(null);
      try {
        const { data, error } = await supabase
          .from("roff_users")
          .select("*")
          .order("balance", { ascending: false })
          .limit(100);

        if (error) throw error;
        if (cancelled) return;

        const mapped = (data || []).map((row) => ({
          id: row.tg_id,
          name: row.full_name || row.username || `User ${row.tg_id}`,
          username: row.username ? `@${row.username}` : "",
          photo: row.photo_url || "",
          balance: row.balance ?? 0,
          invites: row.invites ?? 0,
          tier: row.premium_tier || "free",
        }));

        setPlayers(mapped);
        setLoadedPlayers(true);
      } catch (e) {
        console.error("Top players error", e);
        if (!cancelled) setErrMsg("Failed to load leaderboard");
      }
    }

    async function fetchInvites() {
      if (loadedInvites) return; // already loaded once
      setErrMsg(null);
      try {
        const { data, error } = await supabase
          .from("roff_users")
          .select("*")
          .order("invites", { ascending: false })
          .limit(100);

        if (error) throw error;
        if (cancelled) return;

        const mapped = (data || []).map((row) => ({
          id: row.tg_id,
          name: row.full_name || row.username || `User ${row.tg_id}`,
          username: row.username ? `@${row.username}` : "",
          photo: row.photo_url || "",
          balance: row.balance ?? 0,
          invites: row.invites ?? 0,
          tier: row.premium_tier || "free",
        }));

        setInvites(mapped);
        setLoadedInvites(true);
      } catch (e) {
        console.error("Top invites error", e);
        if (!cancelled) setErrMsg("Failed to load leaderboard");
      }
    }

    if (lbTab === "players") {
      fetchPlayers();
    } else {
      fetchInvites();
    }

    return () => {
      cancelled = true;
    };
  }, [lbTab, loadedPlayers, loadedInvites]);

  const active = lbTab === "players" ? players : invites;

  function Row({ rank, user, mode }) {
    return (
      <div className="lb-row">
        <div className="lb-left">
          <div className="lb-rank">{rank}</div>
          <Avatar name={user.name} photo={user.photo} />
          <div className="lb-namebox">
            <div className="lb-name">{user.name}</div>
            <div className="lb-meta">
              <TierBadge tierKey={user.tier} />
              <span className="lb-username">{user.username}</span>
            </div>
          </div>
        </div>
        <div className="lb-right">
          {mode === "players" ? (
            <div className="lb-metric coins">
              <img className="lb-coin" src={ROF_ICON_SRC} alt="$ROF" />
              <span>{user.balance.toLocaleString()}</span>
            </div>
          ) : (
            <div className="lb-metric invites">
              <span className="lb-invites">{user.invites.toLocaleString()}</span>
              <span className="lb-invites-lbl">invites</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="lb-wrap">
      <div className="lb-tabs">
        <button
          className={`lb-tab ${lbTab === "players" ? "on" : ""}`}
          onClick={() => onTabChange("players")}
        >
          Top Players
        </button>
        <button
          className={`lb-tab ${lbTab === "invites" ? "on" : ""}`}
          onClick={() => onTabChange("invites")}
        >
          Top Invites
        </button>
      </div>

      <div className="lb-head">
        <div className="lb-h-left">Rank</div>
        <div className="lb-h-mid">User</div>
        <div className="lb-h-right">{lbTab === "players" ? "Balance" : "Invites"}</div>
      </div>

      {errMsg && <div className="lb-error">{errMsg}</div>}

      <div className="lb-list">
        {active.length === 0 && !errMsg && (
          <div className="lb-empty">No data yet.</div>
        )}
        {active.map((u, idx) => (
          <Row
            key={`${lbTab}-${u.id}-${idx}`}
            rank={idx + 1}
            user={u}
            mode={lbTab}
          />
        ))}
      </div>
    </div>
  );
});


/* ==================== APP ==================== */
export default function App(){
  const slots = useMemo(buildSlots, []);
  const [bank,setBank] = useState(0);
  const [tgId, setTgId] = useState(null);

  /* Premium state */
  const [tierKey, setTierKey] = useState("free"); // persisted in DB & localStorage
  const tier = TIERS[tierKey];
  const regenMs = Math.floor(BASE_REGEN_MS / tier.regenMult);
  const spinCap = tier.cap;
  const prizeMult = tier.prizeMult;

  /* Wheel (controlled angle) */
  const rafRef = useRef(null);
  const animBusyRef = useRef(false);
  const [angleState, setAngleState] = useState(0);
  const currentAngleRef = useRef(0);
  const calcRotRef = useRef(0);

  /* Spins/energy */
  const [spinsLeft, setSpinsLeft] = useState(BASE_CAP);
  const [nextReadyAt, setNextReadyAt] = useState(null); // timestamp ms
  const [nextInMs, setNextInMs] = useState(0);

  /* UI */
  const [spinning,setSpinning] = useState(false);
  const [toast,setToast] = useState(null);
  const [tab,setTab] = useState("play");
  const [booting,setBooting] = useState(true);
  const [showPremium, setShowPremium] = useState(false);

  /* Leaderboard UI */
  const [lbTab, setLbTab] = useState("players");

  /* Earn / referrals */
  const [myRefLink,setMyRefLink] = useState("");
  const [referrals,setReferrals] = useState(readReferrals());

  /* Splash */
  useEffect(()=>{
    const timer = setTimeout(()=>{
      setBooting(false);
      const tg = window.Telegram?.WebApp;
      if(!tg) return;
      tg.ready();
      tg.setHeaderColor("#000000");
      tg.setBackgroundColor("#000000");
      tg.expand();
      tg.MainButton.hide();
      tg.MainButton.disable?.();
    }, 800);
    return ()=>clearTimeout(timer);
  },[]);

  /* Theme follow */
  const [theme,setTheme] = useState({ bg:"#000", text:"#e8ecf2" });
  useEffect(()=>{
    const tg = window.Telegram?.WebApp;
    if(!tg) return;
    const sync = ()=> {
      const p=tg.themeParams||{};
      setTheme({ bg:p.bg_color||"#000", text:p.text_color||"#e8ecf2" });
    };
    sync(); tg.onEvent?.("themeChanged",sync);
    return ()=>tg.offEvent?.("themeChanged",sync);
  },[]);

  /* Sizes */
  const cx=500, cy=500;
  const R_FACE = 440 * 0.74;
  const R_TRIM = 470 * 0.74;
  const TRIM_W = 40;
  const LABEL_R = 360 * 0.74;
  const trimOuter = R_TRIM + TRIM_W/2;
  const pointerTipY  = cy - trimOuter + 2;
  const pointerBaseY = pointerTipY - 26;

  /* Wedges */
  const wedges = useMemo(()=>{
    return Array.from({length:SEGMENTS_TOTAL}, (_,i)=>{
      const start=i*SEG_DEG; const end=start+SEG_DEG; const mid=(start+end)/2;
      const path = wedgePathLocal(R_FACE, start, end);
      return { i, mid, path, labelR: LABEL_R };
    });
  },[]);

  /* Angle setters + persist angle */
  const applyAngle = (angle) => {
    const norm = ((angle % 360) + 360) % 360;
    currentAngleRef.current = norm;
    setAngleState(norm);
    try {
      localStorage.setItem("rof_visAngle", String(norm));
      window.__rofAngle = norm;
    } catch {}
  };

  /* Restore angle + regen timer from storage */
  useEffect(()=>{
    // angle
    let a = null;
    try {
      const ls = localStorage.getItem("rof_visAngle");
      if (ls != null) a = parseFloat(ls);
    } catch {}
    if (a == null || Number.isNaN(a)) {
      try { if (typeof window.__rofAngle === "number") a = window.__rofAngle; } catch {}
    }
    if (a == null || Number.isNaN(a)) a = 0;
    applyAngle(a);

    // calcRot (optional)
    try{
      const savedCalc = parseFloat(localStorage.getItem("rof_calcRot"));
      if(!Number.isNaN(savedCalc)) calcRotRef.current = savedCalc;
    }catch{}

    // regen timer
    try {
      const stored = localStorage.getItem("rof_nextReadyAt");
      if (stored) {
        const ts = parseInt(stored, 10);
        if (!Number.isNaN(ts)) {
          setNextReadyAt(ts);
          const now = Date.now();
          setNextInMs(Math.max(0, ts - now));
        }
      }
    } catch {}
  },[]);

  /* Cancel RAF on unmount */
  useEffect(()=>()=>{ if(rafRef.current) cancelAnimationFrame(rafRef.current); },[]);

  /* RAF tween for main spin */
  const animateRotation = (from, to, durationMs, onDone) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    animBusyRef.current = true;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = easeOutCubic(t);
      const angle = from + (to - from) * eased;
      applyAngle(angle);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else { animBusyRef.current = false; onDone?.(); }
    };
    applyAngle(from);
    rafRef.current = requestAnimationFrame(step);
  };

  /* Sync Telegram user + balance/spins/tier from Supabase */
  useEffect(() => {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!tgUser) return;

    const run = async () => {
      try {
        setTgId(tgUser.id);
        const baseUser = {
          tg_id: tgUser.id,
          username: tgUser.username || null,
          full_name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" "),
          photo_url: tgUser.photo_url || null,
          last_seen: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("roff_users")
          .upsert(baseUser, { onConflict: "tg_id" })
          .select("*")
          .eq("tg_id", tgUser.id)
          .single();

        if (error) {
          console.error("Supabase upsert/select error", error);
          return;
        }

        if (data) {
          if (typeof data.balance === "number") {
            setBank(data.balance);
          }
          if (typeof data.spins_left === "number") {
            setSpinsLeft(data.spins_left);
          }

          // Tier: DB first, then localStorage fallback
          let tKey = "free";
          if (typeof data.premium_tier === "string" && TIERS[data.premium_tier]) {
            tKey = data.premium_tier;
          } else {
            try {
              const lsTier = localStorage.getItem("rof_premium_tier");
              if (lsTier && TIERS[lsTier]) tKey = lsTier;
            } catch {}
          }
          setTierKey(tKey);
        }
      } catch (err) {
        console.error("Supabase sync error", err);
      }
    };

    run();
  }, []);

  /* Non-additive cooldown ticker (persists timer in localStorage, client-side only) */
  useEffect(()=>{
    if (showPremium) return;
    const tick = () => {
      const now = Date.now();
      setSpinsLeft(s => Math.min(s, spinCap));

      if (spinsLeft >= spinCap) {
        if (nextReadyAt !== null) {
          setNextReadyAt(null);
          try { localStorage.removeItem("rof_nextReadyAt"); } catch {}
        }
        setNextInMs(0);
        return;
      }

      if (nextReadyAt == null) {
        const ts = now + regenMs;
        setNextReadyAt(ts);
        setNextInMs(regenMs);
        try { localStorage.setItem("rof_nextReadyAt", String(ts)); } catch {}
        return;
      }

      const remaining = nextReadyAt - now;
      setNextInMs(remaining > 0 ? remaining : 0);

      if (remaining <= 0) {
        setSpinsLeft(s => Math.min(spinCap, s + 1));
        const nextCount = Math.min(spinCap, spinsLeft + 1);
        if (nextCount < spinCap) {
          const ts = now + regenMs;
          setNextReadyAt(ts);
          setNextInMs(regenMs);
          try { localStorage.setItem("rof_nextReadyAt", String(ts)); } catch {}
        } else {
          setNextReadyAt(null);
          setNextInMs(0);
          try { localStorage.removeItem("rof_nextReadyAt"); } catch {}
        }
      }
    };

    const id = setInterval(tick, TICK_MS);
    tick();
    return ()=>clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinsLeft, nextReadyAt, regenMs, spinCap, showPremium]);

  /* ===== Spin – server-authoritative payout, visual index matched to prize ===== */
  const handleSpin = async () => {
    if (spinning || animBusyRef.current || spinsLeft <= 0) return;
    if (!tgId) {
      setToast({ text: "User not ready yet, try again", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
      return;
    }

    setSpinning(true);
    setToast(null);

    const startVis = currentAngleRef.current;

    try {
      const response = await fetch(`${API_BASE}/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tg_id: tgId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || !data.ok) {
        console.error("Spin error", data);
        if (data && data.error === "no_spins") {
          setToast({ text: "No spins left", key: Date.now() });
        } else {
          setToast({ text: "Spin failed, try again", key: Date.now() });
        }
        setTimeout(() => setToast(null), 1500);
        setSpinning(false);
        return;
      }

      const serverPrize = data.prize;        // prize AFTER multiplier (from backend)
      const newBalance = data.balance;
      const newSpins   = data.spins_left;

      // Match prize with a segment on wheel (base * prizeMult === serverPrize)
      const candidates = [];
      slots.forEach((slot, i) => {
        const base = slot.amount || 0;
        if (base * prizeMult === serverPrize) {
          candidates.push(i);
        }
      });

      let idx;
      if (candidates.length > 0) {
        idx = candidates[randInt(0, candidates.length - 1)];
      } else if (typeof data.index === "number") {
        idx = Math.max(0, Math.min(SEGMENTS_TOTAL - 1, data.index));
      } else {
        idx = randInt(0, SEGMENTS_TOTAL - 1);
      }

      const spinsFull = randInt(4, 8);
      const jitter = (randFloat() * 0.8 - 0.4) * SEG_DEG;
      const center = idx * SEG_DEG + SEG_DEG / 2 + jitter;
      const toZero = (360 - (center % 360) + 360) % 360;

      const finalCalc = calcRotRef.current + spinsFull * 360 + toZero;
      const endMod = ((finalCalc % 360) + 360) % 360;

      let visualDelta = endMod - startVis;
      if (visualDelta <= 0) visualDelta += 360;
      const extraTurns = spinsFull - 1;
      visualDelta += extraTurns * 360;
      const endVis = startVis + visualDelta;

      const durationMs = randInt(1900, 2800);

      animateRotation(startVis, endVis, durationMs, () => {
        calcRotRef.current = finalCalc;

        const finalVis = ((endVis % 360) + 360) % 360;
        currentAngleRef.current = finalVis;
        applyAngle(finalVis);

        try {
          localStorage.setItem("rof_calcRot", String(finalCalc));
        } catch {}

        setBank(newBalance);
        setSpinsLeft(newSpins);

        setToast({ text: `+${serverPrize} $ROF`, key: Date.now() });
        setTimeout(() => setToast(null), 1600);

        setSpinning(false);
      });
    } catch (err) {
      console.error("Spin request failed", err);
      setToast({ text: "Network error, try again", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
      setSpinning(false);
    }
  };

  /* ===== Premium purchase – permanent tier, only upgrades ===== */
  const canAfford = (price) => bank >= price;
  const buyTier = async (key) => {
    if (key === tierKey) return;

    // prevent downgrades
    if (TIER_ORDER[key] <= TIER_ORDER[tierKey]) {
      setToast({ text: "You already have this or higher tier", key: Date.now() });
      setTimeout(() => setToast(null), 1600);
      return;
    }

    if (!canAfford(TEST_PRICE_COINS)) {
      setToast({ text: "Not enough coins for Premium", key: Date.now() });
      setTimeout(() => setToast(null), 1600);
      return;
    }

    const t = TIERS[key];
    const now = Date.now();
    const newBalance = bank - TEST_PRICE_COINS;

    setBank(newBalance);
    setTierKey(key);
    try { localStorage.setItem("rof_premium_tier", key); } catch {}

    setSpinsLeft((s) => Math.min(s, t.cap));

    // adjust regen timer instantly
    if (spinsLeft >= t.cap) {
      setNextReadyAt(null);
      setNextInMs(0);
      try { localStorage.removeItem("rof_nextReadyAt"); } catch {}
    } else {
      const ts = now + Math.floor(BASE_REGEN_MS / t.regenMult);
      setNextReadyAt(ts);
      setNextInMs(ts - now);
      try { localStorage.setItem("rof_nextReadyAt", String(ts)); } catch {}
    }

    if (tgId) {
      try {
        const { error } = await supabase
          .from("roff_users")
          .update({ premium_tier: key, balance: newBalance })
          .eq("tg_id", tgId);

        if (error) {
          console.error("Failed to update premium_tier in DB", error);
          setToast({ text: "Tier saved locally, DB update failed", key: Date.now() });
          setTimeout(() => setToast(null), 2000);
        }
      } catch (e) {
        console.error("Supabase error updating tier", e);
        setToast({ text: "Tier saved locally, DB update failed", key: Date.now() });
        setTimeout(() => setToast(null), 2000);
      }
    }

    setShowPremium(false);
    setToast({ text: `${t.name} activated!`, key: Date.now() });
    setTimeout(() => setToast(null), 1600);
  };

  /* ===== Earn: referral code + link + claim handling ===== */
  useEffect(()=>{
    const code = getOrCreateMyRefCode();
    // ✅ New: link goes to bot, not webapp
    const link = `https://t.me/roffleapp_bot?start=${encodeURIComponent(code)}`;
    setMyRefLink(link);
  },[]);

  useEffect(()=>{
    try{
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (!ref) return;
      const already = localStorage.getItem("rof_ref_claimed");
      const myCode = localStorage.getItem("rof_ref_code");
      if (already === "1") return;
      if (myCode && ref === myCode) return;

      setBank(b => b + 200);
      setSpinsLeft(s => Math.min(spinCap, s + 20));
      setToast({ text: `+200 $ROF & +20 spins (invite)`, key: Date.now() });
      setTimeout(() => setToast(null), 1600);

      localStorage.setItem("rof_ref_claimed", "1");
      localStorage.setItem("rof_referred_by", ref);

      const u = getTGUser();
      const row = {
        id: `joined-${Date.now()}`,
        name: u?.name || "You (joined)",
        username: u?.username || "",
        photo: u?.photo || "",
        tier: "free",
        when: new Date().toISOString(),
        note: `Joined via ${ref}`,
      };
      addReferralRow(row);
      setReferrals(readReferrals());
    }catch{}
    // eslint-disable-next-line
  }, [spinCap]);

  const copyLink = async ()=>{
    try{
      await navigator.clipboard.writeText(myRefLink);
      setToast({text:"Copied link", key:Date.now()});
      setTimeout(()=>setToast(null),1200);
    }catch{}
  };
  const shareLink = ()=>{
    const text = `Spin & win on ROFFLE — we both get +20 spins & +200 $ROF:\n${myRefLink}`;
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(myRefLink)}&text=${encodeURIComponent(text)}`);
    else if (navigator.share) navigator.share({ title:"ROFFLE", text, url:myRefLink }).catch(()=>{});
    else window.open(`https://t.me/share/url?url=${encodeURIComponent(myRefLink)}&text=${encodeURIComponent(text)}`,'_blank');
  };

  const PremiumModal = () => {
    const cards = [
      { t: TIERS.plus, bullets: [
        "Wheel spins regenerate ×2 faster",
        "Wheel cap increases to 40/40",
        "All wheel prizes ×2",
        "Invite rewards +50% from base",
      ]},
      { t: TIERS.pro, bullets: [
        "Wheel spins regenerate ×3 faster",
        "Wheel cap increases to 60/60",
        "All wheel prizes ×3",
        "Invite rewards +75% from base",
      ]},
      { t: TIERS.prem, bullets: [
        "Wheel spins regenerate ×5 faster",
        "Wheel cap increases to 100/100",
        "All wheel prizes ×5",
        "Invite rewards +100% from base",
      ]},
    ];
    return (
      <div className="modal-overlay" onClick={()=>setShowPremium(false)}>
        <div className="modal" onClick={(e)=>e.stopPropagation()}>
          <div className="modal-head">
            <div className="mh-left">
              <span className="mh-icon">👑</span>
              <div className="mh-title">Go $ROF Premium</div>
            </div>
            <button className="modal-close" onClick={()=>setShowPremium(false)}>✕</button>
          </div>

          <div className="modal-body">
            <div className="modal-sub">Choose a tier (test price: <b>{TEST_PRICE_COINS} coin</b> each)</div>

            <div className="tier-grid">
              {cards.map(({t, bullets})=>{
                const active = t.key === tierKey;
                const isLowerOrEqual = TIER_ORDER[t.key] <= TIER_ORDER[tierKey];
                const disabled = isLowerOrEqual || !canAfford(TEST_PRICE_COINS);

                return (
                  <div key={t.key} className={`tier-card gradient-border ${active?"active":""}`}>
                    <div className="tc-top">
                      <div className="tc-name">{t.name}</div>
                      {active && <div className="tc-active">Active</div>}
                    </div>
                    <ul className="tc-list">
                      {bullets.map((b,idx)=><li key={idx}>{b}</li>)}
                    </ul>
                    <div className="tc-price">Price: {TEST_PRICE_COINS} coin</div>
                    <div className="tc-actions">
                      <button
                        className="tc-buy gradient-outline-btn"
                        disabled={disabled}
                        onClick={()=>!disabled && buyTier(t.key)}
                      >
                        {t.key === tierKey
                          ? "Current Plan"
                          : isLowerOrEqual
                          ? "Unavailable"
                          : `Buy ${t.name}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const PlayScreen = () => (
    <>
      <div className="wheel-wrap compact-no-scroll">
        <svg className="wheel-svg" viewBox="0 0 1000 1000" aria-hidden>
          <defs>
            {Array.from({ length: SEGMENTS_TOTAL }, (_, i) => {
              const sec1 = i + 1;
              const id = `grad-${i}`;
              if (sec1 === 1)
                return (
                  <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#43cda3" />
                    <stop offset="100%" stopColor="#490e6d" />
                  </linearGradient>
                );
              else if (sec1 % 2 === 0)
                return (
                  <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#404040" />
                    <stop offset="100%" stopColor="#000000" />
                  </linearGradient>
                );
              else
                return (
                  <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#a8a8a8" />
                  </linearGradient>
                );
            })}
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f6e19a" />
              <stop offset="50%" stopColor="#caa03a" />
              <stop offset="100%" stopColor="#7a5d19" />
            </linearGradient>
            <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#36125e" floodOpacity="1" />
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#36125e" floodOpacity=".85" />
              <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#36125e" floodOpacity=".6" />
            </filter>
          </defs>

          <g className="wheel-root" transform={`translate(${cx} ${cy})`}>
            <circle r={R_TRIM} fill="none" stroke="url(#goldGrad)" strokeWidth={TRIM_W} />

            <g className="rotor" data-angle={angleState} transform={`rotate(${START_OFFSET + angleState})`}>
              {wedges.map(({ i, path }) => (
                <path key={`p${i}`} d={path} fill={`url(#grad-${i})`} />
              ))}

              {wedges.map(({ i, mid, labelR }) => {
                const sec1 = i + 1;
                const isMax = sec1 === 1;
                const baseAmount = slots[i].amount || 0;
                const shown = baseAmount * prizeMult;

                const textFill = sec1 === 1 ? "#fff" : sec1 % 2 === 0 ? "#fff" : "#000";
                const textAngle = (mid + 270) % 360;
                const flip = textAngle > 90 && textAngle < 270;

                return (
                  <g key={`t${i}`} transform={`rotate(${mid})`}>
                    <text
                      x={labelR}
                      y={0}
                      transform={flip ? `rotate(180 ${labelR} 0)` : ""}
                      className={`slice-txt ${isMax ? "is-max" : ""}`}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={textFill}
                      filter={isMax ? "url(#textGlow)" : undefined}
                    >
                      {shown}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>

          <polygon
            className="pointer"
            points={`${cx - 18},${pointerBaseY} ${cx + 18},${pointerBaseY} ${cx},${pointerTipY}`}
          />
        </svg>

        <div className="center-stack">
          <div className="center-ring" />
          <div className="center-cap" />
          <img className="center-logo-img" src={CENTER_LOGO_SRC} alt="logo" />
          <div className="center-gloss" />
        </div>
      </div>

      <div className="spin-row tight">
        <button className="btn-spin" onClick={handleSpin} disabled={spinning || animBusyRef.current || spinsLeft<=0}>
          <span className="spin-count">{spinsLeft}/{spinCap} <span className="muted">Spins left</span></span>
          <span className="spin-cta">{spinning ? "Spinning…" : "Spin"}</span>
          <span className="spin-timer">
            {spinsLeft<spinCap ? `Next spin in ${formatMs(nextInMs)}` : "Ready"}
          </span>
        </button>
      </div>
    </>
  );

  const LootScreen = () => <div className="placeholder-card">🎁 Lootboxes coming soon…</div>;

  function AvatarInline({name, photo}){
    if (photo) return <img className="lb-avatar" src={photo} alt={name} />;
    const bg = randomItem(DEMO_AVATAR_COLORS);
    return <div className="lb-avatar fallback" style={{ background: bg }}>{initials(name)}</div>;
  }
  function formatDate(iso){
    try{
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
    }catch{return "";}
  }

  const EarnScreen = () => {
    const invitedCount = referrals.length;
    const estBonus = invitedCount * 200;
    return (
      <div className="earn-wrap">
        <div className="card gradient-border">
          <div className="card-head">
            <div className="card-title">Invite friends</div>
            <div className="reward-pill">🎁 Both get <b>+20 spins</b> & <b>+200 $ROF</b></div>
          </div>

          <div className="ref-link-box">
            <input className="ref-input" value={myRefLink} readOnly />
            <div className="ref-actions">
              <button className="btn small gradient-outline-btn" onClick={copyLink}>Copy</button>
              <button className="btn small gradient-outline-btn" onClick={shareLink}>Share</button>
            </div>
          </div>

          <div className="stats-row">
            <div className="statbox">
              <div className="stat-h">Invited</div>
              <div className="stat-v">{invitedCount}</div>
            </div>
            <div className="statbox">
              <div className="stat-h">Coins earned*</div>
              <div className="stat-v">{estBonus}</div>
            </div>
          </div>
          <div className="disclaimer">*Inviter rewards require a backend to credit automatically.</div>
        </div>

        <div className="card list-card gradient-border">
          <div className="card-title">Recent sign-ups via your link</div>
          <div className="ref-list">
            {referrals.length === 0 && (
              <div className="empty">No referrals yet. Share your link to start earning!</div>
            )}
            {referrals.map((r,i)=>(
              <div key={r.id || i} className="ref-row">
                <AvatarInline name={r.name || "User"} photo={r.photo || ""} />
                <div className="ref-meta">
                  <div className="ref-name">{r.name || "User"}</div>
                  <div className="ref-sub">
                    <TierBadge tierKey={r.tier || "free"} />
                    {r.username && <span className="ref-username">{r.username}</span>}
                  </div>
                </div>
                <div className="ref-when">{formatDate(r.when)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const TopScreenContainer  = () => (
    <TopScreen lbTab={lbTab} onTabChange={(t)=>setLbTab(t)} myTgId={tgId} />
  );
  const TasksScreen= () => <div className="placeholder-card">🕹 Tasks coming soon…</div>;

  const Menu = () => (
    <nav className="bottom-menu">
      <button className={`menu-item ${tab==="play"?"on":""}`}  onClick={()=>setTab("play")}><span className="mi-emoji">🎮</span><span className="mi-text">Play</span></button>
      <button className={`menu-item ${tab==="loot"?"on":""}`}  onClick={()=>setTab("loot")}><span className="mi-emoji">🎁</span><span className="mi-text">Loot</span></button>
      <button className={`menu-item ${tab==="top" ?"on":""}`}  onClick={()=>{ setTab("top"); setLbTab("players"); }} ><span className="mi-emoji">🏆</span><span className="mi-text">Top100</span></button>
      <button className={`menu-item ${tab==="earn"?"on":""}`}  onClick={()=>setTab("earn")}><span className="mi-emoji">🚀</span><span className="mi-text">Earn</span></button>
      <button className={`menu-item ${tab==="tasks"?"on":""}`} onClick={()=>setTab("tasks")}><span className="mi-emoji">🕹</span><span className="mi-text">Tasks</span></button>
    </nav>
  );

  /* Badge mapping for current status (header) */
  const statusBadge = (() => {
    if (tierKey === "free") return { cls: "free", text: "No status" };
    if (tierKey === "plus") return { cls: "premium", text: "Premium⚡️" };
    if (tierKey === "pro")  return { cls: "plus",    text: "Plus⭐️" };
    return { cls: "pro", text: "Pro👑" }; // prem
  })();

  return (
    <div className={`tg-app bg-img ${showPremium ? "modal-open" : ""}`} style={{"--bg":theme.bg,"--text":theme.text}}>
      {booting && (
        <div className="splash">
          <img src={BRAND_LOGO_SRC} alt="ROFFLE" />
          <div className="spinner"></div>
        </div>
      )}

      {!booting && (
        <div className="compact no-scroll">
          <header className="header">
            <img src={BRAND_LOGO_SRC} alt="ROFFLE" className="brand-logo" />
            <div className="header-right" />
          </header>

          <section className="balance-block compacted">
            <div className="bal-line1">Your $ROF Balance:</div>
            <div className="bal-line2">
              <img className="bal-icon" src={ROF_ICON_SRC} alt="$ROF" />
              <span className="bal-value">{bank}</span>
            </div>

            <div className="premium-row">
              <button className="btn-premium" onClick={()=>setShowPremium(true)}>👑 Go $ROF Premium</button>
              <span className={`badge ${statusBadge.cls}`}>{statusBadge.text}</span>
            </div>
          </section>

          <div className="screen flex-grow">
            {tab==="play"   && <PlayScreen />}
            {tab==="loot"   && <LootScreen />}
            {tab==="top"    && <TopScreenContainer />}
            {tab==="earn"   && <EarnScreen />}
            {tab==="tasks"  && <TasksScreen />}
          </div>

          {toast && <div key={toast.key} className="toast-win">{toast.text}</div>}

          <Menu />
        </div>
      )}

      {showPremium && <PremiumModal />}
    </div>
  );
}
