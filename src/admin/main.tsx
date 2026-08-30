import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import PlatformConsole from "../pages/PlatformConsole";
import "../index.css";

// Standalone provider console — a separate build/app from the customer/tenant
// site. Deployed to its own hosting site and packaged as its own desktop app.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Toaster position="top-center" richColors />
    <PlatformConsole />
  </StrictMode>
);
