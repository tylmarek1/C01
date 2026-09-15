import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { AuthLayout } from "@/components/shared/auth-layout"
import { Button } from "@/components/shared/button"
import { Input } from "@/components/shared/input"
import { Label } from "@/components/shared/label"
import { PasswordInput } from "@/components/shared/password-input"
import { ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"

function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirmPassword) {
      toast.error(t("auth.error.passwordMismatch"))
      return
    }

    setIsSubmitting(true)
    try {
      await register(name, email, password)
      toast.success(t("auth.toast.registered"))
      navigate("/app", { replace: true })
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("auth.error.register"))
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
          <Link to="/login" className="font-medium text-ink-navy hover:underline">
            {t("auth.register.login")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{t("auth.field.name")}</Label>
          <Input
            id="name"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Alice Player"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("auth.field.email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t("auth.field.password")}</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("auth.field.passwordPlaceholder")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">{t("auth.field.confirmPassword")}</Label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder={t("auth.field.confirmPasswordPlaceholder")}
            aria-invalid={passwordsMismatch}
            className={passwordsMismatch ? "border-destructive focus-visible:border-destructive" : undefined}
          />
          {passwordsMismatch && <p className="text-sm text-destructive">{t("auth.error.passwordMismatch")}</p>}
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitting || passwordsMismatch}>
          {isSubmitting ? t("auth.register.submitting") : t("auth.register.submit")}
        </Button>
      </form>
    </AuthLayout>
  )
}

export { RegisterPage }
