import { AlertTriangle, Pill as PillIcon, ShieldAlert } from 'lucide-react'
import type { Allergy, MedicalCondition, PatientMedication } from '../../types/clinic'

/**
 * The safety banner on a patient's file.
 *
 * Allergies come first and are always red regardless of severity: the whole
 * point of the banner is that a clinician cannot start treatment without
 * having seen it. Severity is shown as text rather than by fading the
 * colour, because a "mild" allergy still must not be missed.
 */
export function PatientAlerts({
  allergies,
  conditions,
  medications,
}: {
  allergies: Allergy[]
  conditions: MedicalCondition[]
  medications?: PatientMedication[]
}) {
  const hasAny = allergies.length > 0 || conditions.length > 0 || (medications?.length ?? 0) > 0
  if (!hasAny) return null

  return (
    <div className="flex flex-col gap-2">
      {allergies.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 px-4 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-(--color-danger)" strokeWidth={2} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-(--color-danger)">
              Allergy
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {allergies.map((allergy) => (
                <li key={allergy.id} className="text-sm text-(--color-ink)">
                  <span className="font-medium">{allergy.substance}</span>
                  <span className="text-(--color-ink-soft)">
                    {' '}
                    — {allergy.severity_display}
                    {allergy.reaction ? ` · ${allergy.reaction}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {conditions.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" strokeWidth={2} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Medical Condition
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {conditions.map((condition) => (
                <li key={condition.id} className="text-sm text-(--color-ink)">
                  <span className="font-medium">{condition.condition}</span>
                  <span className="text-(--color-ink-soft)"> — {condition.status_display}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {medications && medications.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3">
          <PillIcon className="mt-0.5 h-4 w-4 shrink-0 text-(--color-ink-soft)" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-(--color-ink-faint)">
              Current Medication
            </p>
            <p className="mt-1 text-sm text-(--color-ink)">
              {medications
                .map((m) => [m.medication_name, m.dosage].filter(Boolean).join(' '))
                .join(' · ')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
