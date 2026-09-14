import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router-dom"

import App from "@/App.tsx"
import { Toaster } from "@/components/shared/sonner"
import { AuthProvider } from "@/lib/auth-context"
import { I18nProvider } from "@/lib/i18n"
import { queryClient } from "@/lib/query-client"
import "@/index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider>
            <App />
            <Toaster position="top-right" />
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
