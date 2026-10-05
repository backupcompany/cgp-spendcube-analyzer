import React from 'react';
import { 
  Building2, 
  Calendar, 
  CheckCircle2, 
  FileText, 
  Layers, 
  Package, 
  ShieldCheck, 
  Sparkles, 
  Store, 
  TrendingUp,
  Info
} from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  /**
   * Robust parser for inline text formatting.
   * Handles bold (**bold**), italic (*italic*), code (`code`), and strips orphaned/unmatched asterisks (* or **).
   */
  const renderInlineFormatted = (text: string): React.ReactNode => {
    if (!text) return '';

    // 1. Pre-clean common double/triple asterisks artifacts in LLM text
    // E.g. "***text***" -> "**text**"
    let clean = text
      .replace(/\*\*\*([^*]+)\*\*\*/g, '**$1**')
      .replace(/\*{3,}([^*]+)\*{2,}/g, '**$1**')
      .replace(/\*{2,}([^*]+)\*{3,}/g, '**$1**');

    // 2. Tokenize into bold, italic, code, and text
    const tokens: React.ReactNode[] = [];
    let remaining = clean;
    let keyIdx = 0;

    // Pattern matches:
    // 1. `code`
    // 2. **bold** (2 or more chars inside)
    // 3. *italic* (non-asterisk inside)
    const tokenRegex = /(`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/;

    while (remaining.length > 0) {
      const match = remaining.match(tokenRegex);
      if (!match || match.index === undefined) {
        // Strip any residual dangling single or double asterisks in the remaining plain text
        const safeRemaining = remaining.replace(/\*+/g, '');
        if (safeRemaining) tokens.push(safeRemaining);
        break;
      }

      const matchIndex = match.index;
      if (matchIndex > 0) {
        // Strip dangling asterisks in prefix text
        const prefix = remaining.substring(0, matchIndex).replace(/\*+/g, '');
        if (prefix) tokens.push(prefix);
      }

      const fullMatch = match[0];
      if (fullMatch.startsWith('`') && fullMatch.endsWith('`')) {
        tokens.push(
          <code key={keyIdx++} className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-blue-700 border border-slate-200">
            {match[2]}
          </code>
        );
      } else if (fullMatch.startsWith('**') && fullMatch.endsWith('**')) {
        const boldText = match[3].replace(/\*+/g, '').trim();
        if (boldText) {
          tokens.push(
            <strong key={keyIdx++} className="font-bold text-slate-900">
              {boldText}
            </strong>
          );
        }
      } else if (fullMatch.startsWith('*') && fullMatch.endsWith('*')) {
        const italicText = match[4].replace(/\*+/g, '').trim();
        if (italicText) {
          tokens.push(
            <em key={keyIdx++} className="italic text-slate-600 font-medium">
              {italicText}
            </em>
          );
        }
      }

      remaining = remaining.substring(matchIndex + fullMatch.length);
    }

    return tokens.length > 0 ? tokens : clean.replace(/\*+/g, '');
  };

  // Split lines and group into logical semantic blocks (Headers, Blockquotes, Tables, Lists, Paragraphs, HR)
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let lineIdx = 0;

  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx];
    const line = rawLine.trim();

    // Empty lines
    if (!line) {
      lineIdx++;
      continue;
    }

    // Horizontal Rule: --- or ***
    if (/^(\-{3,}|\*{3,})$/.test(line)) {
      blocks.push(
        <hr key={`hr-${lineIdx}`} className="my-4 border-t border-slate-200/80" />
      );
      lineIdx++;
      continue;
    }

    // Blockquote or Callout note: lines starting with >
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (lineIdx < lines.length && lines[lineIdx].trim().startsWith('>')) {
        const ql = lines[lineIdx].trim().replace(/^>\s*/, '');
        if (ql) quoteLines.push(ql);
        lineIdx++;
      }

      blocks.push(
        <div key={`quote-${lineIdx}`} className="p-3.5 my-3 bg-blue-50/70 border-l-4 border-blue-500 rounded-r-xl text-xs sm:text-sm text-slate-700 space-y-1">
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} className="leading-relaxed">
              {renderInlineFormatted(ql)}
            </p>
          ))}
        </div>
      );
      continue;
    }

    // Headings: ### Header or ## Header or # Header
    if (line.startsWith('#')) {
      const levelMatch = line.match(/^(#{1,6})\s*(.*)$/);
      if (levelMatch) {
        const level = levelMatch[1].length;
        // Clean any residual asterisks from heading text
        let headingText = levelMatch[2].replace(/\*+/g, '').trim();

        // Icon mapping for header themes
        let headerIcon: React.ReactNode = null;
        if (/konsentrasi|vendor|rekanan|pemasok/i.test(headingText)) {
          headerIcon = <Store className="w-4 h-4 text-purple-600 shrink-0 inline mr-2" />;
        } else if (/dimensi|metrik|spendcube|ringkasan|transaksi/i.test(headingText)) {
          headerIcon = <Layers className="w-4 h-4 text-blue-600 shrink-0 inline mr-2" />;
        } else if (/rekomendasi|strategis|saran/i.test(headingText)) {
          headerIcon = <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 inline mr-2" />;
        } else {
          headerIcon = <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 inline mr-2" />;
        }

        if (level <= 2) {
          blocks.push(
            <h3 key={`h-${lineIdx}`} className="text-base font-extrabold text-slate-900 mt-4 mb-2 flex items-center">
              {headerIcon}
              <span>{headingText}</span>
            </h3>
          );
        } else {
          blocks.push(
            <h4 key={`h-${lineIdx}`} className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide mt-3 mb-2 flex items-center">
              {headerIcon}
              <span>{headingText}</span>
            </h4>
          );
        }
        lineIdx++;
        continue;
      }
    }

    // Markdown Table: lines starting and ending with |
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (lineIdx < lines.length && lines[lineIdx].trim().startsWith('|') && lines[lineIdx].trim().endsWith('|')) {
        tableLines.push(lines[lineIdx].trim());
        lineIdx++;
      }

      if (tableLines.length >= 2) {
        // Parse row cells
        const parseRow = (rowStr: string) => {
          return rowStr
            .slice(1, -1)
            .split('|')
            .map(c => c.trim());
        };

        const headers = parseRow(tableLines[0]);
        const bodyLines = tableLines.slice(1).filter(l => !/^[|\s:-]+$/.test(l));

        blocks.push(
          <div key={`table-${lineIdx}`} className="overflow-x-auto my-3.5 border border-slate-200/90 rounded-xl shadow-xs bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold">
                  {headers.map((h, hIdx) => {
                    const cleanH = h.replace(/\*+/g, '').trim();
                    return (
                      <th key={hIdx} className="py-2.5 px-3.5 whitespace-nowrap text-slate-700 font-bold">
                        {cleanH}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bodyLines.map((bLine, rIdx) => {
                  const cells = parseRow(bLine);
                  return (
                    <tr key={rIdx} className="hover:bg-blue-50/50 transition-colors">
                      {cells.map((cell, cIdx) => (
                        <td key={cIdx} className="py-2.5 px-3.5 text-slate-800 whitespace-nowrap font-medium">
                          {renderInlineFormatted(cell)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Bullet Lists: starts with - or * (including lines starting with ***BoldLabel:**)
    const isBulletLine = (l: string) => {
      const trimmed = l.trim();
      return /^[\*\-]\s+/.test(trimmed) || /^\*{2,}[^*]+/.test(trimmed);
    };

    if (isBulletLine(line)) {
      const listItems: string[] = [];
      while (lineIdx < lines.length && isBulletLine(lines[lineIdx])) {
        const itemLine = lines[lineIdx].trim()
          .replace(/^[\*\-]\s+/, '')
          .replace(/^\*{3,}/, '**'); // Normalize triple asterisks to standard bold
        listItems.push(itemLine);
        lineIdx++;
      }

      blocks.push(
        <ul key={`ul-${lineIdx}`} className="my-2.5 space-y-1.5 pl-1">
          {listItems.map((item, iIdx) => (
            <li key={iIdx} className="flex items-start space-x-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 shrink-0"></span>
              <div className="flex-1 min-w-0">
                {renderInlineFormatted(item)}
              </div>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered Lists: starts with 1. 2. etc
    if (/^\d+\.\s+/.test(line)) {
      const listItems: { num: string; text: string }[] = [];
      while (lineIdx < lines.length && /^\d+\.\s+/.test(lines[lineIdx].trim())) {
        const itemMatch = lines[lineIdx].trim().match(/^(\d+)\.\s+(.*)$/);
        if (itemMatch) {
          listItems.push({ num: itemMatch[1], text: itemMatch[2] });
        }
        lineIdx++;
      }

      blocks.push(
        <div key={`ol-${lineIdx}`} className="my-2.5 space-y-2">
          {listItems.map((item, iIdx) => (
            <div key={iIdx} className="flex items-start space-x-2.5 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                {item.num}
              </span>
              <div className="flex-1 min-w-0">
                {renderInlineFormatted(item.text)}
              </div>
            </div>
          ))}
        </div>
      );
      continue;
    }

    // Default: Regular Paragraph
    blocks.push(
      <p key={`p-${lineIdx}`} className="text-xs sm:text-sm text-slate-800 leading-relaxed my-2">
        {renderInlineFormatted(line)}
      </p>
    );
    lineIdx++;
  }

  return (
    <div className={`space-y-1 text-slate-800 ${className}`}>
      {blocks}
    </div>
  );
};
