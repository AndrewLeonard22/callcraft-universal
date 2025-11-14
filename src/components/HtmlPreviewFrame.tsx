import { useEffect, useRef, useState } from "react";

interface HtmlPreviewFrameProps {
  html: string;
  className?: string;
}

// Renders raw HTML inside an isolated iframe to prevent app CSS from altering layout
export default function HtmlPreviewFrame({ html, className }: HtmlPreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(0);
  const previousHtmlRef = useRef<string>("");
  const resizeTimeoutRef = useRef<number | null>(null);
  const isScrollingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Only update iframe if HTML actually changed
    if (previousHtmlRef.current === html) return;
    previousHtmlRef.current = html;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    // Write a minimal HTML document; do NOT inject app styles
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>ol,ul{list-style:none;margin:0;padding:0;}</style></head><body style="margin:0;">
      <div id="content">${html}</div>
      <script>
        let lastHeight = 0;
        let resizeTimer;
        let isScrolling = false;
        let scrollTimer;
        
        // Detect scrolling
        window.addEventListener('scroll', function() {
          isScrolling = true;
          clearTimeout(scrollTimer);
          scrollTimer = setTimeout(() => {
            isScrolling = false;
          }, 150);
        }, true);
        
        const resize = () => {
          // Don't resize while scrolling
          if (isScrolling) return;
          
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            const el = document.getElementById('content'); 
            if (el) { 
              const h = el.scrollHeight;
              // Only send if height changed significantly (more than 5px)
              if (Math.abs(h - lastHeight) > 5) {
                lastHeight = h;
                parent.postMessage({ type: 'HTML_FRAME_RESIZE', h }, '*'); 
              }
            }
          }, 200);
        };
        
        window.addEventListener('load', function() {
          resize(); 
          new ResizeObserver(resize).observe(document.body);
        });
      <\/script>
    </body></html>`);
    doc.close();
  }, [html]);

  useEffect(() => {
    const handleScroll = () => {
      isScrollingRef.current = true;
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        isScrollingRef.current = false;
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, true);

    const onMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'HTML_FRAME_RESIZE' && typeof e.data.h === 'number') {
        // Don't update height while scrolling
        if (isScrollingRef.current) return;
        
        // Debounce height updates to prevent excessive re-renders
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = window.setTimeout(() => {
          setHeight(e.data.h);
        }, 100);
      }
    };
    
    window.addEventListener('message', onMessage);
    
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('message', onMessage);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      className={className}
      style={{ width: '100%', border: 'none', height: height > 0 ? height : 600, minHeight: 600 }}
      sandbox="allow-same-origin allow-scripts"
      title="html-preview"
    />
  );
}
