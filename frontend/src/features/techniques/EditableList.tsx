import { useState } from 'react'
import { useUpdateTechnique } from '../../api/queries'
import type { Technique } from '../../api/types'
import { ListEditor } from '../../components/ListEditor'
import { Button, ErrorMessage, Section } from '../../components/ui'

type Props = {
  technique: Technique
  field: 'steps' | 'key_details'
  title: string
  itemLabel: string
  ordered?: boolean
}

export function EditableList({ technique, field, title, itemLabel, ordered = false }: Props) {
  const [editing, setEditing] = useState(false)
  const update = useUpdateTechnique(technique)
  const items = technique[field]
  const ListTag = ordered ? 'ol' : 'ul'

  return (
    <Section
      title={title}
      action={
        !editing && (
          <Button
            variant="ghost"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${title.toLowerCase()}`}
          >
            Edit
          </Button>
        )
      }
    >
      {editing ? (
        <ListEditor
          label={itemLabel}
          initial={items}
          ordered={ordered}
          saving={update.isPending}
          onCancel={() => setEditing(false)}
          onSave={(next) =>
            update.mutate({ [field]: next }, { onSuccess: () => setEditing(false) })
          }
        />
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing here yet.</p>
      ) : (
        <ListTag
          className={`flex flex-col gap-2 pl-5 text-slate-200 ${ordered ? 'list-decimal' : 'list-disc'}`}
        >
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ListTag>
      )}
      {update.isError && (
        <div className="mt-2">
          <ErrorMessage error={update.error} />
        </div>
      )}
    </Section>
  )
}
