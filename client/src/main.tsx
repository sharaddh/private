import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import Lenis from "lenis";
import AppProviders from "./context/AppProviders";
import App from "./App";
import "./index.css";

const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  touchMultiplier: 2,
});

function raf(time: number) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <AppProviders>
        <Routes>
          <Route path="/*" element={<App />} />
        </Routes>
      </AppProviders>
    </HashRouter>
  </StrictMode>
);
