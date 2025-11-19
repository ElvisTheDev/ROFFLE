import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  TonConnectButton,
  useTonConnectUI,
  useTonWallet,
} from "@tonconnect/ui-react";
import { supabase } from "./supabaseClient";

/* ================= CORE WHEEL CONSTANTS ================= */
const SEGMENTS_TOTAL = 25;
const SEG_DEG = 360 / SEGMENTS_TOTAL; // 14.4°
const START_OFFSET = -90; // pointer at top

/* Base (Free) spin settings */
const BASE_CAP = 20;
const BASE_REGEN_MS = 10 * 60 * 1000; // 10 minutes (non-additive!)
const TICK_MS = 1000;

/* 🔹 Backend API base (Render) */
const API_BASE = "https://roffle-bot.onrender.com";

/* Premium tiers (names per your mapping) */
const TIERS = {
  free: {
    key: "free",
    name: "Free",
    regenMult: 1,
    cap: 20,
    prizeMult: 1,
    inviteBonus: 0,
    priceTon: 0,
    priceStars: 0,
  },
  plus: {
    key: "plus",
    name: "$ROF Premium⚡️",
    regenMult: 2,
    cap: 40,
    prizeMult: 2,
    inviteBonus: 50,
    priceTon: 5, // 5 TON
    priceStars: 700, // 700 Stars
  },
  pro: {
    key: "pro",
    name: "$ROF Plus⭐️",
    regenMult: 3,
    cap: 60,
    prizeMult: 3,
    inviteBonus: 75,
    priceTon: 10, // 10 TON
    priceStars: 1400, // 1400 Stars
  },
  prem: {
    key: "prem",
    name: "$ROF Pro👑",
    regenMult: 5,
    cap: 100,
    prizeMult: 5,
    inviteBonus: 100,
    priceTon: 15, // 15 TON
    priceStars: 2100, // 2100 Stars
  },
};

/**
 * Coins test price – not used for TON flow anymore, but left in case you
 * want to gate tiers by in-game coins later.
 */
const TEST_PRICE_COINS = 0;

/* ================= SKINS CONFIG ================= */

/* Wheel skins (themes) */
const WHEEL_SKINS = [
  {
    id: "classic",
    name: "Classic ROFFLE",
    tagline: "Gold max, black & silver fillers",
    priceTon: 0,
    priceStars: 0,
  },
  {
    id: "bloody",
    name: "I See Red",
    tagline: "Red & black degen casino heat",
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "emerald",
    name: "Fresh",
    tagline: "Green mint & cool summer vibes",
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "ice",
    name: "Ice Shards",
    tagline: "Frozen blues & white shards",
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "cyber",
    name: "Emerald Luck",
    tagline: "Matrix-style emerald grid of luck",
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "royal",
    name: "Afterglow",
    tagline: "Deep purple haze after the win",
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "retro",
    name: "Retro Arcade",
    tagline: "80s pinks, blues & scanlines",
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "candy",
    name: "Candy Pop",
    tagline: "Bubblegum and sweet jackpots",
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "stealth",
    name: "Stealth Ops",
    tagline: "Dark mode with tactical shine",
    priceTon: 2,
    priceStars: 299,
  },
];

/* Background skins (ROF Mood) */
const BG_SKINS = [
  {
    id: "default",
    name: "Default ROFFLE",
    tagline: "Original ROFFLE backdrop",
    file: "/app-bg.png",
    priceTon: 0,
    priceStars: 0,
  },
  {
    id: "space",
    name: "Cosmic Space",
    tagline: "Stars, nebulas & ROF dust",
    file: "/app-bg-space.png",
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "bc",
    name: "Blockchain Grid",
    tagline: "Techno lines & degen shine",
    file: "/app-bg-bc.png",
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "poker",
    name: "Poker Night",
    tagline: "Cards, chips & high stakes",
    file: "/app-bg-poker.png",
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "jamaica",
    name: "Jamaica Vibes",
    tagline: "Green, gold & red holiday mood",
    file: "/app-bg-jamaica.png",
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "sg",
    name: "Squid Game?",
    tagline: "It's fun.",
    file: "/app-bg-sg.png",
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "vert",
    name: "Vertical Waves",
    tagline: "Abstract gradient pillars",
    file: "/app-bg-vert.png",
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "mx",
    name: "Matrix Remake",
    tagline: "Binary",
    file: "/app-bg-mx.png",
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "stars",
    name: "Starfield",
    tagline: "Colours for radiant people",
    file: "/app-bg-stars.png",
    priceTon: 2,
    priceStars: 299,
  },
];

/* ================= TASKS CONFIG ================= */

