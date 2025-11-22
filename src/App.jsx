import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
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

/* ================= BUNDLES CONFIG ================= */

const BUNDLES = [
  {
    id: "mini",
    name: "Mini Bundle",
    icon: "/mini.png",
    rof: 20000,
    spins: 100,
    tickets: 1,
    priceTon: 2,
    priceStars: 299,
  },
  {
    id: "medi",
    name: "Medi Bundle",
    icon: "/medi.png",
    rof: 50000,
    spins: 250,
    tickets: 2,
    priceTon: 4,
    priceStars: 599,
  },
  {
    id: "maxi",
    name: "Maxi Bundle",
    icon: "/maxi.png",
    rof: 125000,
    spins: 500,
    tickets: 3,
    priceTon: 8,
    priceStars: 1199,
  },
];


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
    // +50 spins added
    reward: { rof: 1000, spins: 50, tickets: 0 },
  },
  {
    id: "follow_x",
    icon: "/x-icon.png",
    title: "Follow ROFFLE on X",
    type: "link",
    url: "https://twitter.com/rofflereal",
    // +50 spins added
    reward: { rof: 1000, spins: 50, tickets: 0 },
  },
  {
    id: "invite_1",
    icon: "/1inv-icon.png",
    title: "Invite 1 Friend",
    type: "invite",
    requiresInvites: 1,
    // +50 spins added
    reward: { rof: 2500, spins: 50, tickets: 0 },
  },
  {
    id: "invite_3",
    icon: "/3inv-icon.png",
    title: "Invite 3 Friends",
    type: "invite",
    requiresInvites: 3,
    // +100 spins added
    reward: { rof: 10000, spins: 100, tickets: 0 },
  },
  {
    id: "invite_5",
    icon: "/5inv-icon.png",
    title: "Invite 5 Friends",
    type: "invite",
    requiresInvites: 5,
    // +200 spins added
    reward: { rof: 20000, spins: 200, tickets: 0 },
  },
  {
    id: "invite_10",
    icon: "/10inv-icon.png",
    title: "Invite 10 Friends",
    type: "invite",
    requiresInvites: 10,
    // +500 spins added (keeps +1 Golden Ticket)
    reward: { rof: 50000, spins: 500, tickets: 1 }, // +1 Golden Ticket
  },
];

/* ================= COLLECTIBLES – "Meet $ROF" ================= */
/*
Grid: 4 rows x 5 columns
Row 1: smallest requirement, Row 4: largest requirement (per column)
Columns: Spins | Earn | Log-ins | Invites | Golden Tickets
*/

