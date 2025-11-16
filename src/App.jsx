import React, { useEffect, useMemo, useRef, useState } from "react";
import { TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react"; // ✅ NEW
import { supabase } from "./supabaseClient";



/* ================= CORE WHEEL CONSTANTS ================= */
const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°
const START_OFFSET = -90; // pointer at top

/* Base (Free) spin settings */
const BASE_CAP = 20;
const BASE_REGEN_MS = 10 * 60 * 1000; // 10 minutes (non-additive!)
const TICK_MS = 1000;

/* Premium tiers (names per your mapping) */
const TIERS = {
  free: { key: "free", name: "Free",              regenMult: 1, cap: 20,  prizeMult: 1,  inviteBonus: 0 },
  plus: { key: "plus", name: "$ROF Premium⚡️",   regenMult: 2, cap: 40,  prizeMult: 2,  inviteBonus: 50 },
  pro:  { key: "pro",  name: "$ROF Plus⭐️",      regenMult: 3, cap: 60,  prizeMult: 3,  inviteBonus: 75 },
  prem: { key: "prem", name: "$ROF Pro👑",        regenMult: 5, cap: 100, prizeMult: 5,  inviteBonus: 100 },
};
const TEST_PRICE_COINS = 1;

/* ================= SKINS CONFIG ================= */

/* 13 wheel skins (themes); visuals are driven by id in the SVG + preview helper */
const WHEEL_SKINS = [
  {
    id: "classic",
    name: "Classic ROFFLE",
    tagline: "Gold max, black & silver fillers",
  },
  {
    id: "bloody",
    name: "I See Red",
    tagline: "Red & black degen casino heat",
  },
  {
    id: "emerald",
    name: "Fresh",
    tagline: "Green mint & cool summer vibes",
  },
  {
    id: "ice",
    name: "Ice Shards",
    tagline: "Frozen blues & white shards",
  },
  {
    id: "cyber",
    name: "Emerald Luck",
    tagline: "Matrix-style emerald grid of luck",
  },
  {
    id: "royal",
    name: "Afterglow",
    tagline: "Deep purple haze after the win",
  },
  {
    id: "retro",
    name: "Retro Arcade",
    tagline: "80s pinks, blues & scanlines",
  },
  {
    id: "candy",
    name: "Candy Pop",
    tagline: "Bubblegum and sweet jackpots",
  },
  {
    id: "stealth",
    name: "Stealth Ops",
    tagline: "Dark mode with tactical shine",
  },
];


/* Background skins (ROF Mood) */
const BG_SKINS = [
  {
    id: "default",
    name: "Default ROFFLE",
    tagline: "Original ROFFLE backdrop",
    file: "/app-bg.png",
  },
  {
    id: "space",
    name: "Cosmic Space",
    tagline: "Stars, nebulas & ROF dust",
    file: "/app-bg-space.png",
  },
  {
    id: "bc",
    name: "Blockchain Grid",
    tagline: "Techno lines & degen shine",
    file: "/app-bg-bc.png",
  },
  {
    id: "poker",
    name: "Poker Night",
    tagline: "Cards, chips & high stakes",
    file: "/app-bg-poker.png",
  },
  {
    id: "jamaica",
    name: "Jamaica Vibes",
    tagline: "Green, gold & red holiday mood",
    file: "/app-bg-jamaica.png",
  },
  {
    id: "sg",
    name: "Squid Game?",
    tagline: "It's fun.",
    file: "/app-bg-sg.png",
  },
  {
    id: "vert",
    name: "Vertical Waves",
    tagline: "Abstract gradient pillars",
    file: "/app-bg-vert.png",
  },
  {
    id: "mx",
    name: "Matrix Remake",
    tagline: "Binary",
    file: "/app-bg-mx.png",
  },
  {
    id: "stars",
    name: "Starfield",
    tagline: "Colours for radiant people",
    file: "/app-bg-stars.png",
  },
];

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

/* Convert final angle -> which slice is at the pointer */
function indexFromRotation(rotationDeg) {
  const rot = ((rotationDeg % 360) + 360) % 360;
  const target = (360 - rot + 360) % 360;
  let i = Math.round((target - SEG_DEG / 2) / SEG_DEG);
  i = ((i % SEGMENTS_TOTAL) + SEGMENTS_TOTAL) % SEGMENTS_TOTAL;
  return i;
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

/* ✅ NEW: fetch referrals from Supabase (roff_referrals + roff_users) */
async function fetchReferralsFromDB(tgId) {
  try {
    // 1) Get all rows where this user is the referrer
    const { data, error } = await supabase
      .from("roff_referrals")
      .select("id, created_at, referred_tg_id")
      .eq("referrer_tg_id", tgId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // 2) Collect all referred tg_ids
    const ids = [...new Set(data.map(r => r.referred_tg_id).filter(Boolean))];

    // 3) Fetch their profile data from roff_users
    let usersMap = {};
    if (ids.length) {
      const { data: users, error: usersErr } = await supabase
        .from("roff_users")
        .select("tg_id, full_name, username, photo_url, premium_tier")
        .in("tg_id", ids);

      if (usersErr) throw usersErr;

      usersMap = Object.fromEntries(
        (users || []).map(u => [u.tg_id, u])
      );
    }

    // 4) Merge into referral rows for UI
    return data.map(r => {
      const u = usersMap[r.referred_tg_id] || {};
      return {
        id: r.id,
        tg_id: r.referred_tg_id,
        name: u.full_name || u.username || `User ${r.referred_tg_id}`,
        username: u.username ? `@${u.username}` : "",
        photo: u.photo_url || "",
        tier: u.premium_tier || "free",
        when: r.created_at,
      };
    });
  } catch (e) {
    console.error("fetchReferralsFromDB error", e);
    return [];
  }
}

/* ==================== Top100 Screen (LIVE) ==================== */
const TopScreen = React.memo(
  function TopScreen({ lbTab, onTabChange }) {
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
        if (loadedPlayers) return;
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
        if (loadedInvites) return;
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
          <div className="lb-h-right">
            {lbTab === "players" ? "Balance" : "Invites"}
          </div>
        </div>

        {errMsg && <div className="lb-error">{errMsg}</div>}

        <div className="lb-list">
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
  },
  // Only re-render when the selected tab changes.
  (prev, next) => prev.lbTab === next.lbTab
);

/* Helper for wheel skin preview (40x40 squircle) */
function getWheelPreviewStyle(skin) {
  const styleKey = skin.id;
  if (styleKey === "classic") {
    return { backgroundImage: "linear-gradient(135deg,#ffffff,#a8a8a8)" };
  }
  if (styleKey === "neon") {
    return { backgroundImage: "linear-gradient(135deg,#19FB9B,#b50be5)" };
  }
  if (styleKey === "bloody") {
    return { backgroundImage: "linear-gradient(135deg,#b91c1c,#111827)" };
  }
  if (styleKey === "emerald") {
    return { backgroundImage: "linear-gradient(135deg,#bbf7d0,#166534)" };
  }
  if (styleKey === "ice") {
    return { backgroundImage: "linear-gradient(135deg,#e0f2fe,#0369a1)" };
  }
  if (styleKey === "lava") {
    return { backgroundImage: "linear-gradient(135deg,#f97316,#7f1d1d)" };
  }
  if (styleKey === "cyber") {
    return { backgroundImage: "linear-gradient(135deg,#22c55e,#4c1d95)" };
  }
  if (styleKey === "royal") {
    return { backgroundImage: "linear-gradient(135deg,#7c3aed,#fbbf24)" };
  }
  if (styleKey === "toxic") {
    return { backgroundImage: "linear-gradient(135deg,#22c55e,#a3e635)" };
  }
  if (styleKey === "retro") {
    return { backgroundImage: "linear-gradient(135deg,#fb7185,#38bdf8)" };
  }
  if (styleKey === "galaxy") {
    return { backgroundImage: "linear-gradient(135deg,#4f46e5,#22d3ee)" };
  }
  if (styleKey === "candy") {
    return { backgroundImage: "linear-gradient(135deg,#f9a8d4,#bef264)" };
  }
  if (styleKey === "stealth") {
    return { backgroundImage: "linear-gradient(135deg,#111827,#4b5563)" };
  }
  return { backgroundColor: "#111827" };
}
function getCenterLogoSrc(styleKey) {
  switch (styleKey) {
    case "classic": // Classic ROFFLE
      return "/logo.png";

    case "bloody":  // I See Red
      return "/r-red.png";

    case "ice":     // Ice Shards
      return "/r-ice.png";

    case "cyber":   // Emerald Luck
      return "/r-emerald.png";
    
    case "emerald":   // Fresh
      return "/r-leaf.png";

    case "retro":   // Retro Arcade
      return "/r-retro.png";

    case "royal":   // Afterglow
      return "/r-afterglow.png";

    case "candy":   // Candy Pop
      return "/r-candypop.png";

    case "stealth": // Stealth Ops
      return "/r-stealth.png";

    // future "Leaf" skin
    case "leaf":
      return "/r-leaf.png";

    default:
      return "/logo.png";
  }
}


/* ==================== APP ==================== */
export default function App(){
  const slots = useMemo(buildSlots, []);
  const [bank,setBank] = useState(0);
  const [tgId, setTgId] = useState(null);
  const [invitesCount, setInvitesCount] = useState(0);

  // ✅ TON wallet & UI (from TonConnect)
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  // Skins: wheel + background
  const [wheelSkinId, setWheelSkinId] = useState("classic");
  const [bgSkinId, setBgSkinId] = useState("default");

  const wheelSkin = useMemo(
    () => WHEEL_SKINS.find((s) => s.id === wheelSkinId) || WHEEL_SKINS[0],
    [wheelSkinId]
  );
  const bgSkin = useMemo(
    () => BG_SKINS.find((s) => s.id === bgSkinId) || BG_SKINS[0],
    [bgSkinId]
  );

  // Store skins in localStorage
  useEffect(() => {
    try {
      const savedWheel = localStorage.getItem("rof_wheel_skin");
      const savedBg = localStorage.getItem("rof_bg_skin");
      if (savedWheel && WHEEL_SKINS.some((s) => s.id === savedWheel)) {
        setWheelSkinId(savedWheel);
      }
      if (savedBg && BG_SKINS.some((s) => s.id === savedBg)) {
        setBgSkinId(savedBg);
      }
    } catch {}
  }, []);

  const equipWheelSkin = (id) => {
    setWheelSkinId(id);
    try { localStorage.setItem("rof_wheel_skin", id); } catch {}
  };

  const equipBgSkin = (id) => {
    setBgSkinId(id);
    try { localStorage.setItem("rof_bg_skin", id); } catch {}
  };

  /* Premium state */
  const [tierKey, setTierKey] = useState("free");
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
  const [nextReadyAt, setNextReadyAt] = useState(null);
  const [nextInMs, setNextInMs] = useState(0);

  /* UI */
  const [spinning,setSpinning] = useState(false);
  const [toast,setToast] = useState(null);
  const [tab,setTab] = useState("play");
  const [booting,setBooting] = useState(true);
  const [showPremium, setShowPremium] = useState(false);

  /* Leaderboard UI */
  const [lbTab, setLbTab] = useState("players");

  /* Loot tabs: ROF Skins / ROF Mood / Collectibles */
  const [lootTab, setLootTab] = useState("skins");

  /* Earn / referrals */
  const [myRefLink,setMyRefLink] = useState("");
  const [referrals,setReferrals] = useState([]);   // <- now starts empty, will be filled from DB

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

  /* Restore angle + local regen timer from storage */
  useEffect(()=>{
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

    try{
      const savedCalc = parseFloat(localStorage.getItem("rof_calcRot"));
      if(!Number.isNaN(savedCalc)) calcRotRef.current = savedCalc;
    }catch{}

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

  /* Sync Telegram user + balance/spins/tier from Supabase + offline regen */
  useEffect(() => {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!tgUser) return;

    const run = async () => {
      try {
        setTgId(tgUser.id);

        // basic user fields (NOTE: no last_seen here!)
        const baseUser = {
          tg_id: tgUser.id,
          username: tgUser.username || null,
          full_name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" "),
          photo_url: tgUser.photo_url || null,
        };

        // Upsert without touching last_seen
        const { data, error } = await supabase
          .from("roff_users")
          .upsert(baseUser, { onConflict: "tg_id", ignoreDuplicates: false })
          .select("*")
          .eq("tg_id", tgUser.id)
          .single();

        if (error) {
          console.error("Supabase upsert/select error", error);
          return;
        }

        if (data) {
          const dbTierKey =
            data.premium_tier && TIERS[data.premium_tier]
              ? data.premium_tier
              : "free";
          setTierKey(dbTierKey);

          const tierCfg = TIERS[dbTierKey];
          const capDb = tierCfg.cap;
          const regenMsDb = Math.floor(BASE_REGEN_MS / tierCfg.regenMult);

          let dbBalance = typeof data.balance === "number" ? data.balance : 0;
          let dbSpins =
            typeof data.spins_left === "number" ? data.spins_left : BASE_CAP;
          const dbInvites =
            typeof data.invites === "number" ? data.invites : 0;

          const now = Date.now();
          let lastSeenMs = data.last_seen
            ? new Date(data.last_seen).getTime()
            : now;

          // Offline regen: add spins for elapsed time, capped by tier cap
          if (dbSpins < capDb) {
            const elapsed = now - lastSeenMs;
            if (elapsed > 0) {
              const regenCount = Math.floor(elapsed / regenMsDb);
              if (regenCount > 0) {
                dbSpins = Math.min(capDb, dbSpins + regenCount);
                lastSeenMs = now;
              }
            }
          }

          // Compute nextReadyAt / nextInMs
          let nextReady = null;
          let nextMs = 0;
          if (dbSpins < capDb) {
            const elapsedForNext = now - lastSeenMs;
            const leftover = regenMsDb - (elapsedForNext % regenMsDb);
            nextReady = now + leftover;
            nextMs = leftover;
          }

          setBank(dbBalance);
          setSpinsLeft(dbSpins);
          setInvitesCount(dbInvites);
          setNextReadyAt(nextReady);
          setNextInMs(nextMs);

          // Persist spins & last_seen back to DB
          await supabase
            .from("roff_users")
            .update({
              spins_left: dbSpins,
              last_seen: new Date(lastSeenMs).toISOString(),
              username: baseUser.username,
              full_name: baseUser.full_name,
              photo_url: baseUser.photo_url,
            })
            .eq("tg_id", tgUser.id);
        }
      } catch (err) {
        console.error("Supabase sync error", err);
      }
    };

    run();
  }, []);

  /* ✅ NEW: load referrals from DB whenever we know tgId */
  useEffect(() => {
    if (!tgId) return;
    fetchReferralsFromDB(tgId).then((rows) => {
      setReferrals(rows);
    });
  }, [tgId]);

  /* Non-additive cooldown ticker – online regen + DB write */
  useEffect(() => {
    if (showPremium) return;

    const tick = () => {
      const now = Date.now();

      setSpinsLeft((currentSpins) => {
        const cap = spinCap;

        if (currentSpins >= cap) {
          if (nextReadyAt !== null) setNextReadyAt(null);
          setNextInMs(0);
          return currentSpins;
        }

        if (nextReadyAt == null) {
          const next = now + regenMs;
          setNextReadyAt(next);
          setNextInMs(regenMs);
          try {
            localStorage.setItem("rof_nextReadyAt", String(next));
          } catch {}
          return currentSpins;
        }

        const remaining = nextReadyAt - now;
        if (remaining > 0) {
          setNextInMs(remaining);
          return currentSpins;
        }

        const newSpins = Math.min(cap, currentSpins + 1);
        const stillBelowCap = newSpins < cap;
        const next = stillBelowCap ? now + regenMs : null;
        setNextReadyAt(next);
        setNextInMs(stillBelowCap ? regenMs : 0);
        try {
          if (next) localStorage.setItem("rof_nextReadyAt", String(next));
          else localStorage.removeItem("rof_nextReadyAt");
        } catch {}

        if (tgId) {
          supabase
            .from("roff_users")
            .update({
              spins_left: newSpins,
              last_seen: new Date().toISOString(),
            })
            .eq("tg_id", tgId)
            .then(() => {})
            .catch((e) => console.error("Regen update failed", e));
        }

        return newSpins;
      });
    };

    const id = setInterval(tick, TICK_MS);
    tick();
    return () => clearInterval(id);
  }, [regenMs, spinCap, showPremium, nextReadyAt, tgId]);

  /* ===== Spin – visual-only RNG, payout from final angle ===== */
  const handleSpin = () => {
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
      const spinsFull = randInt(4, 8);
      const extraDeg = randFloat() * 360;
      const endVis = startVis + spinsFull * 360 + extraDeg;
      const durationMs = randInt(1900, 2800);

      animateRotation(startVis, endVis, durationMs, () => {
        const norm = ((endVis % 360) + 360) % 360;
        currentAngleRef.current = norm;
        applyAngle(norm);
        try {
          localStorage.setItem("rof_visAngle", String(norm));
          localStorage.setItem("rof_calcRot", String(endVis));
        } catch {}

        const idx = indexFromRotation(norm);
        const baseAmount = slots[idx].amount || 0;
        const won = baseAmount * prizeMult;

        const newBalance = bank + won;
        const newSpins = spinsLeft - 1;

        setBank(newBalance);
        setSpinsLeft(newSpins);

        supabase
          .from("roff_users")
          .update({
            balance: newBalance,
            spins_left: newSpins,
            last_seen: new Date().toISOString(),
          })
          .eq("tg_id", tgId)
          .then(() => {})
          .catch((e) => {
            console.error("Supabase update after spin failed", e);
          });

        setToast({ text: `+${won} $ROF`, key: Date.now() });
        setTimeout(() => setToast(null), 1600);

        setSpinning(false);
      });
    } catch (err) {
      console.error("Spin failed", err);
      setToast({ text: "Spin error, try again", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
      setSpinning(false);
    }
  };

  /* ===== Premium purchase – permanent tier, only upgrades ===== */
  const canAfford = (price) => bank >= price;
  const buyTier = async (key) => {
    if (key === tierKey) return;

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

  /* ===== Earn: referral code + link ===== */
  useEffect(()=>{
    const code = getOrCreateMyRefCode();
    const link = `https://t.me/roffleapp_bot?start=${encodeURIComponent(code)}`;
    setMyRefLink(link);
  },[]);

  // (Old ?ref=… logic kept but effectively does nothing with bot deep-links)
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

  const LootScreen = () => {
    return (
      <div className="loot-wrap">
        <div className="loot-tabs">
          <button
            className={`loot-tab ${lootTab === "skins" ? "on" : ""}`}
            onClick={() => setLootTab("skins")}
          >
            ROF Skins
          </button>
          <button
            className={`loot-tab ${lootTab === "mood" ? "on" : ""}`}
            onClick={() => setLootTab("mood")}
          >
            ROF Mood
          </button>
          <button
            className={`loot-tab ${lootTab === "collectibles" ? "on" : ""}`}
            onClick={() => setLootTab("collectibles")}
          >
            Collectibles
          </button>
        </div>

        {lootTab === "skins" && (
          <div className="loot-section">
            <div className="loot-title">🎨 Wheel Skins</div>
            <div className="loot-list">
              {WHEEL_SKINS.map((skin) => {
                const isActive = skin.id === wheelSkinId;
                const previewStyle = getWheelPreviewStyle(skin);
                return (
                  <div
                    key={skin.id}
                    className={`loot-row ${isActive ? "active" : ""}`}
                  >
                    <div className="loot-left">
                      <div className="loot-preview" style={previewStyle} />
                      <div className="loot-text">
                        <div className="loot-row-name">
  {skin.name}
</div>

                        <div className="loot-row-tag">{skin.tagline}</div>
                      </div>
                    </div>
                    <div className="loot-right">
                      <div className="loot-price">Free (test)</div>
                      <button
                        className="loot-btn gradient-outline-btn"
                        disabled={isActive}
                        onClick={() => equipWheelSkin(skin.id)}
                      >
                        {isActive ? "Equipped" : "Buy"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {lootTab === "mood" && (
          <div className="loot-section">
            <div className="loot-title">🖼 Background Skins</div>
            <div className="loot-list">
              {BG_SKINS.map((skin) => {
                const isActive = skin.id === bgSkinId;
                const previewStyle = {
                  backgroundImage: `url(${skin.file})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                };
                return (
                  <div
                    key={skin.id}
                    className={`loot-row ${isActive ? "active" : ""}`}
                  >
                    <div className="loot-left">
                      <div className="loot-preview" style={previewStyle} />
                      <div className="loot-text">
                        <div className="loot-row-name">{skin.name}</div>
                        <div className="loot-row-tag">{skin.tagline}</div>
                      </div>
                    </div>
                    <div className="loot-right">
                      <div className="loot-price">Free (test)</div>
                      <button
                        className="loot-btn gradient-outline-btn"
                        disabled={isActive}
                        onClick={() => equipBgSkin(skin.id)}
                      >
                        {isActive ? "Equipped" : "Buy"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {lootTab === "collectibles" && (
          <div className="loot-section">
            <div className="loot-title">🎁 Collectibles</div>
            <div className="placeholder-card">
              Collectibles coming soon…
            </div>
          </div>
        )}
      </div>
    );
  };

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
    const invitedCount = invitesCount;
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

  const PlayScreen = ({ wheelSkin }) => {
    const styleKey = wheelSkin.id;
    const rimGradientId = (() => {
    switch (styleKey) {
      case "bloody":      // I See Red
        return "rim-bloody";
      case "emerald":     // Fresh
        return "rim-emerald";
      case "ice":         // Ice Shards
        return "rim-ice";
      case "cyber":       // Emerald Luck
        return "rim-cyber";
      case "royal":       // Afterglow
        return "rim-royal";
      case "retro":       // Retro Arcade
        return "rim-retro";
      case "candy":       // Candy Pop
        return "rim-candy";
      case "stealth":     // Stealth Ops
        return "rim-stealth";
      case "classic":     // Classic ROFFLE
      default:
        return "rim-classic";
    }
  })();

    return (
      <>
        <div className="wheel-wrap compact-no-scroll">
          <svg className="wheel-svg" viewBox="0 0 1000 1000" aria-hidden>
            <defs>
              {Array.from({ length: SEGMENTS_TOTAL }, (_, i) => {
                const sec1 = i + 1;
                const id = `grad-${i}`;

                // Different gradient families per styleKey
                if (styleKey === "classic") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#43cda3" />
                        <stop offset="100%" stopColor="#490e6d" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#404040" />
                        <stop offset="100%" stopColor="#000000" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="100%" stopColor="#a8a8a8" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "neon") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#19FB9B" />
                        <stop offset="50%" stopColor="#5ce1e6" />
                        <stop offset="100%" stopColor="#b50be5" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#111827" />
                        <stop offset="100%" stopColor="#312e81" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#0f172a" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "bloody") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#ffef9a" />
                        <stop offset="100%" stopColor="#c2410c" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#7f1d1d" />
                        <stop offset="100%" stopColor="#111827" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#b91c1c" />
                        <stop offset="100%" stopColor="#000000" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "emerald") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#bbf7d0" />
                        <stop offset="100%" stopColor="#166534" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#064e3b" />
                        <stop offset="100%" stopColor="#020617" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#16a34a" />
                        <stop offset="100%" stopColor="#052e16" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "ice") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#e0f2fe" />
                        <stop offset="100%" stopColor="#0369a1" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#0f172a" />
                        <stop offset="100%" stopColor="#0b1120" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#e0f2fe" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "lava") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fee2e2" />
                        <stop offset="100%" stopColor="#b91c1c" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#7f1d1d" />
                        <stop offset="100%" stopColor="#111827" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#450a0a" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "cyber") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#4c1d95" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#020617" />
                        <stop offset="100%" stopColor="#111827" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "royal") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f5e7ff" />
                        <stop offset="100%" stopColor="#5b21b6" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#1e1b4b" />
                        <stop offset="100%" stopColor="#020617" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#7c3aed" />
                        <stop offset="100%" stopColor="#fbbf24" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "toxic") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#ecfccb" />
                        <stop offset="100%" stopColor="#65a30d" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#14532d" />
                        <stop offset="100%" stopColor="#022c22" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#a3e635" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "retro") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f9a8d4" />
                        <stop offset="100%" stopColor="#7e22ce" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#0f172a" />
                        <stop offset="100%" stopColor="#1f2933" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fb7185" />
                        <stop offset="100%" stopColor="#38bdf8" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "galaxy") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#e5e7eb" />
                        <stop offset="100%" stopColor="#0f172a" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#020617" />
                        <stop offset="100%" stopColor="#111827" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#4f46e5" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "candy") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fecaca" />
                        <stop offset="100%" stopColor="#f97316" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f9a8d4" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#bef264" />
                        <stop offset="100%" stopColor="#fb7185" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "stealth") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#e5e7eb" />
                        <stop offset="100%" stopColor="#4b5563" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#020617" />
                        <stop offset="100%" stopColor="#111827" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#111827" />
                        <stop offset="100%" stopColor="#374151" />
                      </linearGradient>
                    );
                  }
                }

                // Fallback: classic
                if (sec1 === 1) {
                  return (
                    <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#43cda3" />
                      <stop offset="100%" stopColor="#490e6d" />
                    </linearGradient>
                  );
                } else if (sec1 % 2 === 0) {
                  return (
                    <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#404040" />
                      <stop offset="100%" stopColor="#000000" />
                    </linearGradient>
                  );
                } else {
                  return (
                    <linearGradient id={id} key={id} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="100%" stopColor="#a8a8a8" />
                    </linearGradient>
                  );
                }
              })}
                  {/* Classic gold rim (default) */}
    <linearGradient id="rim-classic" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#f6e19a" />
      <stop offset="50%" stopColor="#caa03a" />
      <stop offset="100%" stopColor="#7a5d19" />
    </linearGradient>

    {/* I See Red – dark red rim */}
    <linearGradient id="rim-bloody" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#fecaca" />
      <stop offset="50%" stopColor="#b91c1c" />
      <stop offset="100%" stopColor="#450a0a" />
    </linearGradient>

    {/* Fresh – dark green / emerald rim */}
    <linearGradient id="rim-emerald" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#bbf7d0" />
      <stop offset="50%" stopColor="#16a34a" />
      <stop offset="100%" stopColor="#022c22" />
    </linearGradient>

    {/* Ice Shards – cold blue rim */}
    <linearGradient id="rim-ice" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#e0f2fe" />
      <stop offset="50%" stopColor="#38bdf8" />
      <stop offset="100%" stopColor="#020617" />
    </linearGradient>

    {/* Emerald Luck – teal / blue rim */}
    <linearGradient id="rim-cyber" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#a7f3d0" />
      <stop offset="50%" stopColor="#22c55e" />
      <stop offset="100%" stopColor="#0b1120" />
    </linearGradient>

    {/* Afterglow – deep purple rim */}
    <linearGradient id="rim-royal" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#e9d5ff" />
      <stop offset="50%" stopColor="#7c3aed" />
      <stop offset="100%" stopColor="#1e1b4b" />
    </linearGradient>

    {/* Retro Arcade – dark pink → blue rim */}
    <linearGradient id="rim-retro" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#f9a8d4" />
      <stop offset="50%" stopColor="#fb7185" />
      <stop offset="100%" stopColor="#38bdf8" />
    </linearGradient>

    {/* Candy Pop – gold → pink rim */}
    <linearGradient id="rim-candy" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#fef3c7" />
      <stop offset="50%" stopColor="#f97316" />
      <stop offset="100%" stopColor="#f472b6" />
    </linearGradient>

    {/* Stealth Ops – chrome / dark silver rim */}
    <linearGradient id="rim-stealth" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#e5e7eb" />
      <stop offset="50%" stopColor="#9ca3af" />
      <stop offset="100%" stopColor="#020617" />
    </linearGradient>

    <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#36125e" floodOpacity="1" />
      <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#36125e" floodOpacity=".85" />
      <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#36125e" floodOpacity=".6" />
    </filter>

            </defs>

            <g className="wheel-root" transform={`translate(${cx} ${cy})`}>
                <circle
    r={R_TRIM}
    fill="none"
    stroke={`url(#${rimGradientId})`}
    strokeWidth={TRIM_W}
  />


              <g className="rotor" data-angle={angleState} transform={`rotate(${START_OFFSET + angleState})`}>
                {wedges.map(({ i, path }) => (
                  <path key={`p${i}`} d={path} fill={`url(#grad-${i})`} />
                ))}

              {wedges.map(({ i, mid, labelR }) => {
  const sec1 = i + 1;
  const isMax = sec1 === 1;
  const baseAmount = slots[i].amount || 0;
  const shown = baseAmount * prizeMult;

  // Special yellow/white logic for certain skins
  const isYellowStyle =
    wheelSkin.id === "bloody" ||
    wheelSkin.id === "emerald" ||
    wheelSkin.id === "stealth";

  let textFill;
  if (isYellowStyle) {
    // Lowest denomination stays white, rest yellow
    if (baseAmount === 1) {
      textFill = "#ffffff";
    } else {
      textFill = "#facc15"; // yellow
    }
  } else {
    // Default logic for all other skins
    textFill = sec1 === 1 ? "#fff" : sec1 % 2 === 0 ? "#fff" : "#000";
  }

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
            <img
  className="center-logo-img"
  src={getCenterLogoSrc(styleKey)}
  alt="logo"
/>

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
  };

    // ✅ Simple test TON payment (e.g. 0.1 TON)
  const handleTestTonPayment = async () => {
    if (!wallet) {
      setToast({ text: "Connect TON wallet first", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
      return;
    }

    try {
      // 🔁 valid for 60 seconds
      const validUntil = Math.floor(Date.now() / 1000) + 60;

      await tonConnectUI.sendTransaction({
        validUntil,
        messages: [
          {
            // 🔴 IMPORTANT: put your ROFFLE TON address here
            // Example format: "EQC3....."
            address: "UQDXJshWTZc6KTvmA3zSlqElus_9LPTRIGz-VFi6Bxt4yXqo",
            // amount in nanoTON (1 TON = 1e9 nanoTON)
            // 0.1 TON = 100_000_000
            amount: "100000000",
          },
        ],
      });

      setToast({ text: "TON payment sent ✅", key: Date.now() });
      setTimeout(() => setToast(null), 1600);
    } catch (e) {
      console.error("TON payment error", e);
      setToast({ text: "Payment cancelled or failed", key: Date.now() });
      setTimeout(() => setToast(null), 1600);
    }
  };

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

  const statusBadge = (() => {
    if (tierKey === "free") return { cls: "free", text: "No status" };
    if (tierKey === "plus") return { cls: "premium", text: "Premium⚡️" };
    if (tierKey === "pro")  return { cls: "plus",    text: "Plus⭐️" };
    return { cls: "pro", text: "Pro👑" };
  })();

  return (
    <div
      className={`tg-app bg-img ${showPremium ? "modal-open" : ""}`}
      style={{
        "--bg": theme.bg,
        "--text": theme.text,
        "--bg-url": `url("${bgSkin.file}")`,
      }}
    >
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
          <div className="header-right">
          {/* ✅ TON wallet connect button */}
          <TonConnectButton />
          </div>
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

  {/* ✅ New TON payment row */}
  <div className="premium-row">
    <button
      className="btn-premium"
      onClick={handleTestTonPayment}
    >
      💎 Pay 0.1 TON (test)
    </button>
    {wallet && (
      <span className="wallet-pill">
        {wallet.account.address.slice(0, 4)}…{wallet.account.address.slice(-4)}
      </span>
    )}
  </div>
</section>


          <div className="screen flex-grow">
            {tab==="play"   && <PlayScreen wheelSkin={wheelSkin} />}
            {tab==="loot"   && <LootScreen />}
            {tab==="top"    && <TopScreen lbTab={lbTab} onTabChange={setLbTab} />}
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
