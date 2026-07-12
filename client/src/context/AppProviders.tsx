import { type ReactNode } from "react";
import { AuthProvider } from "./AuthContext";
import { ThemeProvider } from "./ThemeContext";
import { ToastProvider } from "./ToastContext";
import { TranslateProvider } from "./TranslateContext";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <TranslateProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </TranslateProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
