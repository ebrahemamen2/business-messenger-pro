import { Fragment } from 'react';

interface FormattedTextProps {
  text: string;
  highlight?: string;
}

/**
 * Renders WhatsApp-style text formatting:
 * *bold*, _italic_, ~strikethrough~, ```monospace```
 * Also highlights search matches.
 */
const FormattedText = ({ text, highlight }: FormattedTextProps) => {
  // First apply WhatsApp formatting
  const parts = parseFormatting(text);

  if (!highlight) {
    return <>{parts}</>;
  }

  // Wrap highlight around text nodes
  return <>{highlightParts(parts, highlight)}</>;
};

function parseFormatting(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  // Match patterns: ```code```, *bold*, _italic_, ~strike~
  const regex = /(```[\s\S]*?```|\*[^\*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    const m = match[0];
    if (m.startsWith('```') && m.endsWith('```')) {
      result.push(
        <code key={match.index} className="bg-muted/40 px-1 py-0.5 rounded text-[12px] font-mono">
          {m.slice(3, -3)}
        </code>
      );
    } else if (m.startsWith('*') && m.endsWith('*')) {
      result.push(<strong key={match.index}>{m.slice(1, -1)}</strong>);
    } else if (m.startsWith('_') && m.endsWith('_')) {
      result.push(<em key={match.index}>{m.slice(1, -1)}</em>);
    } else if (m.startsWith('~') && m.endsWith('~')) {
      result.push(<del key={match.index} className="opacity-70">{m.slice(1, -1)}</del>);
    }
    lastIndex = match.index + m.length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length > 0 ? result : [text];
}

function highlightParts(parts: React.ReactNode[], query: string): React.ReactNode[] {
  const q = query.toLowerCase();
  return parts.map((part, i) => {
    if (typeof part !== 'string') return <Fragment key={i}>{part}</Fragment>;
    const idx = part.toLowerCase().indexOf(q);
    if (idx === -1) return <Fragment key={i}>{part}</Fragment>;
    return (
      <Fragment key={i}>
        {part.slice(0, idx)}
        <mark className="bg-primary/30 text-foreground rounded-sm px-0.5">{part.slice(idx, idx + query.length)}</mark>
        {part.slice(idx + query.length)}
      </Fragment>
    );
  });
}

export default FormattedText;
