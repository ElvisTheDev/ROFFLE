import React, { useEffect, useMemo, useRef, useState } from "react";

const SEGMENTS_TOTAL = 50;
const SEG_DEG = 360 / SEGMENTS_TOTAL;

const COLORS = {
  green: "#27ae60",
  blue: "#2980b9",
  purple: "#8e44ad",
  red: "#e74c3c",
  gold: "#f1c40f",
  sol1: "#9945FF",
  sol2: "#19FB9B",
};

const tg = window.Telegram?.WebApp;

function buildWheel() {
  const slots = new Array(SEGMENTS_TOTAL).fill(null);
  slots[0] = { label: "MAX WIN", amount: 1000, type: "max" };
  slots[24] = { label: "MAX WIN", amount: 1000, type: "max" };

  const toPlace = [
    { count: 25, data: { label: "5", amount: 5, color: COLORS.green, type: "flat" } },
    { count: 12, data: { label: "10", amount: 10, color: COLORS.blue, type: "flat" } },
    { count: 5,  data: { label: "20", amount: 20, color: COLORS.purple, type: "flat" } },
    { count: 3,  data: { label: "50", amount: 50, color: COLORS.red, type: "flat" } },
    { count: 3,  data: { label: "100", amount: 100, color: COLORS.gold, type: "flat" } },
  ];

  const bag = [];
  toPlace.forEach(({ count, data }) => { for (let i=0; i<count; i++) bag.push({ ...data }); });
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  let k = 0;
  for (let i=0; i<SEGMENTS_TOTAL; i++) {
    if (!slots[i]) slots[i] = bag[k++];
  }
  return slots;
}

export default function App() {
  const wheel = useMemo(buildWheel, []);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastWin, setLastWin] = useState(null);
  const [bank, setBank] = useState(0);
  const [theme, setTheme] = useState({ bg: "#0a0118", text: "#ffffff", sectionRing: "#2a1c4d" });

  const clickSfx = useRef(null);
  const rollLoopSfx = useRef(null);
  const winSfx = useRef(null);

  useEffect(() => {
    clickSfx.current = new Audio("/sounds/click.mp3");
    clickSfx.current.preload = "auto";
    rollLoopSfx.current = new Audio("/sounds/roll_loop.mp3");
    rollLoopSfx.current.loop = true;
    rollLoopSfx.current.preload = "auto";
    winSfx.current = new Audio("/sounds/win.mp3");
    winSfx.current.preload = "auto";
  }, []);

  useEffect(() => {
    if (!tg) return;
    const sync = () => {
      const p = tg.themeParams || {};
      setTheme({ bg: p.bg_color || "#0a0118", text: p.text_color || "#ffffff", sectionRing: "#2a1c4d" });
    };
    sync();
    tg.onEvent?.("themeChanged", sync);
    return () => tg.offEvent?.("themeChanged", sync);
  }, []);

  useEffect(() => {
    if (!tg) return;
    tg.MainButton.setText(spinning ? "Spinning..." : "Spin");
    spinning ? tg.MainButton.showProgress() : tg.MainButton.hideProgress();
    tg.MainButton[spinning ? "disable" : "enable"]?.();
    tg.MainButton.show();
    const handler = () => handleSpin();
    tg.MainButton.onClick(handler);
    return () => tg.MainButton.offClick(handler);
  }, [spinning]);

  const getWheelBackground = useMemo(() => {
    const parts = [];
    let acc = 0;
    for (let i = 0; i < SEGMENTS_TOTAL; i++) {
      const start = acc;
      const end = acc + SEG_DEG;
      const s = wheel[i];
      if (s.type === "max") {
        const mid = start + SEG_DEG / 2;
        parts.push(`${COLORS.sol1} ${start}deg ${mid}deg`);
        parts.push(`${COLORS.sol2} ${mid}deg ${end}deg`);
      } else {
        parts.push(`${s.color} ${start}deg ${end}deg`);
      }
      acc = end;
    }
    return `conic-gradient(${parts.join(", ")})`;
  }, [wheel]);

  const chooseIndex = () => Math.floor(Math.random() * SEGMENTS_TOTAL);
  const computeFinalRotation = (currentRot, targetIndex) => {
    const indexCenter = targetIndex * SEG_DEG + SEG_DEG / 2;
    const base = 90 - indexCenter;
    const baseNorm = ((base % 360) + 360) % 360;
    const extraTurns = 5 + Math.floor(Math.random() * 3);
    return currentRot + extraTurns * 360 + baseNorm;
  };

  const play = async (ref) => { try { ref?.current && (ref.current.currentTime = 0, await ref.current.play()); } catch {} };
  const stop = (ref) => { try { ref?.current?.pause(); ref.current.currentTime = 0; } catch {} };

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true);
    setLastWin(null);
    tg?.HapticFeedback?.impactOccurred?.("medium");
    await play(clickSfx);
    await play(rollLoopSfx);
    const targetIndex = chooseIndex();
    const finalRot = computeFinalRotation(rotation, targetIndex);
    requestAnimationFrame(() => setRotation(finalRot));
    const DURATION = 4500;
    setTimeout(() => {
      const win = wheel[targetIndex];
      setLastWin({ index: targetIndex, ...win });
      setBank((b) => b + (win.amount || 0));
      stop(rollLoopSfx);
      play(winSfx);
      tg?.HapticFeedback?.notificationOccurred?.("success");
      setSpinning(false);
    }, DURATION + 60);
  };

  return (
    <div className="tg-app" style={{ "--bg": theme.bg, "--text": theme.text, "--ring": theme.sectionRing }}>
      <div className="compact">
        <header className="header">
          <div className="bank">💰 {bank}</div>
          <button className="spin" onClick={handleSpin} disabled={spinning}>{spinning ? "Spinning..." : "Spin"}</button>
        </header>

        <div className="wheel-wrap">
          <div className="pointer" />
          <div className="wheel" style={{ background: getWheelBackground, transform: `rotate(${rotation}deg)` }}>
            <SectionLabel index={0} text="MAX" />
            <SectionLabel index={24} text="MAX" />
            {Array.from({ length: SEGMENTS_TOTAL }).map((_, i) => (<Tick key={i} index={i} major={i % 5 === 0} />))}
          </div>
        </div>

        {lastWin && (
          <div className="result">
            <div>Stopped on <b>#{lastWin.index + 1}</b> — {lastWin.label === "MAX WIN" ? <span className="pill max">MAX WIN</span> : <span className="pill">{lastWin.label}</span>} ⇒ <b>+{lastWin.amount}</b></div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ index, text }) {
  const angle = index * SEG_DEG + SEG_DEG / 2;
  return <div className="label" style={{ transform: `rotate(${angle}deg) translate(0, -46%) rotate(${-angle}deg)` }}>{text}</div>;
}

function Tick({ index, major }) {
  const angle = index * SEG_DEG;
  return <div className={`tick ${major ? "major" : ""}`} style={{ transform: `rotate(${angle}deg)` }} />;
}
