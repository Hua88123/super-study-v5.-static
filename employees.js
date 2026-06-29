
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
function maskKey(key){return !key?"":(key.slice(0,8)+"..."+key.slice(-6))}

function id(){return "emp_"+Date.now()+"_"+Math.random().toString(36).slice(2,8)}
module.exports = async function handler(req,res){
  try{
    if(!isAdmin(req)) return json(res,403,{error:"管理员权限不足：请重新管理员登录"});
    if(req.method==="GET"){
      const r=await sbRequest("GET",`/rest/v1/${encodeURIComponent(EMP_TABLE)}?select=*&order=created_at.desc`);
      if(!r.ok) return json(res,r.status,{error:r.text});
      return json(res,200,{employees:JSON.parse(r.text||"[]")});
    }
    if(req.method==="POST"){
      const raw=await readBody(req);
      const body=raw?JSON.parse(raw):{};
      const action=body.action;
      if(action==="create"){
        const name=String(body.name||"").trim();
        const code=String(body.code||"").trim();
        if(!name||!code) return json(res,400,{error:"缺少员工姓名或授权码"});
        const payload={id:id(),name,login_code:code,is_active:true,bound_device_id:null,bound_device_name:null,created_at:new Date().toISOString()};
        const r=await sbRequest("POST",`/rest/v1/${encodeURIComponent(EMP_TABLE)}`,payload);
        if(!r.ok) return json(res,r.status,{error:r.text});
        return json(res,200,{ok:true});
      }
      if(action==="resetDevice"){
        const r=await sbRequest("PATCH",`/rest/v1/${encodeURIComponent(EMP_TABLE)}?id=eq.${encodeURIComponent(body.id)}`,{bound_device_id:null,bound_device_name:null});
        if(!r.ok) return json(res,r.status,{error:r.text});
        return json(res,200,{ok:true});
      }
      if(action==="setActive"){
        const r=await sbRequest("PATCH",`/rest/v1/${encodeURIComponent(EMP_TABLE)}?id=eq.${encodeURIComponent(body.id)}`,{is_active:!!body.active});
        if(!r.ok) return json(res,r.status,{error:r.text});
        return json(res,200,{ok:true});
      }
      if(action==="delete"){
        const r=await sbRequest("DELETE",`/rest/v1/${encodeURIComponent(EMP_TABLE)}?id=eq.${encodeURIComponent(body.id)}`);
        if(!r.ok) return json(res,r.status,{error:r.text});
        return json(res,200,{ok:true});
      }
      return json(res,400,{error:"未知操作"});
    }
    return json(res,405,{error:"Method not allowed"});
  }catch(err){
    return json(res,500,{error:err.message||String(err),code:err.code||null});
  }
};
