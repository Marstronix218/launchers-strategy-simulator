import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import QuickDiagnosisApp from "./QuickDiagnosisApp";
import "./quickDiagnosis.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QuickDiagnosisApp />
  </StrictMode>,
);
