export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Method Not Allowed");
      return;
    }

    let raw = "";
    for await (const chunk of req) raw += chunk.toString("utf8");

    let body = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch (e) {
      body = Object.fromEntries(new URLSearchParams(raw));
    }

    const dataUrl = String(body.dataUrl || body.image || "");
    const filename = String(body.filename || "quote-mobile.jpg")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "_")
      .slice(0, 120) || "quote-mobile.jpg";

    const m = dataUrl.match(/^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Invalid image data");
      return;
    }

    const ext = m[1].toLowerCase() === "png" ? "png" : "jpeg";
    const buf = Buffer.from(m[2], "base64");

    if (!buf.length || buf.length > 3 * 1024 * 1024) {
      res.statusCode = 413;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Image too large, please generate a smaller mobile image.");
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", ext === "png" ? "image/png" : "image/jpeg");
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Content-Length", String(buf.length));
    res.end(buf);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Mobile image export failed: " + (err && err.message ? err.message : String(err)));
  }
}
