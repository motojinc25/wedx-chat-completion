import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

interface MarkdownContentProps {
  content: string
}

export const MarkdownContent = memo(({ content }: MarkdownContentProps) => {
  return (
    <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  )
})

MarkdownContent.displayName = 'MarkdownContent'
