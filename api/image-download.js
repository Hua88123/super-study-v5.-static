export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Method Not Allowed");
      return;
    }

    let body = req.body || {};

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = Object.fromEntries(new URLSearchParams(body));
      }
    }

    // 部分运行环境可能没有自动解析 body，这里做兜底
    if (!body || (!body.dataUrl && !body.image)) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        body = JSON.parse(raw);
      } catch (e) {
        body = Object.fromEntries(new URLSearchParams(raw));
      }
    }

    const dataUrl = String(body.dataUrl || body.image || "");
    const filename = String(body.filename || "quote.png")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "_")
      .slice(0, 120) || "quote.png";

    const m = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Invalid PNG data");
      return;
    }

    const buf = Buffer.from(m[1], "base64");

    // 防止异常超大请求
    if (!buf.length || buf.length > 8 * 1024 * 1024) {
      res.statusCode = 413;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Image too large");
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "image/png");
    // inline：手机打开后就是一张真正的网络 PNG 图片，可以长按保存
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Content-Length", String(buf.length));
    res.end(buf);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Image export failed: " + (err && err.message ? err.message : String(err)));
  }
}
