/** A YouTube search for the technique, for when no video has been saved yet. */
export function youtubeSearchUrl(techniqueName: string): string {
  const query = `bjj ${techniqueName}`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

export function looksLikeUrl(text: string): boolean {
  try {
    const url = new URL(text.trim())
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