const MEET_ROF_COLLECTIBLES = [
  // Row 1
  {
    id: "spin_100",
    metric: "spins",
    threshold: 100,
    title: "Spin Wheel 100 times",
    icon: "/coll-wheel01.png",
  },
  {
    id: "earn_10k",
    metric: "rof",
    threshold: 10_000,
    title: "Earn 10,000 $ROF",
    icon: "/coll-earn10k.png",
  },
  {
    id: "login_3",
    metric: "login",
    threshold: 3,
    title: "Log-in 3 days",
    icon: "/coll-log3.png",
  },
  {
    id: "inv_1",
    metric: "invite",
    threshold: 1,
    title: "Invite 1 friend",
    icon: "/coll-inv1.png",
  },
  {
    id: "gt_1",
    metric: "ticket",
    threshold: 1,
    title: "Obtain 1 Golden Ticket",
    icon: "/coll-gt1.png",
  },

  // Row 2
  {
    id: "spin_1000",
    metric: "spins",
    threshold: 1_000,
    title: "Spin Wheel 1,000 times",
    icon: "/coll-wheel1.png",
  },
  {
    id: "earn_50k",
    metric: "rof",
    threshold: 50_000,
    title: "Earn 50,000 $ROF",
    icon: "/coll-earn50k.png",
  },
  {
    id: "login_7",
    metric: "login",
    threshold: 7,
    title: "Log-in 7 days",
    icon: "/coll-log7.png",
  },
  {
    id: "inv_3",
    metric: "invite",
    threshold: 3,
    title: "Invite 3 friends",
    icon: "/coll-inv3.png",
  },
  {
    id: "gt_3",
    metric: "ticket",
    threshold: 3,
    title: "Obtain 3 Golden Tickets",
    icon: "/coll-gt3.png",
  },

  // Row 3
  {
    id: "spin_10000",
    metric: "spins",
    threshold: 10_000,
    title: "Spin Wheel 10,000 times",
    icon: "/coll-wheel10.png",
  },
  {
    id: "earn_100k",
    metric: "rof",
    threshold: 100_000,
    title: "Earn 100,000 $ROF",
    icon: "/coll-earn100k.png",
  },
  {
    id: "login_15",
    metric: "login",
    threshold: 15,
    title: "Log-in 15 days",
    icon: "/coll-log15.png",
  },
  {
    id: "inv_5",
    metric: "invite",
    threshold: 5,
    title: "Invite 5 friends",
    icon: "/coll-inv5.png",
  },
  {
    id: "gt_5",
    metric: "ticket",
    threshold: 5,
    title: "Obtain 5 Golden Tickets",
    icon: "/coll-gt5.png",
  },

  // Row 4
  {
    id: "spin_100000",
    metric: "spins",
    threshold: 100_000,
    title: "Spin Wheel 100,000 times",
    icon: "/coll-wheel100.png",
  },
  {
    id: "earn_1m",
    metric: "rof",
    threshold: 1_000_000,
    title: "Earn 1,000,000 $ROF",
    icon: "/coll-earn1m.png",
  },
  {
    id: "login_30",
    metric: "login",
    threshold: 30,
    title: "Log-in 30 days",
    icon: "/coll-log30.png",
  },
  {
    id: "inv_10",
    metric: "invite",
    threshold: 10,
    title: "Invite 10 friends",
    icon: "/coll-inv10.png",
  },
  {
    id: "gt_10",
    metric: "ticket",
    threshold: 10,
    title: "Obtain 10 Golden Tickets",
    icon: "/coll-gt10.png",
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

  /* ================= BUNDLE HELPERS ================= */

    const grantBundleRewards = async (bundle) => {
    const rofAdd = bundle.rof || 0;
    const spinsAdd = bundle.spins || 0;
    const ticketsAdd = bundle.tickets || 0;

    // Lifetime ROF progress for collectibles
    if (rofAdd) {
      setTotalRofEarned((prev) => {
        const next = prev + rofAdd;
        try {
          localStorage.setItem("rof_totalEarned", String(next));
        } catch {}
        return next;
      });
    }

    if (!tgId) {
      setToast({ text: "User not ready yet", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/bundle/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tg_id: tgId, bundle_id: bundle.id }),
      });

      const json = await resp.json();
      if (!json.ok) {
        console.error("bundle/apply failed", json.error);
        setToast({
          text: "Bundle claim failed, try again",
          key: Date.now(),
        });
        setTimeout(() => setToast(null), 1500);
        return;
      }

      const {
        balance: newBalance,
        spins_left: newSpins,
        golden_tickets: newTickets,
      } = json;

      // Local state update from server truth
      if (rofAdd) setBank(newBalance);
      if (spinsAdd) setSpinsLeft(newSpins);
      if (ticketsAdd) setGoldTickets(newTickets);

      const parts = [];
      if (rofAdd) parts.push(`+${rofAdd.toLocaleString()} $ROF`);
      if (spinsAdd) parts.push(`+${spinsAdd} spins`);
      if (ticketsAdd)
        parts.push(
          `+${ticketsAdd} Golden Ticket${ticketsAdd > 1 ? "s" : ""}`
        );

      if (parts.length) {
        setToast({
          text: parts.join(" · "),
          key: Date.now(),
        });
        setTimeout(() => setToast(null), 2000);
      }
    } catch (e) {
      console.error("bundle/apply network error", e);
      setToast({
        text: "Bundle claim failed, server error",
        key: Date.now(),
      });
      setTimeout(() => setToast(null), 2000);
    }
  };



