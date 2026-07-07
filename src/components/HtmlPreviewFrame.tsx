import { useEffect, useRef, useState } from "react";

interface HtmlPreviewFrameProps {
  html: string;
  className?: string;
}

// Renders raw HTML inside an isolated iframe to prevent app CSS from altering layout
function HtmlPreviewFrame({ html, className }: HtmlPreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(0);
  const previousHtmlRef = useRef<string>("");
  const resizeTimeoutRef = useRef<number | null>(null);
  const isScrollingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const currentHeightRef = useRef<number>(0);

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
    doc.write(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>
/* Teleprompter v2 (Dash): structure-aware. decorate() tags .lbl/.rule/.say —
   the PARAGRAPH is the say-card (multi-mark sentences = ONE card, no mid-line
   bars); rules sit smaller+muted; labels are small-caps captions. */
html,body{margin:0;padding:0;overflow-x:hidden;font-family:Inter,system-ui,-apple-system,sans-serif;font-size:14.5px;line-height:1.7;color:#3f4354;-webkit-font-smoothing:antialiased;}
img{max-width:100%;height:auto;display:block;}
ol,ul{list-style:none;margin:0 0 1.1em;padding:0;}
li{margin:0 0 .45em;}
p{margin:0 0 .85em;}
h1,h2,h3{font-size:12.5px!important;font-weight:700!important;letter-spacing:.07em;text-transform:uppercase;color:#8a90a3!important;margin:2.4em 0 1em;padding-top:1.5em;border-top:1px solid #eceef3;}
h1 *,h2 *,h3 *{font-size:inherit!important;font-weight:inherit!important;color:inherit!important;}
h1:first-child,h2:first-child,h3:first-child{margin-top:0;padding-top:0;border-top:none;}
strong{font-weight:650;color:#15192a;}
em{color:#8a90a3;}
hr{border:none;border-top:1px solid #eceef3;margin:1.5em 0;}
a{text-decoration:none;color:inherit;pointer-events:none;cursor:default;}
mark{background:transparent!important;color:inherit;padding:0;font-weight:inherit;}
.lbl,.lbl *{font-size:11px!important;font-weight:700!important;letter-spacing:.09em;text-transform:uppercase;color:#9aa0b4!important;}
.lbl{margin:1.6em 0 .7em;}
.rule,.rule span{font-size:13px!important;line-height:1.65!important;color:#6f7488!important;}
.rule strong,.rule b{color:#3f4354!important;font-weight:650!important;}
.say{background:#eef4ff;border-left:3px solid #2f6bff;border-radius:10px;padding:12px 16px;margin:.3em 0 .9em;}
.say,.say *{font-size:16.5px!important;font-weight:500!important;line-height:1.6!important;color:#101828!important;}
</style></head><body style="margin:0;">
      <div id="content">${html.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")}</div>
      <script>
        (function decorate(){
          const c = document.getElementById('content');
          if (!c) return;
          let mode = null;
          for (const el of Array.from(c.querySelectorAll(':scope > *'))) {
            const tag = el.tagName;
            if (/^H[1-4]$/.test(tag)) { mode = null; continue; }
            const txt = (el.textContent || '').trim().toUpperCase();
            if (/^RULES\b/.test(txt) && txt.length < 40) { el.classList.add('lbl'); mode = 'rules'; continue; }
            if (/^SCRIPT\b/.test(txt) && txt.length < 60) { el.classList.add('lbl'); mode = 'script'; continue; }
            if (el.querySelector && el.querySelector('mark')) { el.classList.add('say'); continue; }
            if (mode === 'rules') el.classList.add('rule');
          }
        })();
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
            const docEl = document.documentElement;
            const body = document.body;
            const el = document.getElementById('content');
            let h = 0;
            if (el) {
              h = Math.max(el.scrollHeight, el.offsetHeight, el.clientHeight);
            }
            h = Math.max(h, body.scrollHeight, body.offsetHeight, docEl.scrollHeight, docEl.offsetHeight);
            h = Math.ceil(h);
            // Optimized: Only send if height changed significantly (more than 10px for less frequent updates)
            if (Math.abs(h - lastHeight) > 10) {
              lastHeight = h;
              parent.postMessage({ type: 'HTML_FRAME_RESIZE', h }, '*'); 
            }
          }, 250);
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
      // Ensure message is from our iframe
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data && e.data.type === 'HTML_FRAME_RESIZE' && typeof e.data.h === 'number') {
        // Don't update height while scrolling
        if (isScrollingRef.current) return;
        
        const newH = e.data.h as number;
        // Optimized: Ignore if height unchanged to avoid layout thrash (increased threshold)
        if (Math.abs(newH - currentHeightRef.current) <= 5) return;
        
        // Debounce height updates to prevent excessive re-renders
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = window.setTimeout(() => {
          currentHeightRef.current = newH;
          setHeight(newH);
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

export default HtmlPreviewFrame;
