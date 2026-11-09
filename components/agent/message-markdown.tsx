"use client"

import { memo } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

const components: Components = {
  a: ({ href, children }) => href
    ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span>{children}</span>,
  // Keep wide tables inside their message bubble, including on small screens.
  table: ({ children }) => (
    <div className="chat-markdown-table" role="region" aria-label="Tableau" tabIndex={0}>
      <table>{children}</table>
    </div>
  ),
  pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
  // Do not automatically load third-party images included in generated answers.
  img: ({ src, alt }) => typeof src === "string" && src
    ? <a href={src} target="_blank" rel="noopener noreferrer">{alt || "Voir l’image"}</a>
    : null,
}

export const MessageMarkdown = memo(function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {content}
      </ReactMarkdown>
    </div>
  )
})
