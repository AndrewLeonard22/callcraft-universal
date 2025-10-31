import { useState, useRef } from "react";
import { Bold, Highlighter, Quote, Type, TextIcon, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      let matched = false;

      // Priority 1: Color formatting (most specific) - {red:text}
      const colorMatch = remaining.match(/\{(red|blue|green|yellow|purple|orange):([^}]+)\}/);
      if (colorMatch && colorMatch.index !== undefined) {
        if (colorMatch.index > 0) {
          parts.push(remaining.substring(0, colorMatch.index));
        }
        const colorClass = {
          red: 'text-red-600 dark:text-red-400',
          blue: 'text-blue-600 dark:text-blue-400',
          green: 'text-green-600 dark:text-green-400',
          yellow: 'text-yellow-600 dark:text-yellow-400',
          purple: 'text-purple-600 dark:text-purple-400',
          orange: 'text-orange-600 dark:text-orange-400',
        }[colorMatch[1]];
        parts.push(
          <span key={`color-${key++}`} className={`${colorClass} font-medium`}>
            {colorMatch[2]}
          </span>
        );
        remaining = remaining.substring(colorMatch.index + colorMatch[0].length);
        matched = true;
      }
      
      if (!matched) {
        // Priority 2: Large text - ^text^
        const largeMatch = remaining.match(/\^([^^]+)\^/);
        if (largeMatch && largeMatch.index !== undefined) {
          if (largeMatch.index > 0) {
            parts.push(remaining.substring(0, largeMatch.index));
          }
          parts.push(
            <span key={`large-${key++}`} className="text-lg font-semibold">
              {largeMatch[1]}
            </span>
          );
          remaining = remaining.substring(largeMatch.index + largeMatch[0].length);
          matched = true;
        }
      }
      
      if (!matched) {
        // Priority 3: Small text - ~text~
        const smallMatch = remaining.match(/~([^~]+)~/);
        if (smallMatch && smallMatch.index !== undefined) {
          if (smallMatch.index > 0) {
            parts.push(remaining.substring(0, smallMatch.index));
          }
          parts.push(
            <span key={`small-${key++}`} className="text-xs">
              {smallMatch[1]}
            </span>
          );
          remaining = remaining.substring(smallMatch.index + smallMatch[0].length);
          matched = true;
        }
      }
      
      if (!matched) {
        // Priority 4: Bracket highlights - [text]
        const bracketMatch = remaining.match(/\[([^\]]+)\]/);
        if (bracketMatch && bracketMatch.index !== undefined) {
          if (bracketMatch.index > 0) {
            parts.push(remaining.substring(0, bracketMatch.index));
          }
          parts.push(
            <span key={`bracket-${key++}`} className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 font-medium px-2 py-0.5 rounded">
              {bracketMatch[1]}
            </span>
          );
          remaining = remaining.substring(bracketMatch.index + bracketMatch[0].length);
          matched = true;
        }
      }
      
      if (!matched) {
        // Priority 5: Quote formatting - "text"
        const quoteMatch = remaining.match(/"([^"]+)"/);
        if (quoteMatch && quoteMatch.index !== undefined) {
          if (quoteMatch.index > 0) {
            parts.push(remaining.substring(0, quoteMatch.index));
          }
          parts.push(
            <span key={`quote-${key++}`} className="bg-blue-500/20 text-blue-700 dark:text-blue-400 font-medium px-1.5 rounded italic">
              "{quoteMatch[1]}"
            </span>
          );
          remaining = remaining.substring(quoteMatch.index + quoteMatch[0].length);
          matched = true;
        }
      }
      
      if (!matched) {
        // Priority 6: Bold with ** (must check before single *)
        const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
        if (boldMatch && boldMatch.index !== undefined) {
          if (boldMatch.index > 0) {
            parts.push(remaining.substring(0, boldMatch.index));
          }
          parts.push(
            <strong key={`bold-${key++}`} className="font-bold">
              {boldMatch[1]}
            </strong>
          );
          remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
          matched = true;
        }
      }
      
      if (!matched) {
        // Priority 7: Bold with __ (underscore)
        const underscoreMatch = remaining.match(/__([^_]+)__/);
        if (underscoreMatch && underscoreMatch.index !== undefined) {
          if (underscoreMatch.index > 0) {
            parts.push(remaining.substring(0, underscoreMatch.index));
          }
          parts.push(
            <strong key={`underscore-${key++}`} className="font-bold">
              {underscoreMatch[1]}
            </strong>
          );
          remaining = remaining.substring(underscoreMatch.index + underscoreMatch[0].length);
          matched = true;
        }
      }
      
      // If nothing matched, add the rest and break
      if (!matched) {
        parts.push(remaining);
        break;
      }
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
  const [selectedColor, setSelectedColor] = useState<string>('red');
  const [selectedSize, setSelectedSize] = useState<string>('normal');

  const applyFormat = (formatType: 'bold' | 'highlight' | 'quote' | 'boldalt' | 'size' | 'color') => {
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
      case 'boldalt':
        wrapper = { before: '__', after: '__' };
        break;
      case 'size':
        if (selectedSize === 'small') {
          wrapper = { before: '~', after: '~' };
        } else if (selectedSize === 'large') {
          wrapper = { before: '^', after: '^' };
        }
        break;
      case 'color':
        wrapper = { before: `{${selectedColor}:`, after: '}' };
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
        <div className="bg-muted/50 border-b">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => applyFormat('bold')}
                title="Bold (**text**)"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => applyFormat('boldalt')}
                title="Bold Alt (__text__)"
              >
                <Type className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => applyFormat('highlight')}
                title="Highlight ([text])"
              >
                <Highlighter className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => applyFormat('quote')}
                title='Quote ("text")'
              >
                <Quote className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="h-6 w-px bg-border" />
            
            <div className="flex items-center gap-1.5">
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger className="h-8 w-[90px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => applyFormat('size')}
                disabled={selectedSize === 'normal'}
              >
                Apply
              </Button>
            </div>
            
            <div className="h-6 w-px bg-border" />
            
            <div className="flex items-center gap-1.5">
              <Select value={selectedColor} onValueChange={setSelectedColor}>
                <SelectTrigger className="h-8 w-[90px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="red">Red</SelectItem>
                  <SelectItem value="blue">Blue</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="yellow">Yellow</SelectItem>
                  <SelectItem value="purple">Purple</SelectItem>
                  <SelectItem value="orange">Orange</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => applyFormat('color')}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
        
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="border-0 rounded-none focus-visible:ring-0 resize-none"
          style={{ minHeight }}
        />
        
        {value && (
          <div className="px-4 py-3 bg-muted/20 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Live Preview:</p>
            <FormattedPreview content={value} />
          </div>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Format: <strong>**bold**</strong> or <strong>__bold__</strong>, <span className="bg-yellow-500/20 px-1 rounded">[highlight]</span>, <span className="italic">"quotes"</span>, <span className="text-xs">~small~</span>, <span className="text-lg">^large^</span>, <span className="text-red-600">{`{red:text}`}</span>
      </p>
    </div>
  );
}
