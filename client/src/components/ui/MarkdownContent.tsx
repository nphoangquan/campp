import type React from 'react';

/**
 * Lightweight markdown renderer for message content.
 * Supports: **bold**, *italic*, `code`, [links](url), ~~strikethrough~~, ```code blocks```
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function parseMarkdown(text: string): React.ReactNode[] {
  if (!text || typeof text !== 'string') return [text];
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const patterns: Array<{
    regex: RegExp;
    render: (match: RegExpMatchArray) => React.ReactNode;
  }> = [
    // Code block ```...```
    {
      regex: /```([\s\S]*?)```/,
      render: ([, code]) => (
        <code key={key++} className="block bg-layer-3 rounded px-2 py-1.5 text-sm font-mono text-[#B5BAC1] my-1 overflow-x-auto">
          {escapeHtml((code || '').trim())}
        </code>
      ),
    },
    // Inline code `...`
    {
      regex: /`([^`]+)`/,
      render: ([, code]) => (
        <code key={key++} className="bg-layer-3 px-1.5 py-0.5 rounded text-sm font-mono text-accent-200">
          {escapeHtml(code)}
        </code>
      ),
    },
    // Bold **...** or __...__
    {
      regex: /\*\*(.+?)\*\*|__(.+?)__/,
      render: ([, a, b]) => (
        <strong key={key++} className="font-semibold text-white">
          {escapeHtml(a || b || '')}
        </strong>
      ),
    },
    // Italic *...* or _..._
    {
      regex: /\*([^*]+)\*|_([^_]+)_/,
      render: ([, a, b]) => (
        <em key={key++} className="italic">
          {escapeHtml(a || b || '')}
        </em>
      ),
    },
    // Strikethrough ~~...~~
    {
      regex: /~~(.+?)~~/,
      render: ([, s]) => (
        <del key={key++} className="line-through text-[#80848E]">
          {escapeHtml(s)}
        </del>
      ),
    },
    // Spoiler ||...||
    {
      regex: /\|\|(.+?)\|\|/,
      render: ([, s]) => (
        <span key={key++} className="spoiler bg-[#4E5058] text-transparent hover:bg-transparent hover:text-[#DBDEE1] rounded px-0.5 cursor-default" title="Spoiler - click to reveal">
          {escapeHtml(s)}
        </span>
      ),
    },
    // Links [text](url)
    {
      regex: /\[([^\]]+)\]\(([^)]+)\)/,
      render: ([, label, url]) => (
        <a
          key={key++}
          href={url.startsWith('http') ? url : `https://${url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-400 hover:underline"
        >
          {escapeHtml(label)}
        </a>
      ),
    },
    // Mentions @username, @everyone, @here, @role (role names may have spaces)
    {
      regex: /@([a-zA-Z0-9_][a-zA-Z0-9_\s]*?)(?=\s|$|@|[,.\?!)\]>])/,
      render: ([, name]) => (
        <span key={key++} className="bg-accent-500/20 text-accent-200 px-1 rounded mention">
          @{escapeHtml((name || '').trim())}
        </span>
      ),
    },
  ];

  while (remaining.length > 0) {
    let matched = false;
    for (const { regex, render } of patterns) {
      const m = remaining.match(regex);
      if (m && m.index !== undefined) {
        if (m.index > 0) {
          parts.push(
            <span key={key++} className="whitespace-pre-wrap">
              {escapeHtml(remaining.slice(0, m.index))}
            </span>
          );
        }
        parts.push(render(m));
        remaining = remaining.slice(m.index + m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      parts.push(
        <span key={key++} className="whitespace-pre-wrap">
          {escapeHtml(remaining)}
        </span>
      );
      break;
    }
  }

  return parts;
}

interface Props {
  content: string;
  className?: string;
}

export default function MarkdownContent({ content, className = '' }: Props) {
  const nodes = parseMarkdown(content);
  return (
    <span className={`text-[#B5BAC1] text-sm break-words ${className}`}>
      {nodes}
    </span>
  );
}
