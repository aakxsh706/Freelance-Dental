import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'ghost'

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-(--color-accent) text-white hover:bg-(--color-accent-hover) border border-transparent',
  secondary:
    'bg-transparent text-(--color-ink) border border-(--color-ink)/20 hover:border-(--color-ink)/40',
  ghost: 'bg-transparent text-(--color-accent) hover:bg-(--color-accent-soft) border border-transparent',
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium tracking-wide transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed'

interface CommonProps {
  variant?: Variant
  children: ReactNode
  className?: string
}

interface ButtonAsButton
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {
  to?: undefined
}

interface ButtonAsLink extends CommonProps {
  to: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = 'primary', children, className = '' } = props
  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`

  if ('to' in props && props.to) {
    return (
      <Link to={props.to} className={classes} onClick={props.onClick}>
        {children}
      </Link>
    )
  }

  const { variant: _variant, className: _className, to: _to, ...rest } = props as ButtonAsButton
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  )
}
