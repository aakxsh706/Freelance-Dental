import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'
import type { ChangeEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

/**
 * Shared building blocks for the clinic software.
 *
 * Collected in one file so the internal screens stay visually consistent
 * without each page inventing its own spacing and border treatment. The
 * palette is the site's existing Tailwind theme - the clinic app is the same
 * product, not a second design system.
 */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-(--color-ink)">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-(--color-ink-soft)">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section
      className={`rounded-xl border border-(--color-border) bg-(--color-bg) ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </section>
  )
}

export function CardTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-base font-semibold text-(--color-ink)">{children}</h2>
      {actions}
    </div>
  )
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
  onClick,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'default' | 'accent' | 'warning'
  onClick?: () => void
}) {
  const toneClasses =
    tone === 'accent'
      ? 'border-(--color-accent)/30 bg-(--color-accent-soft)'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50'
        : 'border-(--color-border) bg-(--color-bg)'
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`rounded-xl border p-4 text-left ${toneClasses} ${
        onClick ? 'transition-colors hover:border-(--color-accent)/50' : ''
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-(--color-ink-faint)">
        {label}
      </p>
      <p className="mt-1.5 font-display text-2xl font-semibold text-(--color-ink)">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-(--color-ink-soft)">{hint}</p>}
    </Tag>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-(--color-ink-soft)">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <Inbox className="h-6 w-6 text-(--color-ink-faint)" strokeWidth={1.5} />
      <p className="text-sm font-medium text-(--color-ink)">{title}</p>
      {hint && <p className="max-w-sm text-sm text-(--color-ink-soft)">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-(--color-danger)">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      <div>{children}</div>
    </div>
  )
}

const CONTROL_CLASSES =
  'w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm text-(--color-ink) outline-none transition-colors focus:border-(--color-accent) disabled:opacity-60'

export function Field({
  label,
  children,
  error,
  hint,
  required,
  className = '',
}: {
  label: string
  children: ReactNode
  error?: string
  hint?: string
  required?: boolean
  className?: string
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium text-(--color-ink)">
        {label}
        {required && <span className="text-(--color-danger)"> *</span>}
        {!required && <span className="ml-1 text-xs font-normal text-(--color-ink-faint)">optional</span>}
      </span>
      {children}
      {hint && !error && <span className="text-xs text-(--color-ink-faint)">{hint}</span>}
      {error && <span className="text-xs text-(--color-danger)">{error}</span>}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return <input {...rest} className={`${CONTROL_CLASSES} ${className}`} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', rows = 3, ...rest } = props
  return <textarea {...rest} rows={rows} className={`${CONTROL_CLASSES} ${className}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props
  return (
    <select {...rest} className={`${CONTROL_CLASSES} ${className}`}>
      {children}
    </select>
  )
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-(--color-ink)">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-(--color-border) accent-(--color-accent)"
      />
      {label}
    </label>
  )
}

type ButtonTone = 'primary' | 'secondary' | 'danger' | 'ghost'

const BUTTON_TONES: Record<ButtonTone, string> = {
  primary: 'bg-(--color-accent) text-white hover:bg-(--color-accent-hover) border-transparent',
  secondary:
    'bg-(--color-bg) text-(--color-ink) border-(--color-border) hover:border-(--color-accent)/50',
  danger: 'bg-white text-(--color-danger) border-red-200 hover:bg-red-50',
  ghost: 'bg-transparent text-(--color-ink-soft) border-transparent hover:bg-(--color-surface)',
}

/** Compact square-ish button. The website's pill Button is deliberately not
 * reused here: dense operational rows need a tighter control. */
export function ActionButton({
  tone = 'secondary',
  children,
  className = '',
  ...rest
}: { tone?: ButtonTone } & InputHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...(rest as object)}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_TONES[tone]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warning' | 'danger' }) {
  const tones = {
    neutral: 'bg-(--color-surface) text-(--color-ink-soft) border-(--color-border)',
    accent: 'bg-(--color-accent-soft) text-(--color-accent) border-(--color-accent)/30',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-(--color-danger) border-red-200',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

/** Horizontally scrollable wrapper - dense tables must never make the page
 * itself scroll sideways. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-(--color-border) px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-(--color-ink-faint) ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`border-b border-(--color-border) px-4 py-3 align-middle text-(--color-ink) ${className}`}>
      {children}
    </td>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
  width = 'max-w-lg',
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  width?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-(--color-ink)/40 p-4 sm:p-8">
      <div className={`w-full ${width} rounded-xl border border-(--color-border) bg-(--color-bg) shadow-lg`}>
        <div className="flex items-center justify-between border-b border-(--color-border) px-5 py-4">
          <h2 className="font-display text-base font-semibold text-(--color-ink)">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-(--color-ink-soft) hover:bg-(--color-surface)"
          >
            Close
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
