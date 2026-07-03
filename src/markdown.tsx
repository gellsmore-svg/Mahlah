/**
 * Minimal, dependency-free Markdown → React renderer for chat answers.
 *
 * Supports the subset local models actually emit: headings, paragraphs,
 * bold/italic, inline code, fenced code blocks, ordered/unordered lists,
 * blockquotes, and http(s) links. Output is React elements only (never raw
 * HTML), so model output cannot inject markup.
 */
import { Fragment, type ReactNode } from 'react'

const INLINE_TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\([^)\s]+\))/g
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s+/
const BLOCK_START = /^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s)/

function inline(text: string): ReactNode[] {
  return text.split(INLINE_TOKEN).map((part, i) => {
    if (!part) return null
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>
    }
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{inline(part.slice(2, -2))}</strong>
    }
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{inline(part.slice(1, -1))}</em>
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (link) {
      const [, label, href] = link
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return (
          <a key={i} href={href} target="_blank" rel="noreferrer">
            {label}
          </a>
        )
      }
      return <Fragment key={i}>{part}</Fragment>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

function blocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }

    if (line.startsWith('```')) {
      const buffer: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        buffer.push(lines[i])
        i++
      }
      i++ // skip the closing fence
      out.push(
        <pre key={key++}>
          <code>{buffer.join('\n')}</code>
        </pre>,
      )
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      // Shift down two levels so model headings stay below the app's chrome.
      const Tag = `h${Math.min(heading[1].length + 2, 6)}` as 'h3' | 'h4' | 'h5' | 'h6'
      out.push(<Tag key={key++}>{inline(heading[2])}</Tag>)
      i++
      continue
    }

    if (LIST_ITEM.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line)
      const items: string[] = []
      while (i < lines.length && LIST_ITEM.test(lines[i])) {
        items.push(lines[i].replace(LIST_ITEM, ''))
        i++
      }
      const List = ordered ? 'ol' : 'ul'
      out.push(
        <List key={key++}>
          {items.map((item, j) => (
            <li key={j}>{inline(item)}</li>
          ))}
        </List>,
      )
      continue
    }

    if (line.startsWith('>')) {
      const buffer: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) {
        buffer.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      out.push(<blockquote key={key++}>{inline(buffer.join(' '))}</blockquote>)
      continue
    }

    const buffer: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) {
      buffer.push(lines[i])
      i++
    }
    out.push(<p key={key++}>{inline(buffer.join('\n'))}</p>)
  }

  return out
}

export default function Markdown({ text }: { text: string }) {
  return <div className="md">{blocks(text)}</div>
}
