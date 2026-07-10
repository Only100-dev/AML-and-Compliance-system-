import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IC-OS Preview',
};

/**
 * Solution 2: Dedicated Preview Route
 *
 * This route serves as an iframe-friendly entry point for the preview panel.
 * Unlike the root page, this route has relaxed security headers (configured in
 * next.config.ts) that allow embedding from space-z.ai and localhost origins.
 *
 * The preview panel can point to:
 *   /preview              → Full app with relaxed headers
 *   /?_vercel_bypass=...  → Bypass protection with token
 */
export default function PreviewPage() {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('icos-storage');
                  if (stored) {
                    var parsed = JSON.parse(stored);
                    if (parsed && parsed.state && parsed.state.theme) {
                      document.documentElement.setAttribute('data-theme', parsed.state.theme);
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Full-page iframe pointing to the main app */}
        <iframe
          src="/?_preview=true"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          title="IC-OS App Preview"
          allow="clipboard-read; clipboard-write"
        />
      </body>
    </html>
  );
}
