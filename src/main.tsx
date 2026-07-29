import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { AuthBoundary, AuthProvider } from "./platform/auth";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <AuthBoundary>
        <App />
      </AuthBoundary>
    </AuthProvider>
  </StrictMode>,
);
