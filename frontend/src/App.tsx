import { Route, Routes } from "react-router-dom"

import { AppLayout } from "@/components/shared/app-layout"
import { ProtectedRoute } from "@/components/shared/protected-route"
import { AboutPage } from "@/pages/AboutPage"
import { AdminPage } from "@/pages/app/AdminPage"
import { BookCourtPage } from "@/pages/app/BookCourtPage"
import { DashboardPage } from "@/pages/app/DashboardPage"
import { ProfilePage } from "@/pages/app/ProfilePage"
import { LoginPage } from "@/pages/auth/LoginPage"
import { RegisterPage } from "@/pages/auth/RegisterPage"
import { ContactPage } from "@/pages/ContactPage"
import { CourtDetailPage } from "@/pages/courts/CourtDetailPage"
import { CourtsPage } from "@/pages/courts/CourtsPage"
import { LandingPage } from "@/pages/landing/LandingPage"
import { NotFoundPage } from "@/pages/NotFoundPage"

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="courts" element={<CourtsPage />} />
        <Route path="courts/:id" element={<CourtDetailPage />} />
        <Route
          path="app"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="app/book"
          element={
            <ProtectedRoute>
              <BookCourtPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="app/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="app/admin"
          element={
            <ProtectedRoute requireRole="VENUE_MANAGER">
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
