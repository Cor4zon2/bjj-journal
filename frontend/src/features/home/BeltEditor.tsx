import { useState } from 'react'
import { useUpdateProfile } from '../../api/queries'
import type { Belt } from '../../api/types'
import { Button, ErrorMessage } from '../../components/ui'
import { BELTS, MAX_STRIPES } from '../../lib/labels'

/** Belt and stripes are set by hand: the app never promotes you. */
export function BeltEditor({
  belt: initialBelt,
  stripes: initialStripes,
  onDone,
}: {
  belt: Belt
  stripes: number
  onDone: () => void
}) {
  const [belt, setBelt] = useState(initialBelt)
  const [stripes, setStripes] = useState(initialStripes)
  const update = useUpdateProfile()

  return (
    <form
      aria-label="Edit belt"
      className="flex flex-col gap-3 rounded-xl bg-slate-950/60 p-3"
      onSubmit={(event) => {
        event.preventDefault()
        update.mutate({ belt, stripes }, { onSuccess: onDone })
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Belt
        <select
          value={belt}
          onChange={(event) => setBelt(event.target.value as Belt)}
          className="min-h-10 rounded-lg border border-slate-700 bg-slate-900 px-2 text-base text-slate-100"
        >
          {BELTS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-slate-400">Stripes</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: MAX_STRIPES + 1 }, (_, n) => (
            <label
              key={n}
              className={`flex min-h-10 cursor-pointer items-center justify-center rounded-lg text-base font-semibold ${
                n === stripes ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              <input
                type="radio"
                name="stripes"
                value={n}
                checked={n === stripes}
                onChange={() => setStripes(n)}
                className="sr-only"
              />
              {n}
            </label>
          ))}
        </div>
      </fieldset>
      {update.isError && <ErrorMessage error={update.error} />}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
