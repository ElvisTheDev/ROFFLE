import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./App.css";

// ✅ NEW: import TonConnect provider
import { TonConnectUIProvider } from "@tonconnect/ui-react";

const tg = window.Telegram?.WebApp;
if (tg) {
  try {
    tg.ready();
    tg.expand();
  } catch {}
}

// ✅ Wrap <App /> with <TonConnectUIProvider>
createRoot(document.getElementById("root")).render(
  <TonConnectUIProvider
    manifestUrl="https://YOUR-DOMAIN-HERE/tonconnect-manifest.json"
  >
    <App />
  </TonConnectUIProvider>
);
