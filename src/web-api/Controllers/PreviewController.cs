using AngleSharp.Html.Parser;
using Microsoft.AspNetCore.Mvc;

namespace TripWire.WebApi.Controllers;

[ApiController]
[Route("api/preview")]
public class PreviewController : ControllerBase
{
    private readonly IHttpClientFactory _httpFactory;

    public PreviewController(IHttpClientFactory httpFactory) => _httpFactory = httpFactory;

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string url, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(url))
            return ErrorPage("A url parameter is required.");
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return ErrorPage($"Not a valid http(s) url: {url}");

        string html;
        try
        {
            var client = _httpFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(30);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("TripWire/1.0 (+element picker)");
            html = await client.GetStringAsync(uri, ct);
        }
        catch (Exception ex)
        {
            return ErrorPage($"Failed to fetch {uri}: {ex.Message}");
        }

        var parser = new HtmlParser();
        var doc = parser.ParseDocument(html);

        // strip page scripts so they can't interfere with the picker
        foreach (var s in doc.QuerySelectorAll("script").ToArray()) s.Remove();
        // strip CSP meta — it would block our injected script + inline style
        foreach (var m in doc.QuerySelectorAll("meta[http-equiv]").ToArray())
        {
            var eq = m.GetAttribute("http-equiv");
            if (string.Equals(eq, "Content-Security-Policy", StringComparison.OrdinalIgnoreCase))
                m.Remove();
        }

        // <base href> so relative assets resolve to the original site
        var head = doc.Head;
        if (head != null)
        {
            foreach (var b in head.QuerySelectorAll("base").ToArray()) b.Remove();
            var baseEl = doc.CreateElement("base");
            baseEl.SetAttribute("href", uri.ToString());
            head.Prepend(baseEl);
        }

        // inject picker script
        var body = doc.Body;
        if (body != null)
        {
            var script = doc.CreateElement("script");
            script.TextContent = PickerScript;
            body.AppendChild(script);
        }

        Response.Headers["Cache-Control"] = "no-store";
        Response.Headers["Referrer-Policy"] = "no-referrer";
        return Content("<!doctype html>\n" + (doc.DocumentElement?.OuterHtml ?? ""),
            "text/html; charset=utf-8");
    }

    private ContentResult ErrorPage(string message)
    {
        var safe = System.Net.WebUtility.HtmlEncode(message);
        var html = $$"""
            <!doctype html><meta charset="utf-8">
            <style>
              body { margin:0; font:14px/1.5 system-ui,sans-serif; background:#0f0f14; color:#f0f0f4;
                     display:grid; place-items:center; height:100vh; padding:24px; }
              .box { max-width:520px; text-align:center; }
              .box h1 { font-size:16px; margin:0 0 8px; font-weight:600; }
              .box p { color:#a0a0ae; font-family:ui-monospace,Consolas,monospace; font-size:12px; word-break:break-all; }
              .dot { width:10px; height:10px; border-radius:50%; background:#ef4444; display:inline-block; margin-right:8px; }
            </style>
            <div class="box">
              <h1><span class="dot"></span>Preview failed</h1>
              <p>{{safe}}</p>
            </div>
            """;
        return Content(html, "text/html; charset=utf-8");
    }

    // Runs inside the previewed page's iframe. Highlights the element under the
    // cursor, computes a CSS selector, posts it to the parent on click.
    private const string PickerScript = """
        (() => {
          const OVERLAY_Z = 2147483647;
          const style = document.createElement('style');
          style.textContent = `
            .__tw-hover { outline: 2px dashed #a66bff !important; outline-offset: 2px !important; cursor: crosshair !important; }
            .__tw-banner {
              position: fixed; top: 0; left: 0; right: 0;
              padding: 10px 14px; z-index: ${OVERLAY_Z};
              font: 500 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
              background: linear-gradient(90deg, rgba(134,59,255,0.95), rgba(71,191,255,0.9));
              color: white; display: flex; gap: 10px; align-items: center;
              box-shadow: 0 6px 18px rgba(0,0,0,0.35); pointer-events: none;
              backdrop-filter: blur(8px);
            }
            .__tw-banner code {
              font: 500 12px/1.4 ui-monospace, 'JetBrains Mono', Consolas, monospace;
              background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 4px;
              max-width: 60vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }
            .__tw-banner .__tw-lbl { opacity: 0.8; }
            .__tw-banner .__tw-hint { margin-left: auto; opacity: 0.8; font-size: 12px; }
            html, body { cursor: crosshair !important; }
          `;
          document.documentElement.appendChild(style);

          const banner = document.createElement('div');
          banner.className = '__tw-banner';
          banner.innerHTML =
            '<span class="__tw-lbl">TripWire picker</span>' +
            '<code id="__tw-current">hover an element</code>' +
            '<span class="__tw-hint">click to capture · ESC to cancel</span>';
          document.body.appendChild(banner);

          let hovered = null;

          function isInternal(el) {
            return el && el.closest && el.closest('.__tw-banner');
          }

          function cssPath(el) {
            if (!el || el.nodeType !== 1) return '';
            if (el === document.body) return 'body';
            if (el === document.documentElement) return 'html';

            const parts = [];
            let current = el;
            while (current && current.nodeType === 1 && current !== document.documentElement) {
              let part = current.tagName.toLowerCase();

              if (current.id && /^[A-Za-z][\w-]*$/.test(current.id)) {
                parts.unshift('#' + current.id);
                break;
              }

              const stable = Array.from(current.classList || [])
                .filter(c => /^[A-Za-z][\w-]*$/.test(c))
                .filter(c => !/^(is-|has-|js-)/.test(c))
                .filter(c => c.length > 1 && c.length < 40)
                .slice(0, 2);
              if (stable.length) part += '.' + stable.join('.');

              const parent = current.parentElement;
              if (parent) {
                const sameTag = Array.from(parent.children).filter(c => c.tagName === current.tagName);
                if (sameTag.length > 1) {
                  const idx = sameTag.indexOf(current) + 1;
                  part += ':nth-of-type(' + idx + ')';
                }
              }

              parts.unshift(part);

              try {
                if (document.querySelectorAll(parts.join(' > ')).length === 1) break;
              } catch (_) { /* ignore selector errors */ }

              current = current.parentElement;
            }

            return parts.join(' > ');
          }

          function setHovered(el) {
            if (hovered === el) return;
            if (hovered) hovered.classList.remove('__tw-hover');
            hovered = el;
            if (el) el.classList.add('__tw-hover');
            const cur = document.getElementById('__tw-current');
            if (cur) cur.textContent = el ? cssPath(el) : 'hover an element';
          }

          document.addEventListener('mouseover', (e) => {
            if (isInternal(e.target)) return;
            setHovered(e.target);
          }, true);

          document.addEventListener('mouseout', (e) => {
            if (e.target && e.target.classList) e.target.classList.remove('__tw-hover');
          }, true);

          document.addEventListener('click', (e) => {
            if (isInternal(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const selector = cssPath(e.target);
            const text = (e.target.textContent || '').trim().slice(0, 120);
            try {
              window.parent.postMessage({ type: 'tripwire:picked', selector, text }, '*');
            } catch (_) {}
          }, true);

          document.addEventListener('submit', (e) => e.preventDefault(), true);

          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              try { window.parent.postMessage({ type: 'tripwire:cancel' }, '*'); } catch (_) {}
            }
          }, true);

          try { window.parent.postMessage({ type: 'tripwire:ready' }, '*'); } catch (_) {}
        })();
        """;
}
