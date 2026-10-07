import { AlertCircle, Check } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { AuthLayout } from "@/components/shared/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/shared/password-input"
import { ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const MIN_PASSWORD = 8

function passwordScore(password: string): number {
  let score = 0
  if (password.length >= MIN_PASSWORD) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score++
  return score
}

function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD
  const score = passwordScore(password)
  const strengthLabel = [t("auth.strength.weak"), t("auth.strength.weak"), t("auth.strength.fair"), t("auth.strength.good"), t("auth.strength.strong")][score]

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError(t("auth.error.passwordMismatch"))
      return
    }
    if (password.length < MIN_PASSWORD) {
      setError(t("auth.error.passwordTooShort", { count: MIN_PASSWORD }))
      return
    }
    setIsSubmitting(true)
    try {
      await register(name.trim(), email.trim(), password)
      toast.success(t("auth.toast.registered"))
      navigate("/app", { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.error.register"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={t("auth.register.title")}
      description={t("auth.register.description")}
      footer={
        <>
          {t("auth.register.haveAccount")}{" "}
          <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
            {t("auth.register.login")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div role="alert" className="flex animate-fade-in items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
            <AlertCircle className="mt-px size-4 shrink-0" /> {error}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{t("auth.field.name")}</Label>
          <Input id="name" autoComplete="name" required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={t("auth.field.namePlaceholder")} className="h-10" maxLength={100} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("auth.field.email")}</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("auth.field.emailPlaceholder")} className="h-10" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t("auth.field.password")}</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("auth.field.passwordPlaceholder")}
            className="h-10"
            aria-invalid={tooShort}
            aria-describedby="password-strength"
          />
          {password.length > 0 && (
            <div id="password-strength" className="flex animate-fade-in items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors duration-300",
                      score >= step ? (score <= 1 ? "bg-danger" : score === 2 ? "bg-warning" : "bg-success") : "bg-muted",
                    )}
                  />
                ))}
              </div>
              <span className="w-16 text-right text-[11px] text-muted-foreground">{strengthLabel}</span>
            </div>
          )}
          {tooShort && <span className="text-xs text-danger">{t("auth.error.passwordTooShort", { count: MIN_PASSWORD })}</span>}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">{t("auth.field.confirmPassword")}</Label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder={t("auth.field.confirmPasswordPlaceholder")}
            className="h-10"
            aria-invalid={passwordsMismatch}
          />
          {passwordsMismatch ? (
            <span className="text-xs text-danger">{t("auth.error.passwordMismatch")}</span>
          ) : (
            confirmPassword.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-success">
                <Check className="size-3.5" /> {t("auth.passwordsMatch")}
              </span>
            )
          )}
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full" isLoading={isSubmitting} disabled={passwordsMismatch}>
          {isSubmitting ? t("auth.register.submitting") : t("auth.register.submit")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{t("auth.register.terms")}</p>
      </form>
    </AuthLayout>
  )
}

export { RegisterPage }