const TASKS = [
  {
    id: "follow_tg",
    icon: "/tg-icon.png",
    title: "Follow ROFFLE Announcements",
    type: "link",
    url: "https://t.me/rofflereal",
    reward: { rof: 1000, spins: 0, tickets: 0 }, // tweak amounts if you like
  },
  {
    id: "follow_x",
    icon: "/x-icon.png",
    title: "Follow ROFFLE on X",
    type: "link",
    url: "https://twitter.com/rofflereal",
    reward: { rof: 1000, spins: 0, tickets: 0 },
  },
  {
    id: "invite_1",
    icon: "/1inv-icon.png",
    title: "Invite 1 Friend",
    type: "invite",
    requiresInvites: 1,
    reward: { rof: 2500, spins: 0, tickets: 0 },
  },
  {
    id: "invite_3",
    icon: "/3inv-icon.png",
    title: "Invite 3 Friends",
    type: "invite",
    requiresInvites: 3,
    reward: { rof: 10000, spins: 0, tickets: 0 },
  },
  {
    id: "invite_5",
    icon: "/5inv-icon.png",
    title: "Invite 5 Friends",
    type: "invite",
    requiresInvites: 5,
    reward: { rof: 20000, spins: 0, tickets: 0 },
  },
  {
    id: "invite_10",
    icon: "/10inv-icon.png",
    title: "Invite 10 Friends",
    type: "invite",
    requiresInvites: 10,
    reward: { rof: 50000, spins: 0, tickets: 1 }, // +1 Golden Ticket
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

/* Assets & TON treasury wallet */
const CENTER_LOGO_SRC = "/logo.png";
const BRAND_LOGO_SRC = "/rof-lg.png";
const ROF_ICON_SRC = "/rof-bn.png";
const TREASURY_WALLET = "UQDXJshWTZc6KTvmA3zSlqElus_9LPTRIGz-VFi6Bxt4yXqo";

/* ===== Avatar helpers & fallback colors ===== */
const DEMO_AVATAR_COLORS = [
  "#6c5ce7",
  "#00cec9",
  "#fd79a8",
  "#ffeaa7",
  "#55efc4",
  "#a29bfe",
  "#fab1a0",
  "#81ecec",
  "#ffd6a5",
];

function initials(name) {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function randomItem(a) {
  return a[Math.floor(Math.random() * a.length)];
}

/* Tier badges for UI */
function TierBadge({ tierKey }) {
  if (tierKey === "free" || !tierKey)
    return <span className="badge free">No status</span>;
  if (tierKey === "plus")
    return <span className="badge premium">Premium⚡️</span>;
  if (tierKey === "pro") return <span className="badge plus">Plus⭐️</span>;
  return <span className="badge pro">Pro👑</span>;
}

/* --------- Earn helpers --------- */
function getTGUser() {
  const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (!u) return null;
  return {
    id: u.id,
    name:
      [u.first_name, u.last_name].filter(Boolean).join(" ") ||
      u.username ||
      `User ${u.id}`,
    username: u.username ? `@${u.username}` : "",
    photo: u.photo_url || "",
  };
}
function getOrCreateMyRefCode() {
  try {
    const tgUser = getTGUser();
    const key = "rof_ref_code";
    let code = localStorage.getItem(key);
    if (!code) {
      const seed = tgUser?.id
        ? String(tgUser.id)
        : String(Math.floor(Math.random() * 1e10));
      code = Number.parseInt(seed, 10).toString(36);
      localStorage.setItem(key, code);
    }
    return code;
  } catch {
    return Math.floor(Math.random() * 1e9).toString(36);
  }
}
function readReferrals() {
  try {
    return JSON.parse(localStorage.getItem("rof_referrals") || "[]");
  } catch {
    return [];
  }
}
function writeReferrals(arr) {
  try {
    localStorage.setItem("rof_referrals", JSON.stringify(arr));
  } catch {}
}
function addReferralRow(row) {
  const arr = readReferrals();
  arr.unshift(row);
  writeReferrals(arr.slice(0, 500));
}

/* ✅ NEW: fetch referrals from Supabase (roff_referrals + roff_users) */
async function fetchReferralsFromDB(tgId) {
  try {
    const { data, error } = await supabase
      .from("roff_referrals")
      .select("id, created_at, referred_tg_id")
      .eq("referrer_tg_id", tgId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const ids = [...new Set(data.map((r) => r.referred_tg_id).filter(Boolean))];

    let usersMap = {};
    if (ids.length) {
      const { data: users, error: usersErr } = await supabase
        .from("roff_users")
        .select("tg_id, full_name, username, photo_url, premium_tier")
        .in("tg_id", ids);

      if (usersErr) throw usersErr;

      usersMap = Object.fromEntries((users || []).map((u) => [u.tg_id, u]));
    }

    return data.map((r) => {
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
                <span className="lb-invites">
                  {user.invites.toLocaleString()}
                </span>
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
    case "classic":
      return "/logo.png";
    case "bloody":
      return "/r-red.png";
    case "ice":
      return "/r-ice.png";
    case "cyber":
      return "/r-emerald.png";
    case "emerald":
      return "/r-leaf.png";
    case "retro":
      return "/r-retro.png";
    case "royal":
      return "/r-afterglow.png";
    case "candy":
      return "/r-candypop.png";
    case "stealth":
      return "/r-stealth.png";
    case "leaf":
      return "/r-leaf.png";
    default:
      return "/logo.png";
  }
}

/* ==================== APP ==================== */
export default function App() {
  const slots = useMemo(buildSlots, []);
  const [bank, setBank] = useState(0);
  const [tgId, setTgId] = useState(null);
  const [invitesCount, setInvitesCount] = useState(0);
  const [goldTickets, setGoldTickets] = useState(0);


  // Inventory: which skins the user owns (wheel + background)
  const [ownedWheelIds, setOwnedWheelIds] = useState(
    () => new Set(["classic"])
  );
  const [ownedBgIds, setOwnedBgIds] = useState(() => new Set(["default"]));

  const hasWheelSkin = (id) => ownedWheelIds.has(id);
  const hasBgSkin = (id) => ownedBgIds.has(id);

  // TON wallet & UI
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  // Generic TON payment helper
  const sendTonPayment = async (amountTon, purposeText = "Payment") => {
    if (!wallet) {
      setToast({ text: "Connect TON wallet first", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
      return false;
    }

    try {
      const validUntil = Math.floor(Date.now() / 1000) + 300;
      const nanoAmount = (amountTon * 1_000_000_000).toString();

      await tonConnectUI.sendTransaction({
        validUntil,
        messages: [
          {
            address: TREASURY_WALLET,
            amount: nanoAmount,
          },
        ],
      });

      setToast({
        text: `${purposeText} paid: ${amountTon} TON ✅`,
        key: Date.now(),
      });
      setTimeout(() => setToast(null), 1600);

      return true;
    } catch (e) {
      console.error("TON payment error", e);
      setToast({ text: "Payment cancelled or failed", key: Date.now() });
      setTimeout(() => setToast(null), 1600);
      return false;
    }
  };

  // TON-gated purchase for tiers
  const handleBuyTierTon = async (key) => {
    const t = TIERS[key];

    if (TIER_ORDER[key] <= TIER_ORDER[tierKey]) {
      setToast({
        text: "You already have this or higher tier",
        key: Date.now(),
      });
      setTimeout(() => setToast(null), 1600);
      return;
    }

    if (t.priceTon === 0) {
      await buyTier(key);
      return;
    }

    const ok = await sendTonPayment(t.priceTon, `Premium tier: ${t.name}`);
    if (!ok) return;

    await buyTier(key);
  };

  /* 🔹 Telegram Stars helper: create invoice on backend and open in Telegram */
  const createStarsInvoiceAndOpen = async (itemType, itemId) => {
    if (!tgId) {
      setToast({ text: "User not ready yet, try again", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/stars/create-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tg_id: tgId,
          item_type: itemType, // e.g. "tier"
          item_id: itemId, // e.g. "plus", "pro", "prem"
        }),
      });

      const data = await resp.json();

      if (!data.ok || !data.invoice_link) {
        console.error("Stars invoice error", data);
        setToast({ text: "Stars payment error, try again", key: Date.now() });
        setTimeout(() => setToast(null), 1500);
        return;
      }

      const link = data.invoice_link;
      const tg = window.Telegram?.WebApp;

      if (tg?.openTelegramLink) {
        tg.openTelegramLink(link);
      } else {
        window.open(link, "_blank");
      }
    } catch (e) {
      console.error("createStarsInvoiceAndOpen error", e);
      setToast({ text: "Stars payment error, try again", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
    }
  };

  /* Stars-gated purchase for tiers – unlock after backend confirms payment */
  const handleBuyTierStars = async (key) => {
    const t = TIERS[key];

    if (TIER_ORDER[key] <= TIER_ORDER[tierKey]) {
      setToast({
        text: "You already have this or higher tier",
        key: Date.now(),
      });
      setTimeout(() => setToast(null), 1600);
      return;
    }

    // Free tier in Stars context – just upgrade
    if (t.priceStars === 0) {
      await buyTier(key);
      return;
    }

    // For now, just open Stars payment invoice.
    // After payment, your bot webhook will update premium_tier in DB.
    await createStarsInvoiceAndOpen("tier", key);
  };

  // Skins: current equipped wheel + bg
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

  const equipWheelSkin = (id) => {
    setWheelSkinId(id);
    try {
      localStorage.setItem("rof_wheel_skin", id);
    } catch {}
  };

  const equipBgSkin = (id) => {
    setBgSkinId(id);
    try {
      localStorage.setItem("rof_bg_skin", id);
    } catch {}
  };

  // Load equipped skins from localStorage
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
  const [spinning, setSpinning] = useState(false);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("play");
  const [booting, setBooting] = useState(true);
  const [showPremium, setShowPremium] = useState(false);

  /* Leaderboard UI */
  const [lbTab, setLbTab] = useState("players");

  /* Loot tabs */
  const [lootTab, setLootTab] = useState("skins");

  /* Earn / referrals */
  const [myRefLink, setMyRefLink] = useState("");
  const [referrals, setReferrals] = useState([]);

    /* Task claim state (per user, local) */
  const [taskClaims, setTaskClaims] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("rof_task_claims") || "{}");
    } catch {
      return {};
    }
  });

  const saveTaskClaims = (next) => {
    setTaskClaims(next);
    try {
      localStorage.setItem("rof_task_claims", JSON.stringify(next));
    } catch {}
  };

    // Track whether user already clicked "Go" on link tasks
  const [taskVisited, setTaskVisited] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("rof_task_visited") || "{}");
    } catch {
      return {};
    }
  });

  const saveTaskVisited = (next) => {
    setTaskVisited(next);
    try {
      localStorage.setItem("rof_task_visited", JSON.stringify(next));
    } catch {}
  };

  const markTaskVisited = (id) => {
    const next = { ...taskVisited, [id]: true };
    saveTaskVisited(next);
  };



  /* Splash */
  useEffect(() => {
    const timer = setTimeout(() => {
      setBooting(false);
      const tg = window.Telegram?.WebApp;
      if (!tg) return;
      tg.ready();
      tg.setHeaderColor("#000000");
      tg.setBackgroundColor("#000000");
      tg.expand();
      tg.MainButton.hide();
      tg.MainButton.disable?.();
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  /* Theme follow */
  const [theme, setTheme] = useState({ bg: "#000", text: "#e8ecf2" });
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    const sync = () => {
      const p = tg.themeParams || {};
      setTheme({ bg: p.bg_color || "#000", text: p.text_color || "#e8ecf2" });
    };
    sync();
    tg.onEvent?.("themeChanged", sync);
    return () => tg.offEvent?.("themeChanged", sync);
  }, []);

  /* Sizes */
  const cx = 500,
    cy = 500;
  const R_FACE = 440 * 0.74;
  const R_TRIM = 470 * 0.74;
  const TRIM_W = 40;
  const LABEL_R = 360 * 0.74;
  const trimOuter = R_TRIM + TRIM_W / 2;
  const pointerTipY = cy - trimOuter + 2;
  const pointerBaseY = pointerTipY - 26;

  /* Wedges */
  const wedges = useMemo(() => {
    return Array.from({ length: SEGMENTS_TOTAL }, (_, i) => {
      const start = i * SEG_DEG;
      const end = start + SEG_DEG;
      const mid = (start + end) / 2;
      const path = wedgePathLocal(R_FACE, start, end);
      return { i, mid, path, labelR: LABEL_R };
    });
  }, []);

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
  useEffect(() => {
    let a = null;
    try {
      const ls = localStorage.getItem("rof_visAngle");
      if (ls != null) a = parseFloat(ls);
    } catch {}
    if (a == null || Number.isNaN(a)) {
      try {
        if (typeof window.__rofAngle === "number") a = window.__rofAngle;
      } catch {}
    }
    if (a == null || Number.isNaN(a)) a = 0;
    applyAngle(a);

    try {
      const savedCalc = parseFloat(localStorage.getItem("rof_calcRot"));
      if (!Number.isNaN(savedCalc)) calcRotRef.current = savedCalc;
    } catch {}

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
  }, []);

  /* Cancel RAF on unmount */
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

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
      else {
        animBusyRef.current = false;
        onDone?.();
      }
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

        const baseUser = {
          tg_id: tgUser.id,
          username: tgUser.username || null,
          full_name: [tgUser.first_name, tgUser.last_name]
            .filter(Boolean)
            .join(" "),
          photo_url: tgUser.photo_url || null,
        };

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

  let dbBalance =
    typeof data.balance === "number" ? data.balance : 0;
  let dbSpins =
    typeof data.spins_left === "number" ? data.spins_left : BASE_CAP;
  const dbInvites =
    typeof data.invites === "number" ? data.invites : 0;
  const dbTickets =
    typeof data.golden_tickets === "number" ? data.golden_tickets : 0;


          const now = Date.now();
          let lastSeenMs = data.last_seen
            ? new Date(data.last_seen).getTime()
            : now;

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
            setGoldTickets(dbTickets);   // ⬅️ NEW
            setNextReadyAt(nextReady);
            setNextInMs(nextMs);


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

  /* Load owned skins from roff_inventory when tgId is known */
  useEffect(() => {
    if (!tgId) return;

    const loadInventory = async () => {
      try {
        const { data, error } = await supabase
          .from("roff_inventory")
          .select("item_type, item_id")
          .eq("tg_id", tgId);

        if (error) {
          console.error("Failed to load inventory", error);
          return;
        }

        const wheelSet = new Set(["classic"]);
        const bgSet = new Set(["default"]);

        (data || []).forEach((row) => {
          if (row.item_type === "wheel" && row.item_id) {
            wheelSet.add(row.item_id);
          }
          if (row.item_type === "bg" && row.item_id) {
            bgSet.add(row.item_id);
          }
        });

        setOwnedWheelIds(wheelSet);
        setOwnedBgIds(bgSet);
      } catch (e) {
        console.error("Inventory load error", e);
      }
    };

    loadInventory();
  }, [tgId]);

    /* Referrals load from DB (use tgId synced from Telegram) */
  useEffect(() => {
    if (!tgId) return;

    fetchReferralsFromDB(tgId).then((rows) => {
      setReferrals(rows || []);
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

  /* Spin */
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

  /* Tier upgrade (after payment) */
  const buyTier = async (key) => {
    if (key === tierKey) return;

    if (TIER_ORDER[key] <= TIER_ORDER[tierKey]) {
      setToast({
        text: "You already have this or higher tier",
        key: Date.now(),
      });
      setTimeout(() => setToast(null), 1600);
      return;
    }

    const t = TIERS[key];
    const now = Date.now();

    setTierKey(key);
    try {
      localStorage.setItem("rof_premium_tier", key);
    } catch {}

    setSpinsLeft((s) => Math.min(s, t.cap));

    if (spinsLeft >= t.cap) {
      setNextReadyAt(null);
      setNextInMs(0);
      try {
        localStorage.removeItem("rof_nextReadyAt");
      } catch {}
    } else {
      const ts = now + Math.floor(BASE_REGEN_MS / t.regenMult);
      setNextReadyAt(ts);
      setNextInMs(ts - now);
      try {
        localStorage.setItem("rof_nextReadyAt", String(ts));
      } catch {}
    }

    if (tgId) {
      try {
        const { error } = await supabase
          .from("roff_users")
          .update({ premium_tier: key })
          .eq("tg_id", tgId);

        if (error) {
          console.error("Failed to update premium_tier in DB", error);
          setToast({
            text: "Tier saved locally, DB update failed",
            key: Date.now(),
          });
          setTimeout(() => setToast(null), 2000);
        }
      } catch (e) {
        console.error("Supabase error updating tier", e);
        setToast({
          text: "Tier saved locally, DB update failed",
          key: Date.now(),
        });
        setTimeout(() => setToast(null), 2000);
      }
    }

    setShowPremium(false);
    setToast({ text: `${t.name} activated!`, key: Date.now() });
    setTimeout(() => setToast(null), 1600);
  };

  /* Unlock helpers (DB inventory) */
  const handleUnlockWheelSkin = async (skin) => {
    if (!tgId) {
      setToast({ text: "User not ready yet", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
      return false;
    }

    if (hasWheelSkin(skin.id)) {
      equipWheelSkin(skin.id);
      return true;
    }

    try {
      const { error } = await supabase.from("roff_inventory").insert({
        tg_id: tgId,
        item_type: "wheel",
        item_id: skin.id,
      });

      if (error) {
        console.error("Failed to unlock wheel skin", error);
        setToast({ text: "Unlock failed, try again", key: Date.now() });
        setTimeout(() => setToast(null), 1500);
        return false;
      }

      setOwnedWheelIds((prev) => {
        const next = new Set(prev);
        next.add(skin.id);
        return next;
      });

      equipWheelSkin(skin.id);
      setToast({ text: `${skin.name} unlocked`, key: Date.now() });
      setTimeout(() => setToast(null), 1500);
      return true;
    } catch (e) {
      console.error("Unlock wheel skin error", e);
      return false;
    }
  };

  const handleUnlockBgSkin = async (skin) => {
    if (!tgId) {
      setToast({ text: "User not ready yet", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
      return false;
    }

    if (hasBgSkin(skin.id)) {
      equipBgSkin(skin.id);
      return true;
    }

    try {
      const { error } = await supabase.from("roff_inventory").insert({
        tg_id: tgId,
        item_type: "bg",
        item_id: skin.id,
      });

      if (error) {
        console.error("Failed to unlock bg skin", error);
        setToast({ text: "Unlock failed, try again", key: Date.now() });
        setTimeout(() => setToast(null), 1500);
        return false;
      }

      setOwnedBgIds((prev) => {
        const next = new Set(prev);
        next.add(skin.id);
        return next;
      });

      equipBgSkin(skin.id);
      setToast({ text: `${skin.name} unlocked`, key: Date.now() });
      setTimeout(() => setToast(null), 1500);
      return true;
    } catch (e) {
      console.error("Unlock bg skin error", e);
      return false;
    }
  };

  // TON-gated unlock for wheel skins
  const handleBuyWheelSkinTon = async (skin) => {
    // Already owned → just equip
    if (hasWheelSkin(skin.id)) {
      equipWheelSkin(skin.id);
      return;
    }

    // Free skin → just unlock in DB and equip
    if (skin.priceTon === 0) {
      await handleUnlockWheelSkin(skin);
      return;
    }

    const ok = await sendTonPayment(skin.priceTon, `Wheel skin: ${skin.name}`);
    if (!ok) return;

    await handleUnlockWheelSkin(skin);
  };

  // TON-gated unlock for background skins
  const handleBuyBgSkinTon = async (skin) => {
    if (hasBgSkin(skin.id)) {
      equipBgSkin(skin.id);
      return;
    }

    if (skin.priceTon === 0) {
      await handleUnlockBgSkin(skin);
      return;
    }

    const ok = await sendTonPayment(skin.priceTon, `Background: ${skin.name}`);
    if (!ok) return;

    await handleUnlockBgSkin(skin);
  };
      // ⭐ Telegram Stars unlock for wheel skins
  const handleBuyWheelSkinStars = async (skin) => {
    // If already owned, just equip
    if (hasWheelSkin(skin.id)) {
      equipWheelSkin(skin.id);
      return;
    }

    // Open Stars invoice for this wheel skin
    await createStarsInvoiceAndOpen("wheel", skin.id);
  };

  // ⭐ Telegram Stars unlock for background skins
  const handleBuyBgSkinStars = async (skin) => {
    if (hasBgSkin(skin.id)) {
      equipBgSkin(skin.id);
      return;
    }

    await createStarsInvoiceAndOpen("bg", skin.id);
  };


  /* Referral link */
  useEffect(() => {
    const code = getOrCreateMyRefCode();
    const link = `https://t.me/roffleapp_bot?start=${encodeURIComponent(
      code
    )}`;
    setMyRefLink(link);
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (!ref) return;
      const already = localStorage.getItem("rof_ref_claimed");
      const myCode = localStorage.getItem("rof_ref_code");
      if (already === "1") return;
      if (myCode && ref === myCode) return;

      setBank((b) => b + 200);
      setSpinsLeft((s) => Math.min(spinCap, s + 20));
      setToast({
        text: `+200 $ROF & +20 spins (invite)`,
        key: Date.now(),
      });
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
    } catch {}
  }, [spinCap]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(myRefLink);
      setToast({ text: "Copied link", key: Date.now() });
      setTimeout(() => setToast(null), 1200);
    } catch {}
  };
  const shareLink = () => {
    const text = `Spin & win on ROFFLE — we both get +20 spins & +200 $ROF:\n${myRefLink}`;
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink)
      tg.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(
          myRefLink
        )}&text=${encodeURIComponent(text)}`
      );
    else if (navigator.share)
      navigator
        .share({ title: "ROFFLE", text, url: myRefLink })
        .catch(() => {});
    else
      window.open(
        `https://t.me/share/url?url=${encodeURIComponent(
          myRefLink
        )}&text=${encodeURIComponent(text)}`,
        "_blank"
      );
  };

  const PremiumModal = () => {
  const tierDefs = [
    {
      key: "plus",
      header: "Premium⚡️",
      badge: "Premium",
      regen: "×2",
      cap: "40/40",
      mult: "×2",
      invites: "+50%",
    },
    {
      key: "pro",
      header: "Plus💫",
      badge: "Plus",
      regen: "×3",
      cap: "60/60",
      mult: "×3",
      invites: "+75%",
    },
    {
      key: "prem",
      header: "Pro👑",
      badge: "Pro",
      regen: "×5",
      cap: "100/100",
      mult: "×5",
      invites: "+100%",
    },
  ];

  const handleTonClick = (tierKeyTarget) => {
    const t = TIERS[tierKeyTarget];
    if (!t) return;
    const isLowerOrEqual = TIER_ORDER[tierKeyTarget] <= TIER_ORDER[tierKey];
    if (isLowerOrEqual) return;
    setShowPremium(false);
    handleBuyTierTon(tierKeyTarget);
  };

  const handleStarsClick = (tierKeyTarget) => {
    const t = TIERS[tierKeyTarget];
    if (!t) return;
    const isLowerOrEqual = TIER_ORDER[tierKeyTarget] <= TIER_ORDER[tierKey];
    if (isLowerOrEqual) return;
    setShowPremium(false);
    handleBuyTierStars(tierKeyTarget);
  };

  return (
    <div className="modal-overlay full" onClick={() => setShowPremium(false)}>
      <div className="modal vip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head vip-head">
          <div className="mh-left">
            <span className="mh-icon">👑</span>
            <div className="mh-title">Buy VIP Status</div>
          </div>
          <button
            className="modal-close"
            onClick={() => setShowPremium(false)}
          >
            ✕
          </button>
        </div>

        <div className="modal-body vip-body">
          <div className="vip-sub">
            Get your VIP up for more spins, extra rewards and time boost
          </div>

          <div className="vip-table">
            {/* Header row with tier names */}
            <div className="vip-row vip-row-head">
              <div className="vip-cell vip-cell-label" />
              {tierDefs.map((def) => (
    <div
      key={def.key}
      className={`vip-cell vip-cell-tier ${
        def.key === tierKey ? "vip-col-current" : ""
      }`}
    >
      <div className="vip-tier-name">{def.header}</div>
    </div>
  ))}
            </div>

            {/* Badge row */}
            <div className="vip-row">
              <div className="vip-cell vip-cell-label">Badge</div>
              {tierDefs.map((def) => (
                <div key={def.key} className="vip-cell vip-cell-value">
                  <span className={`tier-pill ${def.key}`}>
                    {def.badge}
                  </span>
                </div>
              ))}
            </div>

            {/* Regeneration speed */}
            <div className="vip-row">
              <div className="vip-cell vip-cell-label">Regeneration speed</div>
              {tierDefs.map((def) => (
                <div key={def.key} className="vip-cell vip-cell-value">
                  <b>{def.regen}</b>
                </div>
              ))}
            </div>

            {/* Wheel round limits */}
            <div className="vip-row">
              <div className="vip-cell vip-cell-label">Wheel round limits</div>
              {tierDefs.map((def) => (
                <div key={def.key} className="vip-cell vip-cell-value">
                  <b>{def.cap}</b>
                </div>
              ))}
            </div>

            {/* Wheel prize multiplier */}
            <div className="vip-row">
              <div className="vip-cell vip-cell-label">
                Wheel prize multiplier
              </div>
              {tierDefs.map((def) => (
                <div key={def.key} className="vip-cell vip-cell-value">
                  <b>{def.mult}</b>
                </div>
              ))}
            </div>

            {/* Friends invite rewards */}
            <div className="vip-row">
              <div className="vip-cell vip-cell-label">
                Friends invite rewards
              </div>
              {tierDefs.map((def) => (
                <div key={def.key} className="vip-cell vip-cell-value">
                  <b>{def.invites}</b>
                </div>
              ))}
            </div>

            {/* Welcome rewards */}
            <div className="vip-row">
              <div className="vip-cell vip-cell-label">Welcome rewards</div>
              {tierDefs.map((def) => (
                <div key={def.key} className="vip-cell vip-cell-value">
                  <b>Yes</b>
                </div>
              ))}
            </div>

            {/* ROFFLE bonuses */}
            <div className="vip-row">
              <div className="vip-cell vip-cell-label">
                ROFFLE bonuses & pools
              </div>
              {tierDefs.map((def) => (
                <div key={def.key} className="vip-cell vip-cell-value">
                  <b>Yes</b>
                </div>
              ))}
            </div>

            {/* Buttons row */}
<div className="vip-row vip-row-buttons">
  <div className="vip-cell vip-cell-label" />
  {tierDefs.map((def) => {
    const t = TIERS[def.key];
    if (!t) return null;

    const isCurrent = def.key === tierKey;
    const isLower = TIER_ORDER[def.key] < TIER_ORDER[tierKey];

    let tonLabel = `${t.priceTon} TON`;
    let starLabel = `${t.priceStars}`;
    let disabled = false;

    if (isCurrent) {
      tonLabel = "Owned";
      starLabel = "Owned";
      disabled = true;
    } else if (isLower) {
      tonLabel = "N/A";
      starLabel = "N/A";
      disabled = true;
    }

    const colClasses = `vip-cell vip-cell-value ${
      isCurrent ? "vip-col-current" : ""
    }`;

    return (
      <div key={def.key} className={colClasses}>
        <div className="vip-btn-row">
          <button
            className="pill-ton"
            disabled={disabled}
            onClick={() =>
              !disabled && handleTonClick(def.key)
            }
          >
            <span className="pill-ton-icon" />
            <span className="pill-ton-text">{tonLabel}</span>
          </button>
          <button
            className="pill-stars"
            disabled={disabled}
            onClick={() =>
              !disabled && handleStarsClick(def.key)
            }
          >
            <span className="pill-stars-text">
              ⭐️ {starLabel}
            </span>
          </button>
        </div>
      </div>
    );
  })}
</div>
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
            className={`loot-tab ${
              lootTab === "collectibles" ? "on" : ""
            }`}
            onClick={() => setLootTab("collectibles")}
          >
            Collectibles
          </button>
        </div>

        {/* WHEEL SKINS */}
        {lootTab === "skins" && (
  <div className="loot-section">
    <div className="loot-title">🎨 Wheel Skins</div>
    <div className="loot-list">
      {WHEEL_SKINS.map((skin) => {
        const isActive = skin.id === wheelSkinId;
        const owned =
          hasWheelSkin(skin.id) ||
          (skin.priceTon === 0 && skin.priceStars === 0);

        const previewStyle = getWheelPreviewStyle(skin);

        return (
          <div
            key={skin.id}
            className={`loot-row ${isActive ? "active" : ""}`}
          >
            <div className="loot-left">
              <div className="loot-preview" style={previewStyle} />
              <div className="loot-text">
                <div className="loot-row-name">{skin.name}</div>
              </div>
            </div>

            <div className="loot-right">
              {isActive ? null : owned ? (
                <button
                  className="loot-equip-btn gradient-outline-btn"
                  onClick={() => equipWheelSkin(skin.id)}
                >
                  Equip
                </button>
              ) : (
                <div className="loot-actions">
                  <button
                    className="pill-ton"
                    onClick={() => handleBuyWheelSkinTon(skin)}
                  >
                    <span className="pill-ton-icon" />
                    <span className="pill-ton-text">
                      {skin.priceTon} TON
                    </span>
                  </button>

                  <button
                    className="pill-stars"
                    onClick={() => handleBuyWheelSkinStars(skin)}
                  >
                    <span className="pill-stars-text">
                      ⭐️ {skin.priceStars}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}


        {/* BACKGROUND SKINS */}
        {lootTab === "mood" && (
  <div className="loot-section">
    <div className="loot-title">🖼 Background Skins</div>
    <div className="loot-list">
      {BG_SKINS.map((skin) => {
        const isActive = skin.id === bgSkinId;
        const owned =
          hasBgSkin(skin.id) ||
          (skin.priceTon === 0 && skin.priceStars === 0);

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
              </div>
            </div>

            <div className="loot-right">
              {isActive ? null : owned ? (
                <button
                  className="loot-equip-btn gradient-outline-btn"
                  onClick={() => equipBgSkin(skin.id)}
                >
                  Equip
                </button>
              ) : (
                <div className="loot-actions">
                  <button
                    className="pill-ton"
                    onClick={() => handleBuyBgSkinTon(skin)}
                  >
                    <span className="pill-ton-icon" />
                    <span className="pill-ton-text">
                      {skin.priceTon} TON
                    </span>
                  </button>

                  <button
                    className="pill-stars"
                    onClick={() => handleBuyBgSkinStars(skin)}
                  >
                    <span className="pill-stars-text">
                      ⭐️ {skin.priceStars}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}


        {/* COLLECTIBLES PLACEHOLDER */}
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

  function AvatarInline({ name, photo }) {
    if (photo) return <img className="lb-avatar" src={photo} alt={name} />;
    const bg = randomItem(DEMO_AVATAR_COLORS);
    return (
      <div className="lb-avatar fallback" style={{ background: bg }}>
        {initials(name)}
      </div>
    );
  }
  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  }

  const EarnScreen = () => {
    const invitedCount = invitesCount;
    const estBonus = invitedCount * 200;
    return (
      <div className="earn-wrap">
        <div className="card gradient-border">
          <div className="card-head">
            <div className="card-title">Invite friends</div>
            <div className="reward-pill">
              🎁 Both get <b>+20 spins</b> & <b>+200 $ROF</b>
            </div>
          </div>

          <div className="ref-link-box">
            <input className="ref-input" value={myRefLink} readOnly />
            <div className="ref-actions">
              <button
                className="btn small gradient-outline-btn"
                onClick={copyLink}
              >
                Copy
              </button>
              <button
                className="btn small gradient-outline-btn"
                onClick={shareLink}
              >
                Share
              </button>
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
          <div className="disclaimer">
            *Allow up to 10 minutes for invites and coins to appear in dashboard.
          </div>
        </div>

        <div className="card list-card gradient-border">
          <div className="card-title">Recent sign-ups via your link</div>
          <div className="ref-list">
            {referrals.length === 0 && (
              <div className="empty">
                No referrals yet. Share your link to start earning!
              </div>
            )}
            {referrals.map((r, i) => (
              <div key={r.id || i} className="ref-row">
                <AvatarInline name={r.name || "User"} photo={r.photo || ""} />
                <div className="ref-meta">
                  <div className="ref-name">{r.name || "User"}</div>
                  <div className="ref-sub">
                    <TierBadge tierKey={r.tier || "free"} />
                    {r.username && (
                      <span className="ref-username">{r.username}</span>
                    )}
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
        case "bloody":
          return "rim-bloody";
        case "emerald":
          return "rim-emerald";
        case "ice":
          return "rim-ice";
        case "cyber":
          return "rim-cyber";
        case "royal":
          return "rim-royal";
        case "retro":
          return "rim-retro";
        case "candy":
          return "rim-candy";
        case "stealth":
          return "rim-stealth";
        case "classic":
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

                if (styleKey === "classic") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#43cda3" />
                        <stop offset="100%" stopColor="#490e6d" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#404040" />
                        <stop offset="100%" stopColor="#000000" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="100%" stopColor="#a8a8a8" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "neon") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="#19FB9B" />
                        <stop offset="50%" stopColor="#5ce1e6" />
                        <stop offset="100%" stopColor="#b50be5" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="#111827" />
                        <stop offset="100%" stopColor="#312e81" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="#0f172a" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "bloody") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#ffef9a" />
                        <stop offset="100%" stopColor="#c2410c" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#7f1d1d" />
                        <stop offset="100%" stopColor="#111827" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#b91c1c" />
                        <stop offset="100%" stopColor="#000000" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "emerald") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#bbf7d0" />
                        <stop offset="100%" stopColor="#166534" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#064e3b" />
                        <stop offset="100%" stopColor="#020617" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#16a34a" />
                        <stop offset="100%" stopColor="#052e16" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "ice") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#e0f2fe" />
                        <stop offset="100%" stopColor="#0369a1" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#0f172a" />
                        <stop offset="100%" stopColor="#0b1120" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#e0f2fe" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "lava") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#fee2e2" />
                        <stop offset="100%" stopColor="#b91c1c" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#7f1d1d" />
                        <stop offset="100%" stopColor="#111827" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#450a0a" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "cyber") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#4c1d95" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="#020617" />
                        <stop offset="100%" stopColor="#111827" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "royal") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#f5e7ff" />
                        <stop offset="100%" stopColor="#5b21b6" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#1e1b4b" />
                        <stop offset="100%" stopColor="#020617" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#7c3aed" />
                        <stop offset="100%" stopColor="#fbbf24" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "toxic") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#ecfccb" />
                        <stop offset="100%" stopColor="#65a30d" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#14532d" />
                        <stop offset="100%" stopColor="#022c22" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#a3e635" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "retro") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#f9a8d4" />
                        <stop offset="100%" stopColor="#7e22ce" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#0f172a" />
                        <stop offset="100%" stopColor="#1f2933" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#fb7185" />
                        <stop offset="100%" stopColor="#38bdf8" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "galaxy") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#e5e7eb" />
                        <stop offset="100%" stopColor="#0f172a" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#020617" />
                        <stop offset="100%" stopColor="#111827" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#4f46e5" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "candy") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#fecaca" />
                        <stop offset="100%" stopColor="#f97316" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#f9a8d4" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#bef264" />
                        <stop offset="100%" stopColor="#fb7185" />
                      </linearGradient>
                    );
                  }
                }

                if (styleKey === "stealth") {
                  if (sec1 === 1) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#e5e7eb" />
                        <stop offset="100%" stopColor="#4b5563" />
                      </linearGradient>
                    );
                  } else if (sec1 % 2 === 0) {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#020617" />
                        <stop offset="100%" stopColor="#111827" />
                      </linearGradient>
                    );
                  } else {
                    return (
                      <linearGradient
                        id={id}
                        key={id}
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#111827" />
                        <stop offset="100%" stopColor="#374151" />
                      </linearGradient>
                    );
                  }
                }

                if (sec1 === 1) {
                  return (
                    <linearGradient
                      id={id}
                      key={id}
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#43cda3" />
                      <stop offset="100%" stopColor="#490e6d" />
                    </linearGradient>
                  );
                } else if (sec1 % 2 === 0) {
                  return (
                    <linearGradient
                      id={id}
                      key={id}
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#404040" />
                      <stop offset="100%" stopColor="#000000" />
                    </linearGradient>
                  );
                } else {
                  return (
                    <linearGradient
                      id={id}
                      key={id}
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="100%" stopColor="#a8a8a8" />
                    </linearGradient>
                  );
                }
              })}

              <linearGradient id="rim-classic" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f6e19a" />
                <stop offset="50%" stopColor="#caa03a" />
                <stop offset="100%" stopColor="#7a5d19" />
              </linearGradient>

              <linearGradient id="rim-bloody" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fecaca" />
                <stop offset="50%" stopColor="#b91c1c" />
                <stop offset="100%" stopColor="#450a0a" />
              </linearGradient>

              <linearGradient
                id="rim-emerald"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#bbf7d0" />
                <stop offset="50%" stopColor="#16a34a" />
                <stop offset="100%" stopColor="#022c22" />
              </linearGradient>

              <linearGradient id="rim-ice" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e0f2fe" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>

              <linearGradient
                id="rim-cyber"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#a7f3d0" />
                <stop offset="50%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#0b1120" />
              </linearGradient>

              <linearGradient
                id="rim-royal"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#e9d5ff" />
                <stop offset="50%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#1e1b4b" />
              </linearGradient>

              <linearGradient
                id="rim-retro"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#f9a8d4" />
                <stop offset="50%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>

              <linearGradient
                id="rim-candy"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="50%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>

              <linearGradient
                id="rim-stealth"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#e5e7eb" />
                <stop offset="50%" stopColor="#9ca3af" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>

              <filter
                id="textGlow"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="3"
                  floodColor="#36125e"
                  floodOpacity="1"
                />
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="6"
                  floodColor="#36125e"
                  floodOpacity=".85"
                />
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="10"
                  floodColor="#36125e"
                  floodOpacity=".6"
                />
              </filter>
            </defs>

            <g className="wheel-root" transform={`translate(${cx} ${cy})`}>
              <circle
                r={R_TRIM}
                fill="none"
                stroke={`url(#${rimGradientId})`}
                strokeWidth={TRIM_W}
              />

              <g
                className="rotor"
                data-angle={angleState}
                transform={`rotate(${START_OFFSET + angleState})`}
              >
                {wedges.map(({ i, path }) => (
                  <path key={`p${i}`} d={path} fill={`url(#grad-${i})`} />
                ))}

                {wedges.map(({ i, mid, labelR }) => {
                  const sec1 = i + 1;
                  const isMax = sec1 === 1;
                  const baseAmount = slots[i].amount || 0;
                  const shown = baseAmount * prizeMult;

                  const isYellowStyle =
                    wheelSkin.id === "bloody" ||
                    wheelSkin.id === "emerald" ||
                    wheelSkin.id === "stealth";

                  let textFill;
                  if (isYellowStyle) {
                    if (baseAmount === 1) {
                      textFill = "#ffffff";
                    } else {
                      textFill = "#facc15";
                    }
                  } else {
                    textFill =
                      sec1 === 1
                        ? "#fff"
                        : sec1 % 2 === 0
                        ? "#fff"
                        : "#000";
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
          <button
            className="btn-spin"
            onClick={handleSpin}
            disabled={spinning || animBusyRef.current || spinsLeft <= 0}
          >
            <span className="spin-count">
              {spinsLeft}/{spinCap}{" "}
              <span className="muted">Spins left</span>
            </span>
            <span className="spin-cta">
              {spinning ? "Spinning…" : "Spin"}
            </span>
            <span className="spin-timer">
              {spinsLeft < spinCap
                ? `Next spin in ${formatMs(nextInMs)}`
                : "Ready"}
            </span>
          </button>
        </div>
      </>
    );
  };

    const handleClaimTask = (task) => {
  // already claimed
  if (taskClaims[task.id]) return;

  // Invite-type tasks must check invitesCount
  if (task.type === "invite") {
    const need = task.requiresInvites || 0;
    if (invitesCount < need) {
      setToast({
        text: `You need ${need} invites to claim this`,
        key: Date.now(),
      });
      setTimeout(() => setToast(null), 1500);
      return;
    }
  }

  const reward = task.reward || {};
  const rofAdd = reward.rof || 0;
  const spinsAdd = reward.spins || 0;
  const ticketsAdd = reward.tickets || 0;

  // Apply rewards locally + save to DB for coins / spins / golden tickets
  if (rofAdd) {
    setBank((prev) => {
      const nb = prev + rofAdd;
      if (tgId) {
        supabase
          .from("roff_users")
          .update({ balance: nb })
          .eq("tg_id", tgId)
          .then(() => {})
          .catch((e) => console.error("Task balance update failed", e));
      }
      return nb;
    });
  }

  if (spinsAdd) {
    setSpinsLeft((prev) => {
      const ns = Math.min(spinCap, prev + spinsAdd);
      if (tgId) {
        supabase
          .from("roff_users")
          .update({ spins_left: ns })
          .eq("tg_id", tgId)
          .then(() => {})
          .catch((e) => console.error("Task spins update failed", e));
      }
      return ns;
    });
  }

  // 🔥 NEW: persist golden tickets in DB as well
  if (ticketsAdd) {
    setGoldTickets((prev) => {
      const nt = prev + ticketsAdd;
      if (tgId) {
        supabase
          .from("roff_users")
          .update({ golden_tickets: nt })
          .eq("tg_id", tgId)
          .then(() => {})
          .catch((e) =>
            console.error("Task golden_tickets update failed", e)
          );
      }
      return nt;
    });
  }

  const nextClaims = { ...taskClaims, [task.id]: true };
  saveTaskClaims(nextClaims);

  const parts = [];
  if (rofAdd) parts.push(`+${rofAdd} $ROF`);
  if (spinsAdd) parts.push(`+${spinsAdd} spins`);
  if (ticketsAdd)
    parts.push(
      `+${ticketsAdd} Golden Ticket${ticketsAdd > 1 ? "s" : ""}`
    );

  if (parts.length) {
    setToast({ text: parts.join(" & "), key: Date.now() });
    setTimeout(() => setToast(null), 1600);
  }
};


      const handleLinkGo = (task) => {
  if (!task.url) return;

  const tg = window.Telegram?.WebApp;
  const url = task.url;

  try {
    // Telegram chats/channels → use openTelegramLink
    if (url.startsWith("https://t.me")) {
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(url);
      } else {
        window.open(url, "_blank");
      }
    } else {
      // Any external site (X, websites, etc.)
      if (tg?.openLink) {
        tg.openLink(url);
      } else {
        window.open(url, "_blank");
      }
    }
  } catch (e) {
    console.error("Task link open error", e);
    // Fallback: at least try to open a browser tab
    window.open(url, "_blank");
  }

  // mark the task as visited so it can flip to "Claim"
  markTaskVisited(task.id);
};




      const TasksScreen = () => {
  // Build nice rich reward line per task
  const renderReward = (task) => {
    const reward = task.reward || {};
    const parts = [];

    if (reward.rof) {
      parts.push(
        <span key="rof">
          <strong>+{reward.rof.toLocaleString()} $ROF</strong>
        </span>
      );
    }

    if (reward.spins) {
      parts.push(
        <span key="spins">
          <strong>+{reward.spins} spins</strong>
        </span>
      );
    }

    if (reward.tickets) {
      const label = `+${reward.tickets} Golden Ticket${
        reward.tickets > 1 ? "s" : ""
      }`;

      parts.push(
        <span
          key="tickets"
          style={
            task.id === "invite_10"
              ? { color: "#facc15", fontWeight: 800 } // gold for +1 Golden Ticket
              : { fontWeight: 800 }
          }
        >
          {label}
        </span>
      );
    }

    if (!parts.length) return null;

    // Join parts with " · "
    const interleaved = [];
    parts.forEach((p, i) => {
      if (i > 0) {
        interleaved.push(
          <span key={`sep-${i}`} style={{ opacity: 0.7 }}>
            {" "}
            ·{" "}
          </span>
        );
      }
      interleaved.push(p);
    });

    return <div className="loot-row-tag">{interleaved}</div>;
  };

  return (
    <div className="loot-section">
      <div className="loot-title">🕹 Tasks</div>
      <div className="loot-list">
        {TASKS.map((task) => {
          const isClaimed = !!taskClaims[task.id];
          const visited = !!taskVisited[task.id];

          const canClaim =
            task.type === "invite"
              ? invitesCount >= (task.requiresInvites || 0)
              : true;

          // same squircle-style icon as Skins / Mood
          const previewStyle = {
            backgroundImage: `url(${task.icon})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          };

          return (
            <div key={task.id} className="loot-row">
              <div className="loot-left">
                <div className="loot-preview" style={previewStyle} />
                <div className="loot-text">
                  <div className="loot-row-name">{task.title}</div>

                  {/* Reward line (BOLD, with gold ticket highlight for invite_10) */}
                  {renderReward(task)}

                  {/* Progress for invite tasks */}
                  {task.type === "invite" && (
                    <div className="loot-row-tag">
                      Invites:{" "}
                      {Math.min(invitesCount, task.requiresInvites || 0)}/
                      {task.requiresInvites}
                    </div>
                  )}
                </div>
              </div>

              <div className="loot-right">
                {isClaimed ? (
                  // Already claimed
                  <button
                    className="loot-equip-btn gradient-outline-btn"
                    disabled
                  >
                    Done
                  </button>
                ) : task.type === "link" ? (
                  // LINK TASKS: Go → Claim
                  visited ? (
                    <button
                      className="loot-equip-btn gradient-outline-btn"
                      onClick={() => handleClaimTask(task)}
                    >
                      Claim
                    </button>
                  ) : (
                    <button
                      className="loot-equip-btn gradient-outline-btn"
                      onClick={() => handleOpenTaskLink(task)}
                    >
                      Go
                    </button>
                  )
                ) : (
                  // INVITE TASKS: Claim when ready
                  <button
                    className="loot-equip-btn gradient-outline-btn"
                    disabled={!canClaim}
                    onClick={() => handleClaimTask(task)}
                  >
                    {canClaim ? "Claim" : "Claim"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};




  const Menu = () => (
    <nav className="bottom-menu">
      <button
        className={`menu-item ${tab === "play" ? "on" : ""}`}
        onClick={() => setTab("play")}
      >
        <span className="mi-emoji">🎮</span>
        <span className="mi-text">Play</span>
      </button>
      <button
        className={`menu-item ${tab === "loot" ? "on" : ""}`}
        onClick={() => setTab("loot")}
      >
        <span className="mi-emoji">🎁</span>
        <span className="mi-text">Loot</span>
      </button>
      <button
        className={`menu-item ${tab === "top" ? "on" : ""}`}
        onClick={() => {
          setTab("top");
          setLbTab("players");
        }}
      >
        <span className="mi-emoji">🏆</span>
        <span className="mi-text">Top100</span>
      </button>
      <button
        className={`menu-item ${tab === "earn" ? "on" : ""}`}
        onClick={() => setTab("earn")}
      >
        <span className="mi-emoji">🚀</span>
        <span className="mi-text">Earn</span>
      </button>
      <button
        className={`menu-item ${tab === "tasks" ? "on" : ""}`}
        onClick={() => setTab("tasks")}
      >
        <span className="mi-emoji">🕹</span>
        <span className="mi-text">Tasks</span>
      </button>
    </nav>
  );

  const statusBadge = (() => {
    if (tierKey === "free") return { cls: "free", text: "No status" };
    if (tierKey === "plus") return { cls: "premium", text: "Premium⚡️" };
    if (tierKey === "pro") return { cls: "plus", text: "Plus⭐️" };
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
            <img
              src={BRAND_LOGO_SRC}
              alt="ROFFLE"
              className="brand-logo"
            />
            <div className="header-right">
              <TonConnectButton />
            </div>
          </header>

          <section className="balance-block compacted">
  <div className="bal-line1">Your Assets:</div>

  <div className="bal-line2 dual-balance">
    {/* ROF balance */}
    <div className="bal-item">
      <img className="bal-icon" src="/rof-bn.png" alt="$ROF" />
      <span className="bal-value rof-balance">{bank}</span>
    </div>

    {/* Golden tickets balance */}
    <div className="bal-item">
      <img className="bal-icon" src="/golden-ticket.png" alt="Tickets" />
      <span className="bal-value ticket-balance">{goldTickets}</span>
    </div>
  </div>

  <div className="premium-row">
    <button
      className="btn-premium"
      onClick={() => setShowPremium(true)}
    >
      👑Get VIP Status
    </button>
    <span className={`badge ${statusBadge.cls}`}>
      {statusBadge.text}
    </span>
  </div>

  {/* Wallet pill */}
  {wallet && (
    <div className="premium-row">
      <span className="wallet-pill">
        {wallet.account.address.slice(0, 4)}…
        {wallet.account.address.slice(-4)}
      </span>
    </div>
  )}
</section>



          <div className="screen flex-grow">
            {tab === "play" && <PlayScreen wheelSkin={wheelSkin} />}
            {tab === "loot" && <LootScreen />}
            {tab === "top" && (
              <TopScreen lbTab={lbTab} onTabChange={setLbTab} />
            )}
            {tab === "earn" && <EarnScreen />}
            {tab === "tasks" && <TasksScreen />}
          </div>

          {toast && (
            <div key={toast.key} className="toast-win">
              {toast.text}
            </div>
          )}

          <Menu />
        </div>
      )}

      {showPremium && <PremiumModal />}
    </div>
  );
}
