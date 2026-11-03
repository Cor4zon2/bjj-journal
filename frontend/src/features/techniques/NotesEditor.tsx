import { useState } from 'react'
import { useUpdateTechnique } from '../../api/queries'
import type { Technique } from '../../api/types'
import { Button, ErrorMessage, Section } from '../../components/ui'

export function NotesEditor({ technique }: { technique: Technique }) {
  const [notes, setNotes] = useState(technique.notes)
  const update = useUpdateTechnique(technique)
  const dirty = notes !== technique.notes

  return (
    <Section title="My notes">
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          update.mutate({ notes })
        }}
      >
        <label htmlFor="technique-notes" className="sr-only">
          My notes
        </label>
        <textarea
          id="technique-notes"
          value={notes}
          rows={5}
          placeholder="What clicked, what to try next time, who it works on…"
          onChange={(event) => setNotes(event.target.value)}
          className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base"
        />
        <div className="flex items-center justify-end gap-2">
          {update.isSuccess && !dirty && <span className="text-sm text-emerald-300">Saved</span>}
          {dirty && (
            <Button variant="ghost" onClick={() => setNotes(technique.notes)}>
              Discard
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={!dirty || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save notes'}
          </Button>
        </div>
        {update.isError && <ErrorMessage error={update.error} />}
      </form>
    </Section>
  )
}
