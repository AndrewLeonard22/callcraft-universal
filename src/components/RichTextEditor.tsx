import { useEffect } from "react";
import { Bold, Highlighter, Quote, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Extension } from '@tiptap/core';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  minHeight?: string;
}

// Custom FontSize extension
const FontSize = Extension.create({
  name: 'fontSize',
  
  addOptions() {
    return {
      types: ['textStyle'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize || null,
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {}
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run()
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run()
      },
    }
  },
})

// Convert HTML to plain text with formatting markers for backward compatibility
const htmlToMarkers = (html: string): string => {
  // No longer needed - we store HTML directly
  return html;
};

// Convert plain text with markers to HTML for editor (backward compatibility)
const markersToHtml = (text: string): string => {
  // If it already looks like HTML, return as is
  if (text.includes('<p>') || text.includes('<span') || text.includes('<strong>') || text.includes('<mark>')) {
    return text;
  }
  
  let html = text;
  
  // Convert font sizes
  html = html.replace(/\{small:([^}]+)\}/g, '<span style="font-size: 0.875rem">$1</span>');
  html = html.replace(/\{large:([^}]+)\}/g, '<span style="font-size: 1.25rem">$1</span>');
  
  // Convert bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // Convert highlights
  html = html.replace(/\[([^\]]+)\]/g, '<mark>$1</mark>');
  
  // Convert quotes (italic)
  html = html.replace(/"([^"]+)"/g, '<em>$1</em>');
  
  // Convert colors
  html = html.replace(/\{red:([^}]+)\}/g, '<span style="color: rgb(220, 38, 38)">$1</span>');
  html = html.replace(/\{blue:([^}]+)\}/g, '<span style="color: rgb(37, 99, 235)">$1</span>');
  html = html.replace(/\{green:([^}]+)\}/g, '<span style="color: rgb(22, 163, 74)">$1</span>');
  html = html.replace(/\{yellow:([^}]+)\}/g, '<span style="color: rgb(202, 138, 4)">$1</span>');
  html = html.replace(/\{purple:([^}]+)\}/g, '<span style="color: rgb(168, 85, 247)">$1</span>');
  html = html.replace(/\{orange:([^}]+)\}/g, '<span style="color: rgb(249, 115, 22)">$1</span>');
  
  // Convert line breaks to paragraphs
  const lines = html.split('\n');
  html = lines.map(line => line.trim() ? `<p>${line}</p>` : '<p></p>').join('');
  
  return html;
};

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Enter your text...", 
  label,
  minHeight = "150px" 
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bold: {
          HTMLAttributes: {
            class: '',
          },
        },
      }),
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: markersToHtml(value),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Store HTML directly instead of converting to markers
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'max-w-none focus:outline-none px-4 py-3',
        style: `min-height: ${minHeight}`,
      },
    },
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      const html = markersToHtml(value);
      editor.commands.setContent(html);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const colorMap: Record<string, string> = {
    red: 'rgb(220, 38, 38)',
    blue: 'rgb(37, 99, 235)',
    green: 'rgb(22, 163, 74)',
    yellow: 'rgb(202, 138, 4)',
    purple: 'rgb(168, 85, 247)',
    orange: 'rgb(249, 115, 22)',
  };

  // Get current color if any
  const getCurrentColor = () => {
    const currentColor = editor.getAttributes('textStyle').color;
    if (!currentColor) return 'default';
    
    // Find matching color name from RGB value
    for (const [name, rgb] of Object.entries(colorMap)) {
      if (rgb === currentColor) return name;
    }
    return 'default';
  };

  const getCurrentFontSize = () => {
    const fontSize = editor.getAttributes('textStyle').fontSize;
    if (fontSize === '0.875rem') return 'small';
    if (fontSize === '1.25rem') return 'large';
    return 'normal';
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
                variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2"
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Bold"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={editor.isActive('highlight') ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2"
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                title="Highlight"
              >
                <Highlighter className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Italic (Quote style)"
              >
                <Quote className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="h-6 w-px bg-border" />
            
            <div className="flex items-center gap-1.5">
              <Select 
                value={getCurrentFontSize()}
                onValueChange={(size) => {
                  if (size === 'normal') {
                    editor.chain().focus().unsetFontSize().run();
                  } else if (size === 'small') {
                    editor.chain().focus().setFontSize('0.875rem').run();
                  } else if (size === 'large') {
                    editor.chain().focus().setFontSize('1.25rem').run();
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[100px] text-xs">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="small">
                    <span className="text-xs">Small</span>
                  </SelectItem>
                  <SelectItem value="normal">
                    <span className="text-sm">Normal</span>
                  </SelectItem>
                  <SelectItem value="large">
                    <span className="text-lg">Large</span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={getCurrentColor()}
                onValueChange={(color) => {
                  if (color === 'default') {
                    editor.chain().focus().unsetColor().run();
                  } else {
                    editor.chain().focus().setColor(colorMap[color]).run();
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[100px] text-xs">
                  <SelectValue placeholder="Color" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="default">
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded border border-border bg-background"></span>
                      Default
                    </span>
                  </SelectItem>
                  <SelectItem value="red">
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded" style={{ backgroundColor: colorMap.red }}></span>
                      <span style={{ color: colorMap.red }}>Red</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="blue">
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded" style={{ backgroundColor: colorMap.blue }}></span>
                      <span style={{ color: colorMap.blue }}>Blue</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="green">
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded" style={{ backgroundColor: colorMap.green }}></span>
                      <span style={{ color: colorMap.green }}>Green</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="yellow">
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded" style={{ backgroundColor: colorMap.yellow }}></span>
                      <span style={{ color: colorMap.yellow }}>Yellow</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="purple">
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded" style={{ backgroundColor: colorMap.purple }}></span>
                      <span style={{ color: colorMap.purple }}>Purple</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="orange">
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded" style={{ backgroundColor: colorMap.orange }}></span>
                      <span style={{ color: colorMap.orange }}>Orange</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        <EditorContent editor={editor} className="bg-background" />
      </div>
      
      <p className="text-xs text-muted-foreground">
        Use the toolbar buttons to format text. Keyboard shortcuts: <strong>Ctrl+B</strong> for bold, <strong>Ctrl+I</strong> for italic
      </p>
    </div>
  );
}
