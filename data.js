
const https = require("https");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SUPABASE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_KEY ||
  ""
).trim();
const DATA_TABLE = process.env.SUPABASE_TABLE || "super_study_data";
const DATA_ROW = process.env.SUPABASE_ROW || "main";
const EMP_TABLE = process.env.SUPABASE_EMPLOYEE_TABLE || "super_study_employees";
const AGENT_TABLE = process.env.SUPABASE_AGENT_TABLE || "super_study_agents";
const AGENT_DEVICE_TABLE = process.env.SUPABASE_AGENT_DEVICE_TABLE || "super_study_agent_devices";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "SuperStudy888";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sbRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    if (!SUPABASE_URL) return reject(new Error("缺少 SUPABASE_URL"));
    if (!SUPABASE_KEY) return reject(new Error("缺少 SUPABASE_SERVICE_ROLE_KEY"));
    let base;
    try { base = new URL(SUPABASE_URL); } catch(e){ return reject(new Error("SUPABASE_URL 格式错误")); }
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
        "Prefer": "resolution=merge-duplicates,return=minimal",
        ...(payload ? {"Content-Length": Buffer.byteLength(payload)} : {})
      }
    };
    const rq = https.request(options, r => {
      const chunks=[];
      r.on("data", c=>chunks.push(c));
      r.on("end", ()=>resolve({status:r.statusCode, ok:r.statusCode>=200&&r.statusCode<300, text:Buffer.concat(chunks).toString("utf8")}));
    });
    rq.on("timeout", ()=>rq.destroy(new Error("连接 Supabase 超时")));
    rq.on("error", reject);
    if(payload) rq.write(payload);
    rq.end();
  });
}

function isAdmin(req){
  return (req.headers["x-admin-password"] || "") === ADMIN_PASSWORD;
}
async function getEmployee(id){
  const path=`/rest/v1/${encodeURIComponent(EMP_TABLE)}?id=eq.${encodeURIComponent(id)}&select=*`;
  const r=await sbRequest("GET",path);
  if(!r.ok) throw new Error(r.text);
  return (JSON.parse(r.text||"[]"))[0] || null;
}
async function employeeValid(req){
  const id=req.headers["x-employee-id"];
  const device=req.headers["x-device-id"];
  if(!id||!device) return false;
  const e=await getEmployee(id);
  return !!(e && e.is_active && e.bound_device_id === device);
}
async function getAgent(id){
  const path=`/rest/v1/${encodeURIComponent(AGENT_TABLE)}?id=eq.${encodeURIComponent(id)}&select=*`;
  const r=await sbRequest("GET",path);
  if(!r.ok) throw new Error(r.text);
  return (JSON.parse(r.text||"[]"))[0] || null;
}
function agentSafe(a){
  if(!a) return null;
  return {id:a.id,slug:a.slug||a.id,name:a.name,brandName:a.brand_name,brandEn:a.brand_en,watermarkText:a.watermark_text,quoteSlogan:a.quote_slogan,discountLabel:a.discount_label,waiverLabel:a.waiver_label,discountRemark:a.discount_remark,brandLogo:a.logo_data};
}
function notExpired(a){
  return !a.expires_at || String(a.expires_at).slice(0,10) >= new Date().toISOString().slice(0,10);
}
async function agentValid(req){
  const id=req.headers["x-agent-id"];
  const device=req.headers["x-device-id"];
  if(!id||!device) return false;
  const a=await getAgent(id);
  if(!a || !a.is_active || !notExpired(a)) return false;
  const p=`/rest/v1/${encodeURIComponent(AGENT_DEVICE_TABLE)}?agent_id=eq.${encodeURIComponent(id)}&device_id=eq.${encodeURIComponent(device)}&select=*`;
  const r=await sbRequest("GET",p);
  if(!r.ok) return false;
  return (JSON.parse(r.text||"[]")).length>0;
}
function maskKey(key){return !key?"":(key.slice(0,8)+"..."+key.slice(-6))}
function makeId(prefix){return prefix+"_"+Date.now()+"_"+Math.random().toString(36).slice(2,8)}

module.exports = async function handler(req, res) {
  try {
    const debug = req.url && req.url.includes("debug=1");
    if (debug) {
      let result = {
        ok: false,
        env: {
          SUPABASE_URL_present: !!SUPABASE_URL,
          SUPABASE_URL_value: SUPABASE_URL || null,
          SUPABASE_KEY_present: !!SUPABASE_KEY,
          SUPABASE_KEY_masked: maskKey(SUPABASE_KEY),
          SUPABASE_TABLE: DATA_TABLE,
          SUPABASE_ROW: DATA_ROW,
          node: process.version
        }
      };
      try {
        const path = `/rest/v1/${encodeURIComponent(DATA_TABLE)}?id=eq.${encodeURIComponent(DATA_ROW)}&select=payload,updated_at`;
        const r = await sbRequest("GET", path);
        result.ok = r.ok;
        result.supabase_status = r.status;
        result.supabase_response_preview = r.text.slice(0,500);
      } catch(err) {
        result.error = err.message || String(err);
        result.code = err.code || null;
      }
      return json(res,200,result);
    }

    const admin = isAdmin(req);
    const empOk = await employeeValid(req).catch(()=>false);
    const agOk = await agentValid(req).catch(()=>false);

    if (req.method === "GET") {
      if(!admin && !empOk && !agOk) return json(res, 401, {error:"未授权，请先登录员工/中介或管理员"});
      const path = `/rest/v1/${encodeURIComponent(DATA_TABLE)}?id=eq.${encodeURIComponent(DATA_ROW)}&select=payload,updated_at`;
      const r = await sbRequest("GET", path);
      if(!r.ok) return json(res,r.status,{error:r.text});
      const rows=JSON.parse(r.text||"[]");
      return json(res,200,rows[0]||{});
    }

    if (req.method === "POST") {
      if(!admin) return json(res, 403, {error:"只有管理员可以上传修改数据"});
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      if(!body.payload) return json(res,400,{error:"缺少 payload"});
      const payload={id:DATA_ROW,payload:body.payload,updated_at:new Date().toISOString()};
      const path = `/rest/v1/${encodeURIComponent(DATA_TABLE)}?on_conflict=id`;
      const r = await sbRequest("POST", path, payload);
      if(!r.ok) return json(res,r.status,{error:r.text});
      return json(res,200,{ok:true});
    }

    return json(res,405,{error:"Method not allowed"});
  } catch(err) {
    return json(res,500,{error:err.message||String(err),code:err.code||null});
  }
};
