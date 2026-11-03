import { useId, useState } from 'react'
import { Button } from './ui'

type Props = {
  label: string
  initial: string[]
  ordered?: boolean
  saving?: boolean
  onSave: (items: string[]) => void
  onCancel: () => void
}

/** Edit a list of short texts on a phone: one input per line, add, remove and reorder. */
export function ListEditor({
  label,
  initial,
  ordered = false,
  saving = false,
  onSave,
  onCancel,
}: Props) {
  const [items, setItems] = useState<string[]>(initial.length > 0 ? initial : [''])
  const baseId = useId()

  const update = (index: number, value: string) =>
    setItems((current) => current.map((item, i) => (i === index ? value : item)))
  const remove = (index: number) => setItems((current) => current.filter((_, i) => i !== index))
  const move = (index: number, delta: number) =>
    setItems((current) => {
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(items.map((item) => item.trim()).filter(Boolean))
      }}
    >
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-1">
          {ordered && (
            <span className="w-5 pt-2.5 text-right text-sm text-slate-500">{index + 1}.</span>
          )}
          <label htmlFor={`${baseId}-${index}`} className="sr-only">
            {label} {index + 1}
          </label>
          <textarea
            id={`${baseId}-${index}`}
            value={item}
            rows={2}
            onChange={(event) => update(index, event.target.value)}
            className="min-w-0 flex-1 resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <div className="flex flex-col">
            <Button
              variant="ghost"
              className="min-h-8 px-2"
              aria-label={`Move ${label.toLowerCase()} ${index + 1} up`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              className="min-h-8 px-2"
              aria-label={`Move ${label.toLowerCase()} ${index + 1} down`}
              disabled={index === items.length - 1}
              onClick={() => move(index, 1)}
            >
              ↓
            </Button>
          </div>
          <Button
            variant="danger"
            className="px-2"
            aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
            onClick={() => remove(index)}
          >
            ✕
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button onClick={() => setItems((current) => [...current, ''])}>
          + Add {label.toLowerCase()}
        </Button>
        <span className="flex-1" />
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