const handleBuyBundleTon = async (bundle) => {
  const ok = await sendTonPayment(
    bundle.priceTon,
    `${bundle.name} bundle`
  );
  if (!ok) return;

  await grantBundleRewards(bundle);
  // ❌ no setShowBundles(false) here – we’ll close it on click instead
};


const handleBuyBundleStars = async (bundle) => {
  // Stars flow: backend should credit the bundle in DB after payment.
  await createStarsInvoiceAndOpen("bundle", bundle.id);
  setShowBundles(false);
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

  // 🎛 Turbo spin multiplier (VIP)
  const [turboMult, setTurboMult] = useState(1);

  // Free = only x1; any VIP tier = x1/x5/x10/x20/x50
  const getAllowedMultipliers = (tierKeyValue) =>
    tierKeyValue === "free" ? [1] : [1, 5, 10, 20, 50];

  const cycleTurbo = () => {
    const allowed = getAllowedMultipliers(tierKey);
    const idx = allowed.indexOf(turboMult);
    const next = allowed[(idx + 1) % allowed.length];
    setTurboMult(next);
  };

  // Keep turbo multiplier valid when tier changes
  useEffect(() => {
    const allowed = getAllowedMultipliers(tierKey);
    if (!allowed.includes(turboMult)) {
      setTurboMult(allowed[0]);
    }
  }, [tierKey, turboMult]);

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
  const [showBundles, setShowBundles] = useState(false);
  const [showVault, setShowVault] = useState(false);


  /* Leaderboard UI */
  const [lbTab, setLbTab] = useState("players");

  /* Loot tabs */
  const [lootTab, setLootTab] = useState("skins");

  /* Collectibles / lifetime progress (local only for now) */
  const [totalSpins, setTotalSpins] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem("rof_totalSpins") || "0", 10);
      return Number.isNaN(v) ? 0 : v;
    } catch {
      return 0;
    }
  });

  const [totalRofEarned, setTotalRofEarned] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem("rof_totalEarned") || "0", 10);
      return Number.isNaN(v) ? 0 : v;
    } catch {
      return 0;
    }
  });

  const [loginDays, setLoginDays] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem("rof_loginDays") || "0", 10);
      return Number.isNaN(v) ? 0 : v;
    } catch {
      return 0;
    }
  });

  const [meetRofClaimed, setMeetRofClaimed] = useState(() => {
    try {
      return localStorage.getItem("rof_meetRof_claimed") === "1";
    } catch {
      return false;
    }
  });

  // Make sure we only bump loginDays once per real app load
  const loginInitRef = useRef(false);

  useEffect(() => {
    if (loginInitRef.current) return;
    loginInitRef.current = true;

    try {
      const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const last = localStorage.getItem("rof_login_last");

      if (last !== todayKey) {
        const prev = parseInt(localStorage.getItem("rof_loginDays") || "0", 10);
        const next = (Number.isNaN(prev) ? 0 : prev) + 1;
        localStorage.setItem("rof_loginDays", String(next));
        localStorage.setItem("rof_login_last", todayKey);
        setLoginDays(next);
      }
    } catch {
      // ignore
    }
  }, []);

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
    /* ===== Collectibles helpers (Meet $ROF) ===== */

  const getCollectibleMetricValue = (metric) => {
    switch (metric) {
      case "spins":
        return totalSpins;
      case "rof":
        return totalRofEarned;
      case "login":
        return loginDays;
      case "invite":
        return invitesCount;
      case "ticket":
        return goldTickets;
      default:
        return 0;
    }
  };

  const isMeetRofCompleted = () =>
    MEET_ROF_COLLECTIBLES.every(
      (c) => getCollectibleMetricValue(c.metric) >= c.threshold
    );

    const handleClaimMeetRof = async () => {
    if (meetRofClaimed) return;
    if (!isMeetRofCompleted()) return;

    // 🎁 Mystery reward (only revealed AFTER claim)
    const rofReward = 1_000_000;
    const spinsReward = 1000;
    const ticketsReward = 5;

    if (!tgId) {
      setToast({ text: "User not ready yet", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/reward/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tg_id: tgId,
          rofAdd: rofReward,
          spinsAdd: spinsReward,
          ticketsAdd: ticketsReward,
        }),
      });

      const json = await resp.json();
      if (!json.ok) {
        console.error("Meet ROF reward failed", json.error);
        setToast({
          text: "Reward claim failed, try again",
          key: Date.now(),
        });
        setTimeout(() => setToast(null), 2000);
        return;
      }

      const {
        balance: newBalance,
        spins_left: newSpins,
        golden_tickets: newTickets,
      } = json;

      // Update local state from server truth
      setBank(newBalance);
      setSpinsLeft(newSpins);
      setGoldTickets(newTickets);

      // Track total ROF earned for collectibles
      setTotalRofEarned((prev) => {
        const next = prev + rofReward;
        try {
          localStorage.setItem("rof_totalEarned", String(next));
        } catch {}
        return next;
      });

      setMeetRofClaimed(true);
      try {
        localStorage.setItem("rof_meetRof_claimed", "1");
      } catch {}

      // Show the surprise AFTER completion
      setToast({
        text:
          "Mystery reward unlocked! 🎁 +5 Golden Tickets · +1,000,000 $ROF · +1,000 spins",
        key: Date.now(),
      });
      setTimeout(() => setToast(null), 2200);
    } catch (e) {
      console.error("Meet ROF reward network error", e);
      setToast({
        text: "Reward claim failed, server error",
        key: Date.now(),
      });
      setTimeout(() => setToast(null), 2000);
    }
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

        const resp = await fetch(`${API_BASE}/user/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(baseUser),
        });

        const json = await resp.json();
        if (!json.ok) {
          console.error("user/sync failed", json.error);
          return;
        }

        const data = json.user;


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


            await fetch(`${API_BASE}/spins/update`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tg_id: baseUser.tg_id,
              spins_left: dbSpins,
            }),
          });

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
          fetch(`${API_BASE}/spins/update`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tg_id: tgId,
              spins_left: newSpins,
            }),
          }).catch((e) => console.error("Regen update failed", e));
        }


        return newSpins;
      });
    };

    const id = setInterval(tick, TICK_MS);
    tick();
    return () => clearInterval(id);
  }, [regenMs, spinCap, showPremium, nextReadyAt, tgId]);

  /* Spin */
    /* Spin (with Turbo support) */
    const handleSpin = async () => {
    const mult = turboMult; // how many spins to consume at once

    if (spinning || animBusyRef.current || spinsLeft <= 0) return;

    // Not enough spins for current turbo level
    if (spinsLeft < mult) {
      setToast({
        text: `Not enough spins for x${mult}`,
        key: Date.now(),
      });
      setTimeout(() => setToast(null), 1500);
      return;
    }

    if (!tgId) {
      setToast({
        text: "Connect Telegram WebApp again",
        key: Date.now(),
      });
      setTimeout(() => setToast(null), 1500);
      return;
    }

    setSpinning(true);
    setToast(null);

    const startVis = currentAngleRef.current;

    try {
      // 🔐 Ask backend to perform the spin and update DB
      const resp = await fetch(`${API_BASE}/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tg_id: tgId, turboMult: mult }),
      });

      const json = await resp.json();

      if (!json.ok) {
        setSpinning(false);

        if (json.error === "no_spins") {
          setToast({
            text: "No spins left",
            key: Date.now(),
          });
          setTimeout(() => setToast(null), 1500);
          return;
        }

        console.error("Spin failed:", json.error);
        setToast({
          text: "Spin failed, try again",
          key: Date.now(),
        });
        setTimeout(() => setToast(null), 1500);
        return;
      }

       const { index, prize, balance: newBalance, spins_left: newSpins } = json;

      // 🎯 Compute a visual rotation that lands the pointer on the CENTER of the winning slice
      const startNorm = ((startVis % 360) + 360) % 360;

      // Each slice is SEG_DEG wide; center is at index * SEG_DEG + SEG_DEG/2
      const segmentCenter = index * SEG_DEG + SEG_DEG / 2;
      const targetNorm = (360 - segmentCenter + 360) % 360;

      const baseDelta = (targetNorm - startNorm + 360) % 360;
      const spinsFull = randInt(4, 8);
      const endVis = startVis + baseDelta + spinsFull * 360;
      const durationMs = randInt(1900, 2800);


      animateRotation(startVis, endVis, durationMs, () => {
        const norm = ((endVis % 360) + 360) % 360;
        currentAngleRef.current = norm;
        applyAngle(norm);
        try {
          localStorage.setItem("rof_visAngle", String(norm));
          localStorage.setItem("rof_calcRot", String(endVis));
        } catch {}

        // Lifetime counters for collectibles – count *spins*, not clicks
        setTotalSpins((prev) => {
          const next = prev + mult;
          try {
            localStorage.setItem("rof_totalSpins", String(next));
          } catch {}
          return next;
        });

        if (prize > 0) {
          setTotalRofEarned((prev) => {
            const next = prev + prize;
            try {
              localStorage.setItem("rof_totalEarned", String(next));
            } catch {}
            return next;
          });
        }

        // ✅ Use values from server as source of truth
        setBank(newBalance);
        setSpinsLeft(newSpins);

        if (prize > 0) {
          setToast({
            text: `+${prize.toLocaleString()} $ROF`,
            key: Date.now(),
          });
          setTimeout(() => setToast(null), 1600);
        }

        setSpinning(false);
      });
    } catch (err) {
      console.error("Spin failed", err);
      setSpinning(false);
      setToast({ text: "Spin error, try again", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
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
        const resp = await fetch(`${API_BASE}/tier/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tg_id: tgId, tier_key: key }),
        });

        const json = await resp.json();
        if (!json.ok) {
          console.error("tier/apply failed", json.error);
          setToast({
            text: "Tier saved locally, server update failed",
            key: Date.now(),
          });
          setTimeout(() => setToast(null), 2000);
        }
      } catch (e) {
        console.error("tier/apply network error", e);
        setToast({
          text: "Tier saved locally, server error",
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
      const resp = await fetch(`${API_BASE}/inventory/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tg_id: tgId,
          item_type: "wheel",
          item_id: skin.id,
        }),
      });

      const json = await resp.json();
      if (!json.ok) {
        console.error("inventory/unlock failed", json.error);
        setToast({ text: "Unlock failed, try again", key: Date.now() });
        setTimeout(() => setToast(null), 1500);
        return false;
      }

      // Update local state & UI
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
      setToast({ text: "Unlock failed, server error", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
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
      const resp = await fetch(`${API_BASE}/inventory/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tg_id: tgId,
          item_type: "bg",
          item_id: skin.id,
        }),
      });

      const json = await resp.json();
      if (!json.ok) {
        console.error("inventory/unlock failed", json.error);
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
      setToast({ text: "Unlock failed, server error", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
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

{/* Turbo mode 🔥 */}
<div className="vip-row">
  <div className="vip-cell vip-cell-label">Turbo mode 🔥</div>
  {tierDefs.map((def) => (
    <div key={def.key} className="vip-cell vip-cell-value">
      {/* All VIP tiers have Turbo */}
      <b>Yes🔥</b>
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
            onClick={() => !disabled && handleTonClick(def.key)}
          >
            <span className="pill-ton-icon" />
            <span className="pill-ton-text">{tonLabel}</span>
          </button>
          <button
            className="pill-stars"
            disabled={disabled}
            onClick={() => !disabled && handleStarsClick(def.key)}
          >
            <span className="pill-stars-text">⭐️ {starLabel}</span>
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

    // NEW: Vault modal
  const VaultModal = () => {
    const tier = TIERS[tierKey];
    const regenMinutes = Math.floor(regenMs / 60000);

    const tonDisplay = wallet ? "—" : "0.00"; // we’ll wire real balance later if needed

    const vipLabel =
      tierKey === "free"
        ? "No status"
        : tierKey === "plus"
        ? "Premium⚡️"
        : tierKey === "pro"
        ? "Plus⭐️"
        : "Pro👑";

    return (
      <div
        className="modal-overlay"
        onClick={() => setShowVault(false)}
      >
        <div
          className="modal vault-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-head">
            <div className="mh-left">
              <span className="mh-icon">🧿</span>
              <div className="mh-title">Vault</div>
            </div>
            <button
              className="modal-close"
              onClick={() => setShowVault(false)}
            >
              ✕
            </button>
          </div>

          <div className="modal-body vault-body">
            {/* Roadmap */}
            <h3 className="vault-section-title">Roadmap</h3>
            <ul className="vault-roadmap">
              <li>🟢 Concept and beta development</li>
              <li>🟢 Web3 integration</li>
              <li>🟢 Game development</li>
              <li>🟢 Beta launch</li>
              <li>🟢 Growing community</li>
              <li>🟢 Accumulation period</li>
              <li>⚪ $ROF airdrop and Golden ticket Claim Period</li>
              <li>⚪ Exchanges listing</li>
              <li>⚪ TBA</li>
            </ul>

            {/* Balances */}
            <h3 className="vault-section-title">Balances</h3>
            <div className="vault-grid">
              <div className="vault-row">
                <span>ROF balance</span>
                <span>{bank.toLocaleString()}</span>
              </div>
              <div className="vault-row">
                <span>Golden ticket balance</span>
                <span>{goldTickets}</span>
              </div>
              <div className="vault-row">
                <span>TON wallet balance</span>
                <span>{tonDisplay}</span>
              </div>
            </div>

            {/* Claim button + text */}
            <button className="btn-premium vault-claim" disabled>
              Claim Rewards
            </button>
            <p className="vault-note">
              Rewards are accumulating. Save up ROF and claim tokens daily.
              Airdrops will be available once accumulation period is over.
              Follow our Announcement channel @rofflereal for updates.
            </p>

            {/* Account info */}
            <h3 className="vault-section-title">Your account</h3>
            <div className="vault-grid">
              <div className="vault-row">
                <span>VIP Status</span>
                <span>{vipLabel}</span>
              </div>
              <div className="vault-row">
                <span>Spin regeneration time</span>
                <span>{regenMinutes} min / spin</span>
              </div>
              <div className="vault-row">
                <span>Spin regeneration cap</span>
                <span>{tier.cap}</span>
              </div>
              <div className="vault-row">
                <span>Friends invited</span>
                <span>{invitesCount}</span>
              </div>
              <div className="vault-row">
                <span>Worldwide rank (Coins)</span>
                <span>–</span>
              </div>
              <div className="vault-row">
                <span>Worldwide rank (Invites)</span>
                <span>–</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  
    const BundlesModal = () => {
  return (
  <div
    className="modal-overlay"
    onClick={() => setShowBundles(false)}
  >
    <div
      className="modal bundles-modal"
      onClick={(e) => e.stopPropagation()}
    >
        <div className="modal-head">
          <div className="mh-left">
            <span className="mh-icon">🎁</span>
            <div className="mh-title">Booster Bundles</div>
          </div>
          <button
            className="modal-close"
            onClick={() => setShowBundles(false)}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-sub">
            Top up your $ROF, spins and Golden Tickets instantly.
          </p>

          <div className="bundles-list">
            {BUNDLES.map((b) => (
              <div key={b.id} className="bundle-row">
                <div className="bundle-left">
                  <div className="bundle-icon">
                    <img src={b.icon} alt={b.name} />
                  </div>
                  <div className="bundle-text">
                    <div className="bundle-name">{b.name}</div>
                    <div className="bundle-reward">
                      <span className="bundle-rof">
                        +{b.rof.toLocaleString()} $ROF
                      </span>{" "}
                      · +{b.spins} spins ·{" "}
                      <span className="bundle-ticket">
                        +{b.tickets} Golden Ticket
                        {b.tickets > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bundle-right">
                  <button
  className="pill-ton"
  onClick={() => {
    setShowBundles(false);   // ⬅️ close Booster Bundles window
    handleBuyBundleTon(b);   // ⬅️ start TON payment flow
  }}
>
  <span className="pill-ton-icon" />
  <span className="pill-ton-text">
    {b.priceTon} TON
  </span>
</button>


                  <button
                    className="pill-stars"
                    onClick={() => handleBuyBundleStars(b)}
                  >
                    <span className="pill-stars-text">
                      ⭐️ {b.priceStars}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-foot">
          <div className="mf-note">
            TON is paid on-chain. Stars payments are handled via Telegram.
          </div>
          <button
            className="mf-back"
            onClick={() => setShowBundles(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};




    const LootScreen = () => {
    const allDone = isMeetRofCompleted();

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
  {collectiblesRemaining > 0 && (
    <span className="menu-badge">{collectiblesRemaining}</span>
  )}
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

        {/* COLLECTIBLES – Meet $ROF */}
        {lootTab === "collectibles" && (
          <div className="loot-section">
            <div className="loot-title">🎁 Collectibles · Meet $ROF</div>

            <div className="collect-grid">
              {MEET_ROF_COLLECTIBLES.map((item) => {
                const value = getCollectibleMetricValue(item.metric);
                const done = value >= item.threshold;

                return (
                  <div
                    key={item.id}
                    className={`collect-cell ${done ? "done" : ""}`}
                  >
                    <div className="collect-icon-wrap">
                      <img
                        src={item.icon}
                        alt={item.title}
                        className="collect-icon"
                      />
                      {done && <div className="collect-check">✓</div>}
                    </div>

                    <div className="collect-name">{item.title}</div>

                    <div className="collect-progress">
                      {Math.min(value, item.threshold).toLocaleString()} /{" "}
                      {item.threshold.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="collect-foot">
              <button
                className="collect-claim-btn gradient-outline-btn"
                disabled={!allDone || meetRofClaimed}
                onClick={handleClaimMeetRof}
              >
                {meetRofClaimed
                  ? "Reward claimed"
                  : allDone
                  ? "Claim Reward"
                  : "Claim Reward"}
              </button>
              <div className="collect-note">
                Complete all 20 challenges to unlock a mystery prize.
              </div>
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


  
  const PlayScreen = ({ wheelSkin, onOpenBundles }) => {
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
                  const shown = baseAmount * prizeMult * turboMult;

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

          {/* 🎁 Floating gift box button */}
          <div className="floating-gift" onClick={onOpenBundles}>
            <img src="/gift-box.png" alt="Bundles" />
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
              {spinning
                ? "Spinning…"
                : turboMult === 1
                ? "Spin"
                : `Spin x${turboMult}`}
            </span>
            <span className="spin-timer">
              {spinsLeft < spinCap
                ? `Next in ${formatMs(nextInMs)}`
                : "Ready"}
            </span>
          </button>

          <button
  className={`btn-turbo ${tierKey === "free" ? "" : "vip"}`}
  onClick={cycleTurbo}
  disabled={tierKey === "free"}
>
  <span className="turbo-label">Turbo</span>
  <span className="turbo-mult">x{turboMult}</span>
</button>

        </div>

      </>
    );
  };

      const handleClaimTask = async (task) => {
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

    // Lifetime ROF for collectibles
    if (rofAdd) {
      setTotalRofEarned((prev) => {
        const next = prev + rofAdd;
        try {
          localStorage.setItem("rof_totalEarned", String(next));
        } catch {}
        return next;
      });
    }

    if (!tgId) {
      setToast({ text: "User not ready yet", key: Date.now() });
      setTimeout(() => setToast(null), 1500);
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/reward/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tg_id: tgId,
          rofAdd,
          spinsAdd,
          ticketsAdd,
        }),
      });

      const json = await resp.json();
      if (!json.ok) {
        console.error("Task reward apply failed", json.error);
        setToast({
          text: "Task claim failed, try again",
          key: Date.now(),
        });
        setTimeout(() => setToast(null), 2000);
        return;
      }

      const {
        balance: newBalance,
        spins_left: newSpins,
        golden_tickets: newTickets,
      } = json;

      if (rofAdd) setBank(newBalance);
      if (spinsAdd) setSpinsLeft(newSpins);
      if (ticketsAdd) setGoldTickets(newTickets);

      // Mark as claimed
      const nextClaims = { ...taskClaims, [task.id]: true };
      saveTaskClaims(nextClaims);

      // Toast text
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
    } catch (e) {
      console.error("Task reward network error", e);
      setToast({
        text: "Task claim failed, server error",
        key: Date.now(),
      });
      setTimeout(() => setToast(null), 2000);
    }
  };



      const handleLinkGo = (task) => {
  if (!task.url) return;

  const tg = window.Telegram?.WebApp;

  try {
    // ✅ Prefer openLink (works for normal https:// links)
    if (tg?.openLink) {
      tg.openLink(task.url);
    }
    // Fallback for t.me / internal links
    else if (tg?.openTelegramLink) {
      tg.openTelegramLink(task.url);
    }
    // Browser fallback (local testing / pop-out)
    else {
      window.open(task.url, "_blank", "noopener,noreferrer");
    }

    // Mark that user went to the task
    markTaskVisited(task.id);
  } catch (e) {
    console.error("handleLinkGo error", e);
    // Last-resort browser open
    try {
      window.open(task.url, "_blank", "noopener,noreferrer");
    } catch {}
  }
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
                      onClick={() => handleLinkGo(task)}
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

   // 🔔 Notification counters
  const remainingTasks = TASKS.filter((t) => !taskClaims[t.id]).length;

  // How many Meet $ROF collectibles are NOT done yet
  const collectiblesRemaining = MEET_ROF_COLLECTIBLES.filter(
    (c) => getCollectibleMetricValue(c.metric) < c.threshold
  ).length;




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
        {collectiblesRemaining > 0 && (
          <span className="menu-badge">{collectiblesRemaining}</span>
        )}
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
        {remainingTasks > 0 && (
          <span className="menu-badge">{remainingTasks}</span>
        )}
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
      className={`tg-app bg-img ${
        showPremium || showBundles || showVault ? "modal-open" : ""
      }`}

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
                    <div className="header-right">
              {/* Vault button */}
              <button
                className="icon-btn"
                onClick={() => setShowVault(true)}
              >
                <img src="/vault.png" alt="Vault" />
              </button>

              {/* Docs button */}
              <button
                className="icon-btn"
                onClick={() => {
                  const tg = window.Telegram?.WebApp;
                  const url = "https://roffle.gitbook.io/roffle-docs/";
                  if (tg?.openLink) {
                    tg.openLink(url);
                  } else if (tg?.openTelegramLink) {
                    tg.openTelegramLink(url);
                  } else {
                    window.open(url, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                <img src="/docs.png" alt="Docs" />
              </button>

              {/* TON wallet button */}
              <button
                className="icon-btn"
                onClick={() => {
                  if (wallet) {
                    // already connected → disconnect
                    tonConnectUI.disconnect();
                  } else {
                    // not connected → open TonConnect modal
                    tonConnectUI.openModal();
                  }
                }}
              >
                <img src="/ton.png" alt="TON Wallet" />
              </button>
            </div>


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
            {tab === "play" && (
              <PlayScreen
                wheelSkin={wheelSkin}
                onOpenBundles={() => setShowBundles(true)}
              />
            )}
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
      {showBundles && <BundlesModal />}
      {showVault && <VaultModal />}
    </div>
  );
}
