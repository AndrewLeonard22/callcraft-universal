import { useState, useRef } from "react";
import { Bold, Highlighter, Quote, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  minHeight?: string;
}

const FormattedPreview = ({ content }: { content: string }) => {
  const lines = content.split('\n');
  
  const formatLine = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let remaining = text;
    let key = 0;
    
    while (remaining.length > 0) {
      const bracketMatch = remaining.match(/\[([^\]]+)\]/);
      if (bracketMatch && bracketMatch.index !== undefined) {
        if (bracketMatch.index > 0) {
          parts.push(remaining.substring(0, bracketMatch.index));
        }
        parts.push(
          <span key={`bracket-${key++}`} className="bg-primary/10 text-primary font-medium px-2 py-0.5 rounded">
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
          <span key={`quote-${key++}`} className="bg-accent/10 text-accent font-medium px-1.5 rounded italic">
            "{quoteMatch[1]}"
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
      
      const uppercaseMatch = remaining.match(/__([^_]+)__/);
      if (uppercaseMatch && uppercaseMatch.index !== undefined) {
        if (uppercaseMatch.index > 0) {
          parts.push(remaining.substring(0, uppercaseMatch.index));
        }
        parts.push(
          <span key={`uppercase-${key++}`} className="uppercase font-semibold">
            {uppercaseMatch[1]}
          </span>
        );
        remaining = remaining.substring(uppercaseMatch.index + uppercaseMatch[0].length);
        continue;
      }
      
      parts.push(remaining);
      break;
    }
    
    return parts.length > 0 ? parts : text;
  };
  
  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        if (!line.trim()) {
          return <div key={index} className="h-2" />;
        }
        
        return (
          <p key={index} className="text-sm leading-relaxed">
            {formatLine(line)}
          </p>
        );
      })}
    </div>
  );
};

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Enter your text...", 
  label,
  minHeight = "150px" 
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  const applyFormat = (formatType: 'bold' | 'highlight' | 'quote' | 'uppercase') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    let formattedText = selectedText || 'text';
    let wrapper = { before: '', after: '' };
    
    switch (formatType) {
      case 'bold':
        wrapper = { before: '**', after: '**' };
        break;
      case 'highlight':
        wrapper = { before: '[', after: ']' };
        break;
      case 'quote':
        wrapper = { before: '"', after: '"' };
        break;
      case 'uppercase':
        wrapper = { before: '__', after: '__' };
        break;
    }
    
    const newText = value.substring(0, start) + wrapper.before + formattedText + wrapper.after + value.substring(end);
    onChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + wrapper.before.length + formattedText.length + wrapper.after.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <div className="space-y-3">
      {label && <Label>{label}</Label>}
      
      <div className="border rounded-lg overflow-hidden bg-background">
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/50 border-b">
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-3 hover:bg-background"
              onClick={() => applyFormat('bold')}
              title="Bold (wraps text with **)"
            >
              <Bold className="h-4 w-4 mr-1.5" />
              <span className="text-xs">Bold</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-3 hover:bg-background"
              onClick={() => applyFormat('highlight')}
              title="Highlight (wraps text with [])"
            >
              <Highlighter className="h-4 w-4 mr-1.5" />
              <span className="text-xs">Highlight</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-3 hover:bg-background"
              onClick={() => applyFormat('quote')}
              title="Quote (wraps text with quotes)"
            >
              <Quote className="h-4 w-4 mr-1.5" />
              <span className="text-xs">Quote</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-3 hover:bg-background"
              onClick={() => applyFormat('uppercase')}
              title="Uppercase (wraps text with __)"
            >
              <Type className="h-4 w-4 mr-1.5" />
              <span className="text-xs">Uppercase</span>
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs hover:bg-background"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </Button>
        </div>
        
        {showPreview ? (
          <div className="p-4 min-h-[150px] bg-muted/20">
            {value ? (
              <FormattedPreview content={value} />
            ) : (
              <p className="text-sm text-muted-foreground italic">No content to preview</p>
            )}
          </div>
        ) : (
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="border-0 rounded-none focus-visible:ring-0 resize-none"
            style={{ minHeight }}
          />
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Select text and use the formatting buttons above, or type <strong>**bold**</strong>, <span className="bg-primary/10 px-1 rounded">[highlight]</span>, <span className="italic">"quotes"</span>, or <span className="uppercase font-semibold">__uppercase__</span> manually
      </p>
    </div>
  );
}
