import React from 'react'

// Минимальный серверный рендер Lexical-richText → React. Поддерживает абзацы,
// заголовки (h2/h3), жирный/курсив/подчёркивание/зачёркивание, ссылки, списки,
// горизонтальную черту и переносы строк. Сложные узлы (upload/block/relationship
// и т.п.) рендерятся как пустые — для каркаса этого достаточно; полноценный
// рендер можно добавить при наполнении сайта.

const FORMAT_BOLD = 1
const FORMAT_ITALIC = 2
const FORMAT_STRIKETHROUGH = 4
const FORMAT_UNDERLINE = 8

type LexNode = { type?: string; [k: string]: unknown }
type LexRoot = { root?: { children?: LexNode[] } }

function renderInline(children: unknown, keyPrefix: string): React.ReactNode[] {
  if (!Array.isArray(children)) return []
  return (children as LexNode[]).map((node, i) => {
    const key = `${keyPrefix}-${i}`
    const type = node?.type
    if (type === 'text') {
      let el: React.ReactNode = String(node.text ?? '')
      const fmt = typeof node.format === 'number' ? node.format : 0
      if (fmt & FORMAT_BOLD) el = <strong key={`${key}-b`}>{el}</strong>
      if (fmt & FORMAT_ITALIC) el = <em key={`${key}-i`}>{el}</em>
      if (fmt & FORMAT_UNDERLINE) el = <u key={`${key}-u`}>{el}</u>
      if (fmt & FORMAT_STRIKETHROUGH) el = <s key={`${key}-s`}>{el}</s>
      return <React.Fragment key={key}>{el}</React.Fragment>
    }
    if (type === 'linebreak') return <br key={key} />
    if (type === 'link' || type === 'autolink') {
      const fields = (node.fields as { url?: string } | undefined) ?? {}
      return (
        <a key={key} href={String(fields.url ?? '#')}>
          {renderInline(node.children, key)}
        </a>
      )
    }
    return <React.Fragment key={key}>{renderInline(node.children, key)}</React.Fragment>
  })
}

export function RichText({ data }: { data: unknown }) {
  const root = (data as LexRoot)?.root
  if (!root || !Array.isArray(root.children)) return null
  return (
    <>
      {root.children.map((node, i) => {
        const key = `b-${i}`
        const type = node?.type
        if (type === 'heading') {
          const tag = node.tag === 'h3' ? 'h3' : 'h2'
          return React.createElement(tag, { key }, renderInline(node.children, key))
        }
        if (type === 'list') {
          const ordered = node.tag === 'ol' || node.listType === 'number'
          const items = Array.isArray(node.children) ? (node.children as LexNode[]) : []
          const lis = items.map((li, j) => (
            <li key={`${key}-${j}`}>{renderInline(li.children, `${key}-${j}`)}</li>
          ))
          return ordered ? <ol key={key}>{lis}</ol> : <ul key={key}>{lis}</ul>
        }
        if (type === 'horizontalrule') return <hr key={key} />
        if (type === 'paragraph') {
          const inner = renderInline(node.children, key)
          return <p key={key}>{inner}</p>
        }
        return null
      })}
    </>
  )
}
