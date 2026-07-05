export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
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

    let dataUrl = body.dataUrl || body.image || "";
    let filename = String(body.filename || "报价单.png").replace(/[<>"'&]/g, "");

    if (!/^data:image\/png;base64,/.test(dataUrl)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end("图片数据无效，请返回报价系统重新生成。");
      return;
    }

    // Vercel/移动端保存专用页面：真实 http 页面 + img 标签，手机长按最稳定
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes">
<title>${filename}</title>
<style>
  html,body{margin:0;padding:0;background:#111;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",Arial,sans-serif;}
  .bar{position:sticky;top:0;z-index:10;background:rgba(0,0,0,.88);padding:10px 12px;font-size:14px;line-height:1.5;}
  .bar b{color:#ffd34d;}
  .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;}
  .btn{display:inline-flex;align-items:center;justify-content:center;min-height:36px;border-radius:10px;background:#fff;color:#111;text-decoration:none;font-weight:800;padding:0 12px;border:0;}
  .wrap{padding:0;margin:0;text-align:center;}
  img{display:block;width:100%;height:auto;margin:0 auto;background:#fff;-webkit-touch-callout:default;-webkit-user-select:auto;user-select:auto;touch-action:auto;}
  .tip{padding:12px;color:#ddd;font-size:13px;line-height:1.6;text-align:left;}
</style>
</head>
<body>
  <div class="bar">
    <b>保存方法：</b>长按下方报价图 → 保存图片/添加到照片。保存后点浏览器返回。
    <div class="actions">
      <a class="btn" href="${dataUrl}" download="${filename}">下载图片</a>
      <button class="btn" onclick="history.back()">返回报价系统</button>
    </div>
  </div>
  <div class="wrap">
    <img src="${dataUrl}" alt="${filename}">
  </div>
  <div class="tip">
    如果微信/浏览器没有出现“保存图片”，请点右上角菜单，用系统浏览器打开后再长按保存。
  </div>
</body>
</html>`);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end("生成保存页失败：" + (err && err.message ? err.message : String(err)));
  }
}
