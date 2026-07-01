
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

module.exports = async function handler(req,res){
  try{
    if(req.method!=="POST") return json(res,405,{error:"Method not allowed"});
    const raw=await readBody(req);
    const body=raw?JSON.parse(raw):{};
    const action=body.action;

    if(action==="login"){
      const slug=String(body.slug||"").trim();
      const code=String(body.code||"").trim();
      const deviceId=String(body.deviceId||"").trim();
      const deviceName=String(body.deviceName||"").trim().slice(0,200);
      if(!slug||!code||!deviceId) return json(res,400,{error:"缺少中介编号、授权码或设备ID"});
      const r=await sbRequest("GET",`/rest/v1/${encodeURIComponent(AGENT_TABLE)}?id=eq.${encodeURIComponent(slug)}&login_code=eq.${encodeURIComponent(code)}&select=*`);
      if(!r.ok) return json(res,r.status,{error:r.text});
      const a=(JSON.parse(r.text||"[]"))[0];
      if(!a) return json(res,401,{error:"中介授权码不存在或不匹配"});
      if(!a.is_active) return json(res,403,{error:"该中介授权已停用"});
      if(!notExpired(a)) return json(res,403,{error:"该中介授权已到期"});
      const devPath=`/rest/v1/${encodeURIComponent(AGENT_DEVICE_TABLE)}?agent_id=eq.${encodeURIComponent(a.id)}&select=*`;
      const dr=await sbRequest("GET",devPath);
      if(!dr.ok) return json(res,dr.status,{error:dr.text});
      const devices=JSON.parse(dr.text||"[]");
      const exists=devices.find(d=>d.device_id===deviceId);
      const max=Number(a.max_devices||1);
      if(!exists && devices.length>=max){
        return json(res,403,{error:`该中介授权最多绑定 ${max} 台设备，当前设备无法登录。请联系总号重置设备。`});
      }
      const payload={agent_id:a.id,device_id:deviceId,device_name:deviceName,last_login_at:new Date().toISOString()};
      const up=await sbRequest("POST",`/rest/v1/${encodeURIComponent(AGENT_DEVICE_TABLE)}?on_conflict=agent_id,device_id`,payload);
      if(!up.ok) return json(res,up.status,{error:up.text});
      return json(res,200,{agent:agentSafe(a)});
    }

    if(action==="check"){
      const agentId=String(body.agentId||"").trim();
      const deviceId=String(body.deviceId||"").trim();
      const a=agentId?await getAgent(agentId):null;
      if(!a || !a.is_active || !notExpired(a)) return json(res,200,{valid:false});
      const p=`/rest/v1/${encodeURIComponent(AGENT_DEVICE_TABLE)}?agent_id=eq.${encodeURIComponent(agentId)}&device_id=eq.${encodeURIComponent(deviceId)}&select=*`;
      const r=await sbRequest("GET",p);
      const valid=r.ok && (JSON.parse(r.text||"[]")).length>0;
      return json(res,200,{valid,agent:valid?agentSafe(a):null});
    }

    return json(res,400,{error:"未知操作"});
  }catch(err){
    return json(res,500,{error:err.message||String(err),code:err.code||null});
  }
};
