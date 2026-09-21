import { lazy } from "react"
import { Route, Routes } from "react-router-dom"

import { AppLayout, AppShellLayout } from "@/components/shared/app-layout"
import { ProtectedRoute, RedirectIfAuthed } from "@/components/shared/protected-route"
import { LandingPage } from "@/pages/landing/LandingPage"
import { NotFoundPage } from "@/pages/NotFoundPage"

// Landing/404 stay eager (first thing an anonymous visitor sees); everything
// else is route-split so a player never downloads the admin panel and vice
// versa — this was the app's single >500kB bundle-size finding.
const AboutPage = lazy(() => import("@/pages/AboutPage").then((m) => ({ default: m.AboutPage })))
const ContactPage = lazy(() => import("@/pages/ContactPage").then((m) => ({ default: m.ContactPage })))
const HelpPage = lazy(() => import("@/pages/HelpPage").then((m) => ({ default: m.HelpPage })))
const CourtsPage = lazy(() => import("@/pages/courts/CourtsPage").then((m) => ({ default: m.CourtsPage })))
const CourtDetailPage = lazy(() => import("@/pages/courts/CourtDetailPage").then((m) => ({ default: m.CourtDetailPage })))
const LoginPage = lazy(() => import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage").then((m) => ({ default: m.RegisterPage })))
const DashboardPage = lazy(() => import("@/pages/app/DashboardPage").then((m) => ({ default: m.DashboardPage })))
const BookCourtPage = lazy(() => import("@/pages/app/BookCourtPage").then((m) => ({ default: m.BookCourtPage })))
const ProfilePage = lazy(() => import("@/pages/app/ProfilePage").then((m) => ({ default: m.ProfilePage })))
const AdminPage = lazy(() => import("@/pages/app/AdminPage").then((m) => ({ default: m.AdminPage })))

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route
          path="login"
          element={
            <RedirectIfAuthed>
              <LoginPage />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="register"
          element={
            <RedirectIfAuthed>
              <RegisterPage />
            </RedirectIfAuthed>
          }
        />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="help" element={<HelpPage />} />
        <Route path="courts" element={<CourtsPage />} />
        <Route path="courts/:id" element={<CourtDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route element={<AppShellLayout />}>
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
            <ProtectedRoute requireRole={["VENUE_MANAGER", "ADMIN"]}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
