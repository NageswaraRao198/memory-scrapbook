import ReactMarkdown from 'react-markdown';

/** Renders user Markdown. Raw HTML is not enabled, so diary text cannot inject markup. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-diary">
      <ReactMarkdown
        components={{
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
