import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppProviders from "./context/AppProviders";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <Routes>
          <Route path="/*" element={<App />} />
        </Routes>
      </AppProviders>
    </BrowserRouter>
  </StrictMode>
);
