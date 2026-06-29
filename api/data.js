// 超能游学报价系统 V7 长期稳定云端版
// 浏览器只访问本项目 /api/data；Supabase 密钥只保存在 Vercel 环境变量里。

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_KEY;

const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "super_study_data";
const SUPABASE_ROW = process.env.SUPABASE_ROW || "main";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return json(res, 500, {
        error: "Vercel 环境变量未设置：SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY"
      });
    }

    const base = SUPABASE_URL.replace(/\/+$/, "");
    const table = encodeURIComponent(SUPABASE_TABLE);

    const headers = {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    };

    if (req.method === "GET") {
      const url = `${base}/rest/v1/${table}?id=eq.${encodeURIComponent(SUPABASE_ROW)}&select=payload,updated_at`;
      const r = await fetch(url, {
        method: "GET",
        headers: { ...headers, "Accept": "application/json" }
      });
      const text = await r.text();
      if (!r.ok) return json(res, r.status, { error: text });
      const rows = JSON.parse(text || "[]");
      return json(res, 200, rows[0] || {});
    }

    if (req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};
      if (!body.payload) return json(res, 400, { error: "缺少 payload" });

      const url = `${base}/rest/v1/${table}`;
      const payload = {
        id: SUPABASE_ROW,
        payload: body.payload,
        updated_at: new Date().toISOString()
      };

      const r = await fetch(url, {
        method: "POST",
        headers: {
          ...headers,
          "Prefer": "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify(payload)
      });
      const text = await r.text();
      if (!r.ok) return json(res, r.status, { error: text });
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return json(res, 500, { error: err.message || String(err) });
  }
};
