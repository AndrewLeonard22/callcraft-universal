import HtmlPreviewFrame from "./HtmlPreviewFrame";

interface FormattedScriptProps {
  content: string;
}

/**
 * Renders script content with proper formatting
 * Supports both HTML content and legacy marker-based formatting
 */
export function FormattedScript({ content }: FormattedScriptProps) {
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
      // Check for color markers
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

      // Check for font size markers
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
      
      parts.push(remaining);
      break;
    }
    
    return parts.length > 0 ? parts : text;
  };
  
  return (
    <div className="space-y-4 text-foreground">
      {lines.map((line, index) => {
        if (line.trim() === '') return <div key={index} className="h-4" />;
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <h2 key={index} className="text-xl font-bold text-primary mt-6 mb-4 border-b border-border pb-2">
              {line.slice(2, -2)}
            </h2>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h3 key={index} className="text-lg font-semibold text-foreground mt-4 mb-2">
              {line.slice(2)}
            </h3>
          );
        }
        return (
          <p key={index} className="leading-relaxed text-foreground">
            {formatLine(line)}
          </p>
        );
      })}
    </div>
  );
}
