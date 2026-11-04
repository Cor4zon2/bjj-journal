import type { Belt } from '../api/types'
import { beltLabel } from '../lib/labels'

const BELT_COLORS: Record<Belt, string> = {
  white: 'bg-stone-200',
  blue: 'bg-blue-600',
  purple: 'bg-purple-700',
  brown: 'bg-amber-900',
  black: 'bg-neutral-950 ring-1 ring-slate-600',
}

/** A belt with its rank bar and stripes, as worn. Black belts have a red bar. */
export function BeltBar({ belt, stripes }: { belt: Belt; stripes: number }) {
  return (
    <span
      role="img"
      aria-label={beltLabel(belt, stripes)}
      className={`flex h-6 w-36 items-stretch overflow-hidden rounded-sm ${BELT_COLORS[belt]}`}
    >
      <span className="grow" />
      <span
        className={`flex w-10 items-stretch gap-1 px-1.5 ${belt === 'black' ? 'bg-red-700' : 'bg-neutral-950'}`}
      >
        {Array.from({ length: stripes }, (_, i) => (
          <span key={i} className="w-1 bg-stone-100" />
        ))}
      </span>
      <span className="w-2" />
    </span>
  )
}
