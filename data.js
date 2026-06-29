// 超能游学报价系统 V7 云端连接诊断修复版
const https = require("https");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SUPABASE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_KEY ||
  ""
).trim();

const SUPABASE_TABLE = (process.env.SUPABASE_TABLE || "super_study_data").trim();
const SUPABASE_ROW = (process.env.SUPABASE_ROW || "main").trim();

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function maskKey(key) {
  if (!key) return "";
  if (key.length <= 12) return key[0] + "***";
  return key.slice(0, 8) + "..." + key.slice(-6);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    if (!SUPABASE_URL) return reject(new Error("缺少 SUPABASE_URL"));
    if (!SUPABASE_KEY) return reject(new Error("缺少 SUPABASE_SERVICE_ROLE_KEY"));

    let base;
    try {
      base = new URL(SUPABASE_URL);
    } catch (err) {
      return reject(new Error("SUPABASE_URL 格式错误：" + SUPABASE_URL));
    }

    const payload = body ? JSON.stringify(body) : null;
    const options = {
      protocol: base.protocol,
      hostname: base.hostname,
      port: base.port || 443,
      path,
      method,
      timeout: 15000,
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(payload ? {"Content-Length": Buffer.byteLength(payload)} : {})
      }
    };

    const req = https.request(options, (r) => {
      const chunks = [];
      r.on("data", c => chunks.push(c));
      r.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({status: r.statusCode, ok: r.statusCode >= 200 && r.statusCode < 300, text});
      });
    });

    req.on("timeout", () => req.destroy(new Error("连接 Supabase 超时")));
    req.on("error", reject);

    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  try {
    const debug = req.url && req.url.includes("debug=1");

    if (debug) {
      const result = {
        ok: false,
        env: {
          SUPABASE_URL_present: !!SUPABASE_URL,
          SUPABASE_URL_value: SUPABASE_URL || null,
          SUPABASE_KEY_present: !!SUPABASE_KEY,
          SUPABASE_KEY_masked: maskKey(SUPABASE_KEY),
          SUPABASE_TABLE,
          SUPABASE_ROW,
          node: process.version
        }
      };

      if (!SUPABASE_URL || !SUPABASE_KEY) {
        result.error = "Vercel 环境变量缺失";
        return json(res, 200, result);
      }

      try {
        const table = encodeURIComponent(SUPABASE_TABLE);
        const row = encodeURIComponent(SUPABASE_ROW);
        const path = `/rest/v1/${table}?id=eq.${row}&select=payload,updated_at`;
        const r = await supabaseRequest("GET", path);
        result.ok = r.ok;
        result.supabase_status = r.status;
        result.supabase_response_preview = r.text.slice(0, 500);
        return json(res, 200, result);
      } catch (err) {
        result.ok = false;
        result.error = err.message || String(err);
        result.code = err.code || null;
        result.name = err.name || null;
        return json(res, 200, result);
      }
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return json(res, 500, {error: "Vercel 环境变量未设置：SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY"});
    }

    const table = encodeURIComponent(SUPABASE_TABLE);
    const row = encodeURIComponent(SUPABASE_ROW);

    if (req.method === "GET") {
      const path = `/rest/v1/${table}?id=eq.${row}&select=payload,updated_at`;
      const r = await supabaseRequest("GET", path);
      if (!r.ok) return json(res, r.status, {error: r.text});
      const rows = JSON.parse(r.text || "[]");
      return json(res, 200, rows[0] || {});
    }

    if (req.method === "POST") {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      if (!body.payload) return json(res, 400, {error: "缺少 payload"});

      const path = `/rest/v1/${table}`;
      const payload = {id: SUPABASE_ROW, payload: body.payload, updated_at: new Date().toISOString()};
      const r = await supabaseRequest("POST", path, payload);
      if (!r.ok) return json(res, r.status, {error: r.text});
      return json(res, 200, {ok: true});
    }

    return json(res, 405, {error: "Method not allowed"});
  } catch (err) {
    return json(res, 500, {error: err.message || String(err), code: err.code || null, name: err.name || null});
  }
};
