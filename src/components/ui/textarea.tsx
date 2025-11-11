import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      
      // Insert tab character at cursor position
      target.value = value.substring(0, start) + '\t' + value.substring(end);
      
      // Move cursor after the inserted tab
      target.selectionStart = target.selectionEnd = start + 1;
      
      // Trigger onChange event
      const event = new Event('input', { bubbles: true });
      target.dispatchEvent(event);
    }
    
    // Call the original onKeyDown if it exists
    props.onKeyDown?.(e);
  };

  return (
    <textarea
      className={cn(
        "flex min-h-[100px] w-full rounded-lg border border-input bg-background px-4 py-3 text-sm shadow-sm transition-all ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
      onKeyDown={handleKeyDown}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
