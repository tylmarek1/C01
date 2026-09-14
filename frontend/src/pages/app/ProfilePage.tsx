import { useMutation } from "@tanstack/react-query"
import { Camera, ShieldCheck } from "lucide-react"
import { useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/avatar"
import { Badge } from "@/components/shared/badge"
import { Button } from "@/components/shared/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shared/card"
import { Input } from "@/components/shared/input"
import { Label } from "@/components/shared/label"
import { SectionHeader } from "@/components/shared/section-header"
import { ApiError, api, assetUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/i18n"
import { compressImageFile } from "@/lib/image"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function formatKb(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function ProfilePage() {
  const { user, token, updateUser } = useAuth()
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(user?.name ?? "")
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const saveNameMutation = useMutation({
    mutationFn: (nextName: string) => api.updateProfile(token!, nextName),
    onSuccess: (updated) => {
      updateUser(updated)
      toast.success("Profile updated")
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not update your profile"),
  })

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const originalKb = formatKb(file.size)
      const compressed = await compressImageFile(file)
      const updated = await api.uploadAvatar(token!, compressed)
      return { updated, originalKb, compressedKb: formatKb(compressed.size) }
    },
    onSuccess: ({ updated, originalKb, compressedKb }) => {
      updateUser(updated)
      toast.success(`Avatar updated — compressed from ${originalKb} to ${compressedKb}`)
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not upload your avatar")
      setAvatarPreview(null)
    },
  })

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setAvatarPreview(URL.createObjectURL(file))
    avatarMutation.mutate(file)
  }

  function handleNameSubmit(event: FormEvent) {
    event.preventDefault()
    if (name.trim().length === 0) return
    saveNameMutation.mutate(name.trim())
  }

  if (!user) return null

  const avatarSrc = avatarPreview ?? assetUrl(user.avatar_url)

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <SectionHeader align="left" title={t("profile.title")} description={t("profile.description")} />

      <Card className="mt-10">
        <CardHeader>
          <CardTitle>{t("profile.picture.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="size-20">
              <AvatarImage src={avatarSrc} alt={user.name} className="object-cover" />
              <AvatarFallback className="text-lg">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarMutation.isPending}
              className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-signal-blue text-paper shadow-button transition-transform hover:scale-105 disabled:opacity-60"
              aria-label="Change avatar"
            >
              <Camera className="size-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-ink-navy">
              {avatarMutation.isPending ? "Uploading & compressing…" : "JPEG, PNG, WEBP or GIF, up to 8MB"}
            </p>
            <p className="text-sm text-slate-gray">
              We resize it to 512×512 and compress it client-side before upload, then again on the server.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("profile.details.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleNameSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t("auth.field.name")}</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("auth.field.email")}</Label>
              <Input value={user.email} disabled />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Badge variant="secondary" className="w-fit gap-1.5">
                <ShieldCheck className="size-3.5" />
                {user.role === "VENUE_MANAGER" ? "Venue manager" : "Player"}
              </Badge>
            </div>

            <Button
              type="submit"
              className="mt-2 w-fit"
              disabled={saveNameMutation.isPending || name.trim() === user.name}
            >
              {saveNameMutation.isPending ? t("profile.saving") : t("profile.save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export { ProfilePage }
