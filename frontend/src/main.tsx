import "bootstrap/dist/css/bootstrap.min.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "@/App";
import { reportRenderError } from "@/components/common/reportRenderError";
import AuthProvider from "@/components/auth/AuthProvider";
import { createQueryClient } from "@/services/queryClient";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

const queryClient = createQueryClient();

createRoot(root, {
  onCaughtError: reportRenderError,
  onUncaughtError: reportRenderError,
  onRecoverableError: reportRenderError,
}).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
