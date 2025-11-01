import { useEffect } from "react";
import { Bold, Highlighter, Quote } from "lucide-react";
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

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  minHeight?: string;
}

// Convert HTML to plain text with formatting markers for backward compatibility
const htmlToMarkers = (html: string): string => {
  let text = html;
  
  // Convert bold tags
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  
  // Convert highlights
  text = text.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '[$1]');
  
  // Convert colors
  text = text.replace(/<span[^>]*style="[^"]*color:\s*rgb\(220,\s*38,\s*38\)[^"]*"[^>]*>(.*?)<\/span>/gi, '{red:$1}');
  text = text.replace(/<span[^>]*style="[^"]*color:\s*rgb\(37,\s*99,\s*235\)[^"]*"[^>]*>(.*?)<\/span>/gi, '{blue:$1}');
  text = text.replace(/<span[^>]*style="[^"]*color:\s*rgb\(22,\s*163,\s*74\)[^"]*"[^>]*>(.*?)<\/span>/gi, '{green:$1}');
  text = text.replace(/<span[^>]*style="[^"]*color:\s*rgb\(202,\s*138,\s*4\)[^"]*"[^>]*>(.*?)<\/span>/gi, '{yellow:$1}');
  text = text.replace(/<span[^>]*style="[^"]*color:\s*rgb\(168,\s*85,\s*247\)[^"]*"[^>]*>(.*?)<\/span>/gi, '{purple:$1}');
  text = text.replace(/<span[^>]*style="[^"]*color:\s*rgb\(249,\s*115,\s*22\)[^"]*"[^>]*>(.*?)<\/span>/gi, '{orange:$1}');
  
  // Convert quotes (italic)
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '"$1"');
  text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, '"$1"');
  
  // Remove paragraphs and breaks
  text = text.replace(/<\/p><p[^>]*>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<p[^>]*>/gi, '');
  text = text.replace(/<\/p>/gi, '');
  
  // Remove any remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  
  return text;
};

// Convert plain text with markers to HTML for editor
const markersToHtml = (text: string): string => {
  let html = text;
  
  // Convert bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // Convert highlights
  html = html.replace(/\[([^\]]+)\]/g, '<mark>$1</mark>');
  
  // Convert quotes
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
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: markersToHtml(value),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const plainText = htmlToMarkers(html);
      onChange(plainText);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none px-4 py-3',
        style: `min-height: ${minHeight}`,
      },
    },
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && value !== htmlToMarkers(editor.getHTML())) {
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
                value="none"
                onValueChange={(color) => {
                  if (color === 'none') {
                    editor.chain().focus().unsetColor().run();
                  } else {
                    editor.chain().focus().setColor(colorMap[color]).run();
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[90px] text-xs">
                  <SelectValue placeholder="Color" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="none">Default</SelectItem>
                  <SelectItem value="red">
                    <span style={{ color: colorMap.red }}>Red</span>
                  </SelectItem>
                  <SelectItem value="blue">
                    <span style={{ color: colorMap.blue }}>Blue</span>
                  </SelectItem>
                  <SelectItem value="green">
                    <span style={{ color: colorMap.green }}>Green</span>
                  </SelectItem>
                  <SelectItem value="yellow">
                    <span style={{ color: colorMap.yellow }}>Yellow</span>
                  </SelectItem>
                  <SelectItem value="purple">
                    <span style={{ color: colorMap.purple }}>Purple</span>
                  </SelectItem>
                  <SelectItem value="orange">
                    <span style={{ color: colorMap.orange }}>Orange</span>
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
