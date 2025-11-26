import { marked } from 'marked'

const renderer = new marked.Renderer()

function normalizeHref(h) {
  if (!h) return ''
  if (typeof h === 'string') return h
  if (typeof h === 'object' && 'href' in h && typeof h.href === 'string') return h.href
  return String(h)
}

renderer.link = token => {
  let src = normalizeHref(token.href)
  const label = token.text && token.text.trim() ? token.text.trim() : 'Anhang'
  const title = token.title ? ` title="${token.title}"` : ''
  if (src.startsWith(':/')) {
    const id = src.slice(2)
    const encoded = encodeURIComponent(label)
    src = `/joplin/resource/${id}?name=${encoded}`
    return `<a href="${src}"${title}>${label}</a>`
  }
  return `<a href="${src}"${title}>${label}</a>`
}

renderer.image = token => {
  let src = normalizeHref(token.href)
  if (src.startsWith(':/')) src = `/joplin/resource/${src.slice(2)}`
  const alt = token.text || ''
  const title = token.title ? ` title="${token.title}"` : ''
  return `<img src="${src}" alt="${alt}"${title}>`
}

marked.setOptions({ renderer })

export function renderMarkdown(markdown) {
  return marked.parse(markdown)
}
