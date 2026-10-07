import { AlertCircle } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { AuthLayout } from "@/components/shared/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/shared/password-input"
import { ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"

function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(email.trim(), password)
      const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from
      navigate(from ? `${from.pathname}${from.search ?? ""}` : "/app", { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.error.login"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={t("auth.login.title")}
      description={t("auth.login.description")}
      footer={
        <>
          {t("auth.login.noAccount")}{" "}
          <Link to="/register" className="font-medium text-foreground underline underline-offset-4">
            {t("auth.login.signup")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate={false}>
        {error && (
          <div role="alert" className="flex animate-fade-in items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
            <AlertCircle className="mt-px size-4 shrink-0" /> {error}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("auth.field.email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("auth.field.emailPlaceholder")}
            className="h-10"
            aria-invalid={Boolean(error)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t("auth.field.password")}</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="h-10"
            aria-invalid={Boolean(error)}
          />
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full" isLoading={isSubmitting}>
          {isSubmitting ? t("auth.login.submitting") : t("auth.login.submit")}
        </Button>
      </form>
    </AuthLayout>
  )
}

export { LoginPage }
