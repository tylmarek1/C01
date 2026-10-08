import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CreditCard, FlaskConical } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatCurrency, useFormatters } from "@/lib/format"
import { useTranslation } from "@/lib/i18n"
import type { Reservation } from "@/types"

/** Pay a reservation's quoted price online (ADR-010). The gateway is a test
 * one for now, so the dialog says so and lets you try a declined card. */
function PayDialog({ reservation, open, onOpenChange }: { reservation: Reservation; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const fmt = useFormatters()
  const queryClient = useQueryClient()
  const [decline, setDecline] = useState(false)

  const mutation = useMutation({
    mutationFn: () => api.payReservation(token!, reservation.id, decline),
    onSuccess: (payment) => {
      toast.success(payment.status === "PAID" ? t("pay.toast.paid") : t("pay.toast.refunding"))
      onOpenChange(false)
    },
    // 402: the gateway declined the card — say so in the UI language.
    onError: (error) =>
      toast.error(error instanceof ApiError ? (error.status === 402 ? t("pay.declined") : error.message) : t("pay.error")),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] })
      queryClient.invalidateQueries({ queryKey: ["reservation-payments", reservation.id] })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("pay.title")}</DialogTitle>
          <DialogDescription>
            {reservation.court.name} · {fmt.dateRange(reservation.start_time, reservation.end_time)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-end justify-between border-y-2 border-foreground py-4">
          <span className="eyebrow">{t("pay.amount")}</span>
          <span className="font-display text-[40px] leading-none font-extrabold tabular">{formatCurrency(reservation.price_total ?? 0)}</span>
        </div>
        <p className="flex gap-2 text-xs text-muted-foreground">
          <FlaskConical className="size-4 shrink-0" /> {t("pay.testMode")}
        </p>
        <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px]">
          {t("pay.simulateDecline")}
          <Switch checked={decline} onCheckedChange={setDecline} aria-label={t("pay.simulateDecline")} />
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            {!mutation.isPending && <CreditCard />} {t("pay.submit", { amount: formatCurrency(reservation.price_total ?? 0) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { PayDialog }
