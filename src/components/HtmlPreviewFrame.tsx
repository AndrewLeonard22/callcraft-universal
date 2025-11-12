import { useEffect, useRef, useState } from "react";

interface HtmlPreviewFrameProps {
  html: string;
  className?: string;
}

// Renders raw HTML inside an isolated iframe to prevent app CSS from altering layout
export default function HtmlPreviewFrame({ html, className }: HtmlPreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(0);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    // Write a minimal HTML document; do NOT inject app styles
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>ol,ul{list-style:none;margin:0;padding:0;}</style></head><body style="margin:0;">
      <div id="content">${html}</div>
      <script>window.addEventListener('load', function(){
        const resize=()=>{const el=document.getElementById('content'); if(el){ const h = el.scrollHeight; parent.postMessage({ type:'HTML_FRAME_RESIZE', h }, '*'); }};
        resize(); new ResizeObserver(resize).observe(document.body);
      });<\/script>
    </body></html>`);
    doc.close();
  }, [html]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'HTML_FRAME_RESIZE' && typeof e.data.h === 'number') {
        setHeight(e.data.h);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
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
