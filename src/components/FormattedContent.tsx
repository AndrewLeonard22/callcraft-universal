import React from "react";
import HtmlPreviewFrame from "./HtmlPreviewFrame";

interface FormattedContentProps {
  content: string;
}

const FormattedContentInner = ({ content }: FormattedContentProps) => {
  // If content contains HTML tags, render it as HTML
  if (content.includes('<p>') || content.includes('<span') || content.includes('<strong>') || content.includes('<mark>')) {
    return <HtmlPreviewFrame html={content} />;
  }
  
  // Otherwise, use the marker-based formatting (backward compatibility)
  const lines = content.split('\n');
  
  const formatLine = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let remaining = text;
    let key = 0;
    
    while (remaining.length > 0) {
      const colorMatch = remaining.match(/\{(red|blue|green|yellow|purple|orange):([^\}]+)\}/);
      if (colorMatch && colorMatch.index !== undefined) {
        if (colorMatch.index > 0) {
          parts.push(remaining.substring(0, colorMatch.index));
        }
        const colorMap: Record<string, string> = {
          red: 'rgb(220, 38, 38)',
          blue: 'rgb(37, 99, 235)',
          green: 'rgb(22, 163, 74)',
          yellow: 'rgb(202, 138, 4)',
          purple: 'rgb(168, 85, 247)',
          orange: 'rgb(249, 115, 22)',
        };
        parts.push(
          <span key={`color-${key++}`} style={{ color: colorMap[colorMatch[1]] }}>
            {colorMatch[2]}
          </span>
        );
        remaining = remaining.substring(colorMatch.index + colorMatch[0].length);
        continue;
      }

      const sizeMatch = remaining.match(/\{(small|large):([^\}]+)\}/);
      if (sizeMatch && sizeMatch.index !== undefined) {
        if (sizeMatch.index > 0) {
          parts.push(remaining.substring(0, sizeMatch.index));
        }
        const sizeClass = sizeMatch[1] === 'small' ? 'text-xs' : 'text-lg';
        parts.push(
          <span key={`size-${key++}`} className={sizeClass}>
            {sizeMatch[2]}
          </span>
        );
        remaining = remaining.substring(sizeMatch.index + sizeMatch[0].length);
        continue;
      }
      
      const bracketMatch = remaining.match(/\[([^\]]+)\]/);
      if (bracketMatch && bracketMatch.index !== undefined) {
        if (bracketMatch.index > 0) {
          parts.push(remaining.substring(0, bracketMatch.index));
        }
        parts.push(
          <span key={`bracket-${key++}`} className="bg-primary/5 text-primary font-medium px-1.5 py-0.5 rounded">
            {bracketMatch[1]}
          </span>
        );
        remaining = remaining.substring(bracketMatch.index + bracketMatch[0].length);
        continue;
      }
      
      const quoteMatch = remaining.match(/"([^"]+)"/);
      if (quoteMatch && quoteMatch.index !== undefined) {
        if (quoteMatch.index > 0) {
          parts.push(remaining.substring(0, quoteMatch.index));
        }
        parts.push(
          <span key={`quote-${key++}`} className="bg-accent/5 text-accent font-medium px-1 rounded">
            {quoteMatch[1]}
          </span>
        );
        remaining = remaining.substring(quoteMatch.index + quoteMatch[0].length);
        continue;
      }
      
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(remaining.substring(0, boldMatch.index));
        }
        parts.push(
          <strong key={`bold-${key++}`} className="font-bold text-foreground">
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
        continue;
      }
      
      const italicMatch = remaining.match(/\*([^*]+)\*/);
      if (italicMatch && italicMatch.index !== undefined) {
        if (italicMatch.index > 0) {
          parts.push(remaining.substring(0, italicMatch.index));
        }
        parts.push(
          <strong key={`semi-${key++}`} className="font-semibold">
            {italicMatch[1]}
          </strong>
        );
        remaining = remaining.substring(italicMatch.index + italicMatch[0].length);
        continue;
      }
      
      parts.push(remaining);
      break;
    }
    
    return parts.length > 0 ? parts : text;
  };
  
  return (
    <>
      {lines.map((line, index) => {
        if (line.match(/^\d+\.\s+[A-Z]/)) {
          return (
            <h3 key={index} className="text-sm font-bold mt-2 mb-1 first:mt-0 text-foreground">
              {line}
            </h3>
          );
        }
        
        if (line.match(/^[A-Z\s]+:$/) || line.match(/^[*#]+\s*[A-Z][^a-z]*$/)) {
          return (
            <h3 key={index} className="text-sm font-bold mt-2 mb-1 first:mt-0 text-foreground">
              {line.replace(/^[*#]+\s*/, '').replace(/:$/, '')}
            </h3>
          );
        }
        
        if (line.match(/^(Stage|Phase|Step)\s+\d+/i)) {
          return (
            <h4 key={index} className="text-sm font-semibold mt-2 mb-1 text-foreground">
              {line}
            </h4>
          );
        }
        
        if (line.match(/^\*\*([^*]+)\*\*$/) || (line.endsWith(':') && line.length < 60 && !line.includes('.'))) {
          return (
            <h5 key={index} className="font-semibold text-sm mt-2 mb-1 text-foreground">
              {line.replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/:$/, '')}
            </h5>
          );
        }
        
        if (!line.trim()) {
          return <div key={index} className="h-1" />;
        }
        
        return (
          <p key={index} className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
            {formatLine(line)}
          </p>
        );
      })}
    </>
  );
};

export const FormattedContent = React.memo(FormattedContentInner);
