import type { ReactNode } from 'react'

export function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode
  tone?: 'slate' | 'amber' | 'blue'
}) {
  const tones = {
    slate: 'bg-slate-800 text-slate-300',
    amber: 'bg-amber-500/15 text-amber-300',
    blue: 'bg-sky-500/15 text-sky-300',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-slate-400 uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ErrorMessage({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <p role="alert" className="rounded-lg bg-red-900/60 px-4 py-2 text-sm">
      {message}
    </p>
  )
}

const buttonStyles = {
  primary: 'bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:opacity-50',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:opacity-50',
  ghost: 'text-slate-300 hover:bg-slate-800 disabled:opacity-40',
  danger: 'text-red-300 hover:bg-red-950 disabled:opacity-40',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button
      type="button"
      className={`min-h-10 rounded-lg px-3 text-sm font-medium transition-colors ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  )
}
