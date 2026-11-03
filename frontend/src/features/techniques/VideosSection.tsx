import { useState } from 'react'
import { useAddVideo, useDeleteVideo } from '../../api/queries'
import type { Technique, VideoLink } from '../../api/types'
import { Button, ErrorMessage, Section } from '../../components/ui'
import { looksLikeUrl, youtubeSearchUrl } from '../../lib/videos'

export function VideosSection({ technique }: { technique: Technique }) {
  const [adding, setAdding] = useState(false)

  return (
    <Section
      title="Videos"
      action={
        !adding && (
          <Button variant="ghost" onClick={() => setAdding(true)}>
            + Add
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {technique.videos.length === 0 && !adding && (
          <p className="text-sm text-slate-500">
            No videos yet.{' '}
            <a
              href={youtubeSearchUrl(technique.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-300 underline"
            >
              Search YouTube
            </a>{' '}
            and paste a link here, or add an Instagram Reel.
          </p>
        )}
        {technique.videos.map((video) => (
          <VideoItem key={video.id} technique={technique} video={video} />
        ))}
        {adding && <AddVideoForm technique={technique} onDone={() => setAdding(false)} />}
      </div>
    </Section>
  )
}

function VideoItem({ technique, video }: { technique: Technique; video: VideoLink }) {
  const remove = useDeleteVideo(technique)
  const title = video.title || (video.source === 'instagram' ? 'Instagram Reel' : 'Video')

  return (
    <div className="flex flex-col gap-2">
      {video.embed_url ? (
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          <iframe
            src={video.embed_url}
            title={title}
            loading="lazy"
            className="h-full w-full"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      ) : (
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex min-h-12 items-center gap-3 rounded-xl px-4 font-medium ${
            video.source === 'instagram'
              ? 'bg-gradient-to-r from-fuchsia-700 to-orange-600 text-white'
              : 'bg-slate-800'
          }`}
        >
          <span aria-hidden="true">{video.source === 'instagram' ? '▶' : '↗'}</span>
          {video.source === 'instagram' ? `Open in Instagram: ${title}` : title}
        </a>
      )}
      <div className="flex items-center justify-between gap-2 text-sm text-slate-400">
        <span className="truncate">{video.embed_url ? title : video.url}</span>
        <Button
          variant="danger"
          className="min-h-8 shrink-0"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(`Remove “${title}”?`)) remove.mutate(video.id)
          }}
        >
          Remove
        </Button>
      </div>
      {remove.isError && <ErrorMessage error={remove.error} />}
    </div>
  )
}

function AddVideoForm({ technique, onDone }: { technique: Technique; onDone: () => void }) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const add = useAddVideo(technique)
  const valid = looksLikeUrl(url)

  return (
    <form
      className="flex flex-col gap-2 rounded-xl bg-slate-950/60 p-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!valid) return
        add.mutate({ url: url.trim(), title: title.trim() }, { onSuccess: onDone })
      }}
    >
      <label className="flex flex-col gap-1 text-sm text-slate-400">
        Link (YouTube or Instagram Reel)
        <input
          type="url"
          inputMode="url"
          required
          value={url}
          placeholder="https://youtu.be/…"
          onChange={(event) => setUrl(event.target.value)}
          className="min-h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-400">
        Title (optional)
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="min-h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100"
        />
      </label>
      {add.isError && <ErrorMessage error={add.error} />}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!valid || add.isPending}>
          {add.isPending ? 'Adding…' : 'Add video'}
        </Button>
      </div>
    </form>
  )
}
