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
      setShowPremium(false);
      await buyTier(key);
      return;
    }

    // Close VIP screen so Telegram payment sheet is clearly visible
    setShowPremium(false);

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
      setShowPremium(false);
      await buyTier(key);
      return;
    }

    // Close VIP screen before opening Stars invoice
    setShowPremium(false);

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

  /* Referrals load from DB */
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


/* ⭐ Telegram Stars unlock for wheel skins */
const handleBuyWheelSkinStars = async (skin) => {
  // Already owned → just equip
  if (hasWheelSkin(skin.id)) {
    equipWheelSkin(skin.id);
    return;
  }

  // Free / included → unlock directly
  if (skin.priceStars === 0) {
    await handleUnlockWheelSkin(skin);
    return;
  }

  // Open Stars invoice (item_type = "wheel")
  await createStarsInvoiceAndOpen("wheel", skin.id);
  // After successful payment your bot webhook should insert
  // (tg_id, "wheel", skin.id) into roff_inventory.
};

/* ⭐ Telegram Stars unlock for background skins */
const handleBuyBgSkinStars = async (skin) => {
  if (hasBgSkin(skin.id)) {
    equipBgSkin(skin.id);
    return;
  }

  if (skin.priceStars === 0) {
    await handleUnlockBgSkin(skin);
    return;
  }

  // Open Stars invoice (item_type = "bg")
  await createStarsInvoiceAndOpen("bg", skin.id);
  // After successful payment your bot webhook should insert
  // (tg_id, "bg", skin.id) into roff_inventory in Supabaseory.
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
      // Merge this local referral into existing DB-loaded list instead of overwriting
      setReferrals((prev) => [row, ...prev]);
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
      short: "Premium",
      badge: "Premium⚡️",
      regen: "×2",
      cap: "40/40",
      mult: "×2",
      invites: "+50%",
    },
    {
      key: "pro",
      short: "Plus",
      badge: "Plus💫",
      regen: "×3",
      cap: "60/60",
      mult: "×3",
      invites: "+75%",
    },
    {
      key: "prem",
      short: "Pro",
      badge: "Pro 👑",
      regen: "×5",
      cap: "100/100",
      mult: "×5",
      invites: "+100%",
    },
  ];

  return (
    <div
      className="modal-overlay premium-overlay"
      onClick={() => setShowPremium(false)}
    >
      <div
        className="modal premium-full gradient-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="premium-head">
          <button
            className="modal-back"
            onClick={() => setShowPremium(false)}
          >
            ← Back
          </button>
          <div className="mh-center">
            <div className="mh-title">👑Buy VIP Status</div>
            <div className="mh-subtitle">
              Get your VIP up for more spins, extra rewards and time boost
            </div>
          </div>
          <button
            className="modal-close"
            onClick={() => setShowPremium(false)}
          >
            ✕
          </button>
        </div>

        <div className="modal-body premium-body">
          <div className="premium-table">
            {/* Header row */}
            <div className="premium-table-header">
              <div className="ptc label-cell">Badge</div>
              {tierDefs.map((def) => {
                const active = def.key === tierKey;
                return (
                  <div key={def.key} className="ptc tier-header">
                    <div className="tier-header-name">{def.short}</div>
                    {active && <div className="tier-current">Current</div>}
                  </div>
                );
              })}
            </div>

            {/* Badge row */}
            <div className="premium-table-row striped">
              <div className="ptc label-cell">Badge</div>
              {tierDefs.map((def) => (
                <div key={def.key} className="ptc value-cell">
                  <span className={`tier-pill ${def.key}`}>
                    {def.badge}
                  </span>
                </div>
              ))}
            </div>

            {/* Regeneration Speed */}
            <div className="premium-table-row">
              <div className="ptc label-cell">Regeneration speed</div>
              {tierDefs.map((def) => (
                <div key={def.key} className="ptc value-cell">
                  <b>{def.regen}</b>
                </div>
              ))}
            </div>

            {/* Wheel round limits */}
            <div className="premium-table-row striped">
              <div className="ptc label-cell">Wheel Round Limits</div>
              {tierDefs.map((def) => (
                <div key={def.key} className="ptc value-cell">
                  <b>{def.cap}</b>
                </div>
              ))}
            </div>

            {/* Wheel prize multiplier */}
            <div className="premium-table-row">
              <div className="ptc label-cell">Wheel Prize Multiplier</div>
              {tierDefs.map((def) => (
                <div key={def.key} className="ptc value-cell">
                  <b>{def.mult}</b>
                </div>
              ))}
            </div>

            {/* Friends invite rewards */}
            <div className="premium-table-row striped">
              <div className="ptc label-cell">Friends Invite Rewards</div>
              {tierDefs.map((def) => (
                <div key={def.key} className="ptc value-cell">
                  <b>{def.invites}</b>
                </div>
              ))}
            </div>

            {/* Claimable welcome rewards */}
            <div className="premium-table-row">
              <div className="ptc label-cell">Claimable Welcome Rewards</div>
              {tierDefs.map((def) => (
                <div key={def.key} className="ptc value-cell">
                  Yes
                </div>
              ))}
            </div>

            {/* ROFFLE bonuses & prize pools */}
            <div className="premium-table-row striped">
              <div className="ptc label-cell">
                ROFFLE Bonuses and Prize Pools
              </div>
              {tierDefs.map((def) => (
                <div key={def.key} className="ptc value-cell">
                  Yes
                </div>
              ))}
            </div>

            {/* Buy row */}
            <div className="premium-table-row premium-buy-row">
              <div className="ptc label-cell"></div>
              {tierDefs.map((def) => {
                const t = TIERS[def.key];
                const isLowerOrEqual =
                  TIER_ORDER[def.key] <= TIER_ORDER[tierKey];
                const disabled = isLowerOrEqual;
                const isCurrent = def.key === tierKey;

                return (
                  <div key={def.key} className="ptc value-cell">
                    <div className="buy-button-group">
                      <button
                        className="btn-tier-ton"
                        disabled={disabled}
                        onClick={() =>
                          !disabled && handleBuyTierTon(def.key)
                        }
                      >
                        {isCurrent || isLowerOrEqual ? (
                          <span>
                            {isCurrent ? "Current" : "N/A"}
                          </span>
                        ) : (
                          <span className="btn-tier-ton-inner">
                            <img
                              src="/ton-icon.png"
                              alt="TON"
                              className="btn-ton-icon"
                            />
                            <span>{t.priceTon} TON</span>
                          </span>
                        )}
                      </button>

                      <button
                        className="btn-tier-stars gradient-outline-btn"
                        disabled={disabled}
                        onClick={() =>
                          !disabled && handleBuyTierStars(def.key)
                        }
                      >
                        {isCurrent || isLowerOrEqual ? (
                          <span>
                            {isCurrent ? "Current" : "N/A"}
                          </span>
                        ) : (
                          <span>⭐ {t.priceStars}</span>
                        )}
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

