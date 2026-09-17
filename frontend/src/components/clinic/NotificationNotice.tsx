import { AlertTriangle, CheckCircle2, MailX } from 'lucide-react'
import type { NotificationOutcome } from '../../types'

/**
 * Reports what happened to the patient's email, separately from what happened
 * to the appointment.
 *
 * The distinction is the whole point: the appointment change has already been
 * saved and is not in doubt. If the email failed, staff need to know to phone
 * the patient - not to wonder whether the reschedule went through.
 */
export function NotificationNotice({
  outcome,
  successLabel,
  onResend,
}: {
  outcome: NotificationOutcome | null
  successLabel: string
  onResend?: () => void
}) {
  if (!outcome) return null

  if (outcome.status === 'sent') {
    return (
      <p className="flex items-center gap-2 text-sm text-(--color-success)">
        <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
        {successLabel}
      </p>
    )
  }

  if (outcome.status === 'skipped') {
    return (
      <p className="flex items-center gap-2 text-sm text-(--color-ink-soft)">
        <MailX className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        No email address on file, so the patient was not notified.
      </p>
    )
  }

  if (outcome.status === 'failed') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" strokeWidth={2} />
        <div className="text-sm">
          <p className="font-medium text-(--color-ink)">
            Patient notification could not be sent.
          </p>
          <p className="text-(--color-ink-soft)">
            The appointment itself was saved. Please contact the patient directly.
            {outcome.detail ? ` (${outcome.detail})` : ''}
          </p>
          {onResend && (
            <button
              onClick={onResend}
              className="mt-1 text-sm font-medium text-(--color-accent) hover:underline"
            >
              Try sending again
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}
