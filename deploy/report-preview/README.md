# OpenViking Studio report preview

In Studio, **Add Resource** keeps the uploaded original by default for HTML,
PDF, DOCX, PPTX and XLSX. Choose the destination before publishing. The original
inherits the permissions of that resource. Use a destination with the required
visibility. Uploads with **Keep original** use the destination's existing ACL.

Once the resource appears in the Filesystem, select its folder. **Download
original** returns the stored bytes. **Open report** opens the sandboxed HTML
preview when the preview site is configured. Writers can use **Retry import**
to process the stored original again. Re-importing refreshes the searchable
tree. An older import without original bytes needs the original file uploaded
again.

## Enable HTML preview

1. Choose a dedicated HTTPS site for the preview, separate from the Studio site.
   Do not share application cookies with it. Copy only [preview.html](preview.html)
   and [preview.js](preview.js) to the preview web root.
2. Add [the example host block](Caddyfile.example) to your Caddy configuration.
   Set OV_REPORT_PREVIEW_HOST to the preview hostname and OV_STUDIO_ORIGIN to
   the Studio page origin, including scheme and any non-default port.
3. Build Studio with VITE_OV_REPORT_PREVIEW_ORIGIN set to the preview origin.
   For the upstream Docker build, pass
   --build-arg VITE_OV_REPORT_PREVIEW_ORIGIN=https://your-preview-site.
   The setting is part of the Studio bundle. Changing it requires a rebuild.

For an isolated LAN smoke test, VITE_OV_REPORT_PREVIEW_ALLOW_HTTP=1 allows
Studio and the preview to run on different HTTP ports of the same hostname.
Use HTTPS for the team deployment.

Studio reads the file with the active member's credential. It sends only the
report text to the static preview site in the member's browser. The preview
site has no OpenViking API route or credentials. Inside it, an iframe runs
the inline script under an opaque origin. The preview removes external links,
resource hints and nested frames, and its content security policy blocks
external assets and ordinary requests. A browser-only preview does not
guarantee complete outbound network denial for arbitrary JavaScript. Keep the
attachment download separate when serving original bytes.

## Publish from an agent

Use the existing MCP add_resource tool to publish a local report. Set path to
the local file, keep_original to true, and parent to the appropriate team or
private resource directory. POST the original file as multipart form data to
the one-time upload URL returned by the tool. The upload response includes
root_uri for the searchable resource, original_uri for the exact file, and a
task ID. Use the task ID to confirm indexing. Teammates can open the root URI
in Studio. The existing MCP download tool also accepts the original URI.

Generate an HTML file with embedded data, CSS, and JavaScript. Use system
fonts or embed an appropriately licensed font. Charts may use native SVG or
a bundled library. Avoid external scripts, APIs and image links for content
that should appear in the preview. Ordinary citations remain in the original.
