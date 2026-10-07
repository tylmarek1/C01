import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTranslation } from "@/lib/i18n"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  destructive?: boolean
  isLoading?: boolean
  onConfirm: () => void
}

/** Shared "are you sure?" step for destructive or hard-to-undo actions
 * (cancel a reservation, remove a guest, delete a review, ...) — wrap the
 * mutation call in `onConfirm` rather than firing it straight from a
 * button's onClick. */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = true,
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader className="pr-0">
          {destructive && (
            <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-danger-soft text-danger">
              <AlertTriangle className="size-4" />
            </span>
          )}
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {t("common.cancel")}
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmDialog }
