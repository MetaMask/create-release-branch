import ReactMarkdown from 'react-markdown';

/**
 * Renders Markdown, used to render the changelog for a package.
 *
 * @param props - The props.
 * @param props.content - The text to render.
 * @returns The rendered Markdown.
 */
export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ node, ...props }) => (
          <h1 className="text-2xl font-bold my-4" {...props} />
        ),
        h2: ({ node, ...props }) => (
          <h2 className="text-xl font-bold my-3" {...props} />
        ),
        h3: ({ node, ...props }) => (
          <h3 className="text-lg font-bold my-2" {...props} />
        ),
        p: ({ node, ...props }) => <p className="my-2" {...props} />,
        ul: ({ node, ...props }) => (
          <ul className="list-disc ml-4 my-2" {...props} />
        ),
        ol: ({ node, ...props }) => (
          <ol className="list-decimal ml-4 my-2" {...props} />
        ),
        li: ({ node, ...props }) => <li className="my-1" {...props} />,
        code: ({ node, ...props }) => (
          <code
            className="bg-gray-100 rounded px-1 py-0.5 text-sm font-mono"
            {...props}
          />
        ),
        pre: ({ node, ...props }) => (
          <pre
            className="bg-gray-100 rounded p-2 my-2 overflow-x-auto font-mono text-sm"
            {...props}
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
