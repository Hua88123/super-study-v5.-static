const STORAGE_KEY="super-study-static-v5";
const CLOUD_CONFIG_KEY="super-study-cloud-config-v6";
const feeTemplate=[["SSP特别学习许可",12000,false],["SSPI-Card",4000,false],["签证延期 Visa Extension",7500,false],["ACR I-Card（超过59天必须办理）",3500,false],["预估教材费 Books",2500,false],["水电费 Utilities",800,true],["设施管理 Maintenance",500,true],["学生证 Student ID",300,false],["接机费 Airport Pick-up",1200,false],["宿舍押金 Dorm Deposit",5000,false]];
const defaultData={settings:{brandName:"超能游学",brandEn:"SUPER STUDY ABROAD",brandLogo:"./public/superstudy-logo.png",usdRate:7.2,pesoRate:.13,watermarkEnabled:true,watermarkText:"超能游学",agencyAdvantageTitle:"超能游学优势",agencyAdvantageLine1:"全程协助报名、签证、入学",agencyAdvantageLine2:"透明报价，售后跟进更安心",adminPassword:"SuperStudy888"},schools:[{id:"cg-banilad",name:"CG",campus:"Banilad校区",courses:[{id:"esl",name:"ESL加强课",price4w:750,note:"",lessonText:"1对1 5节，团课1节，选修课 2节"},{id:"ielts",name:"IELTS基础课",price4w:850,note:"雅思基础强化",lessonText:"1对1 4节，团课2节，选修课2节"}],rooms:[{id:"hotel",name:"校外酒店",price4w:1500},{id:"triple",name:"3人间宿舍",price4w:700},{id:"quad",name:"4人间宿舍",price4w:650}],discounts:{registrationFee:100,lowSeasonDiscountPer4w:150,schoolLowSeasonDiscountRate:1,peakFeePerWeek:40,agencyDiscountRate:.9,registrationWaiverAmount:100,long12:50,long16:100,long20:150,long24:200,schoolPromoTitle:"学校优惠",schoolPromoText:"淡季每4周减免，可叠加长期优惠，具体以学校最新政策为准。",lowSeasonEnabled:true,schoolLowSeasonRateEnabled:false,peakSeasonEnabled:false,longDiscountEnabled:true,agencyDiscountEnabled:true,registrationWaiverEnabled:false},localFees:feeTemplate.map(([name,amount,perWeek])=>({name,amount,perWeek})),officialTotals:{},bookFees:{4:2500,8:4000,12:5500},visaFees:{9:7500,12:10000,16:13000,20:16000}}],records:[]};
let data=loadData();let selectedSchoolId=data.schools[0].id;let editingSchoolId=selectedSchoolId;
function $(id){return document.getElementById(id)}function clone(o){return JSON.parse(JSON.stringify(o))}function loadData(){try{let r=localStorage.getItem(STORAGE_KEY);if(r)return normalize(JSON.parse(r))}catch(e){}return clone(defaultData)}let cloudSaveTimer=null;
function getCloudConfig(){
  try{
    return {enabled:false,url:"",anonKey:"",table:"super_study_data",rowId:"main",...(JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY)||"{}"))};
  }catch(e){
    return {enabled:false,url:"",anonKey:"",table:"super_study_data",rowId:"main"};
  }
}
function setCloudConfig(c){
  localStorage.setItem(CLOUD_CONFIG_KEY,JSON.stringify({enabled:!!c.enabled,url:c.url||"",anonKey:c.anonKey||"",table:c.table||"super_study_data",rowId:c.rowId||"main"}));
}
function applyCloudConfigFromUrl(){
  let p=new URLSearchParams(location.search);
  let url=p.get("cloudUrl")||p.get("supabaseUrl");
  let key=p.get("cloudKey")||p.get("supabaseKey");
  if(url&&key){
    setCloudConfig({enabled:true,url,anonKey:key,table:p.get("cloudTable")||"super_study_data",rowId:p.get("cloudRow")||"main"});
    try{history.replaceState(null,"",location.pathname)}catch(e){}
  }
}
function cloudClient(){
  let cfg=getCloudConfig();
  if(!cfg.enabled||!cfg.url||!cfg.anonKey||!window.supabase)return null;
  return window.supabase.createClient(cfg.url,cfg.anonKey);
}
function updateCloudStatus(msg,isBad=false){
  let el=$("cloudStatus");
  if(el){
    el.textContent=msg;
    el.className=isBad?"cloud-status bad":"cloud-status";
  }
}
function saveLocalOnly(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
function scheduleCloudSave(){
  let cfg=getCloudConfig();
  if(!cfg.enabled)return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer=setTimeout(()=>uploadCloudData(true),900);
}
async function uploadCloudData(silent=false){
  let cfg=getCloudConfig(),client=cloudClient();
  if(!client){if(!silent)alert("云端未连接：请先填写 Supabase URL 和 anon key");return false}
  try{
    updateCloudStatus("正在上传到云端...");
    let payload=JSON.parse(JSON.stringify(data));
    let {error}=await client.from(cfg.table||"super_study_data").upsert({id:cfg.rowId||"main",payload,updated_at:new Date().toISOString()});
    if(error)throw error;
    updateCloudStatus("云端已同步："+new Date().toLocaleString());
    if(!silent)alert("已上传到云端");
    return true;
  }catch(err){
    updateCloudStatus("云端上传失败："+(err.message||err),true);
    if(!silent)alert("上传失败："+(err.message||err));
    return false;
  }
}
async function loadCloudData(silent=false){
  let cfg=getCloudConfig(),client=cloudClient();
  if(!client){if(!silent)alert("云端未连接：请先填写 Supabase URL 和 anon key");return false}
  try{
    updateCloudStatus("正在从云端读取...");
    let {data:row,error}=await client.from(cfg.table||"super_study_data").select("payload,updated_at").eq("id",cfg.rowId||"main").maybeSingle();
    if(error)throw error;
    if(row&&row.payload){
      data=normalize(row.payload);
      saveLocalOnly();
      selectedSchoolId=data.schools[0]?.id;
      editingSchoolId=selectedSchoolId;
      refreshAll();
      applyRoleMode();
      updateCloudStatus("已从云端同步："+new Date(row.updated_at||Date.now()).toLocaleString());
      if(!silent)alert("已从云端同步最新数据");
      return true;
    }else{
      updateCloudStatus("云端暂无数据，请先点“上传本地数据到云端”");
      if(!silent)alert("云端暂无数据，请先上传本地数据到云端");
      return false;
    }
  }catch(err){
    updateCloudStatus("云端读取失败："+(err.message||err),true);
    if(!silent)alert("读取失败："+(err.message||err));
    return false;
  }
}
async function copyCloudShareLink(){
  let cfg=getCloudConfig();
  if(!cfg.url||!cfg.anonKey)return alert("请先填写并保存云端配置");
  let u=new URL(location.href);
  u.search="";
  u.hash="";
  u.searchParams.set("cloudUrl",cfg.url);
  u.searchParams.set("cloudKey",cfg.anonKey);
  u.searchParams.set("cloudTable",cfg.table||"super_study_data");
  u.searchParams.set("cloudRow",cfg.rowId||"main");
  await navigator.clipboard.writeText(u.toString());
  alert("已复制员工云端同步链接。员工第一次打开这个链接后，手机会自动保存云端配置。");
}
function saveCloudSettings(){
  setCloudConfig({
    enabled:$("cloudEnabled").value==="true",
    url:$("cloudUrl").value.trim(),
    anonKey:$("cloudKey").value.trim(),
    table:$("cloudTable").value.trim()||"super_study_data",
    rowId:$("cloudRow").value.trim()||"main"
  });
  renderSettings();
  updateCloudStatus(getCloudConfig().enabled?"云端配置已保存":"云端同步已关闭");
  alert("云端配置已保存");
}
async function autoLoadCloudData(){
  let cfg=getCloudConfig();
  if(cfg.enabled&&cfg.url&&cfg.anonKey) await loadCloudData(true);
}

function saveData(){saveLocalOnly();scheduleCloudSave()}function normalize(d){let b=clone(defaultData);d.settings={...b.settings,...(d.settings||{})};d.schools=(d.schools&&d.schools.length?d.schools:b.schools).map(s=>({...b.schools[0],...s,discounts:{...b.schools[0].discounts,...(s.discounts||{})},courses:s.courses||[],rooms:s.rooms||[],localFees:(s.localFees&&s.localFees.length?s.localFees:feeTemplate.map(([name,amount,perWeek])=>({name,amount,perWeek}))),officialTotals:s.officialTotals||{},bookFees:{4:2500,8:4000,12:5500,...(s.bookFees||{})},visaFees:{9:7500,12:10000,16:13000,20:16000,...(s.visaFees||{})}}));d.records=d.records||[];return d}function currentSchool(){return data.schools.find(s=>s.id===selectedSchoolId)||data.schools[0]}function editingSchool(){return data.schools.find(s=>s.id===editingSchoolId)||data.schools[0]}function num(v){let n=Number(v);return Number.isFinite(n)?n:0}function money(n){return `${Math.round(num(n)).toLocaleString()} 美元`}function peso(n){return `${Math.round(num(n)).toLocaleString()} PHP`}function rmb(n){return `约 ${Math.round(num(n)).toLocaleString()} 元`}function html(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function formatDateLocal(date){let y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");return `${y}-${m}-${d}`}function nextSunday(){let d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+((7-d.getDay())%7));return d}function sundayOptions(count=140){let st=nextSunday(),arr=[];for(let i=0;i<count;i++){let d=new Date(st);d.setDate(st.getDate()+i*7);arr.push(formatDateLocal(d))}return arr}function addWeeks(ds,w){let d=new Date(ds+"T00:00:00");d.setDate(d.getDate()+w*7);return formatDateLocal(d)}function longAmount(d,w){if(w>=24)return num(d.long24);if(w>=20)return num(d.long20);if(w>=16)return num(d.long16);if(w>=12)return num(d.long12);return 0}

function courseLesson(c){
  if(!c) return "";
  return c.lessonText || extractLessonText(c.note||"") || "";
}
function setCheck(id,val){let el=$(id); if(el) el.checked=!!val}
function applySchoolDefaults(){
  let s=currentSchool(),d=s.discounts||{};
  setCheck("lowSeason", d.lowSeasonEnabled !== false);
  setCheck("schoolRate", !!d.schoolLowSeasonRateEnabled);
  setCheck("peakSeason", !!d.peakSeasonEnabled);
  setCheck("longDiscount", d.longDiscountEnabled !== false);
  setCheck("agencyDiscount", d.agencyDiscountEnabled !== false);
  setCheck("waiveRegistration", !!d.registrationWaiverEnabled);
}
function yesNo(label,id,val){return `<label>${label}<select id="${id}"><option value="true" ${val?"selected":""}>启用</option><option value="false" ${!val?"selected":""}>不启用</option></select></label>`}
function fileNameToSchoolName(name){
  return String(name||"").replace(/\.[^.]+$/,"").replace(/价格单|价目表|price|fees|2025|2026|最新|官方/gi,"").replace(/[_\-]+/g," ").trim();
}
function detectSchoolName(text,fileName){
  let t=String(text||"");
  let m=t.match(/(?:学校|School|Academy|校区)\s*[:：]\s*([^\n\r]+)/i);
  if(m) return m[1].replace(/[|｜].*$/,"").trim().slice(0,40);
  let lines=t.split(/\n|\r/).map(x=>x.trim()).filter(Boolean);
  let schoolLine=lines.find(x=>/(academy|school|college|university|校区|学校|语言)/i.test(x) && x.length<60);
  if(schoolLine) return schoolLine.replace(/价格单|价目表|Price List|Fees/gi,"").trim().slice(0,40);
  return fileNameToSchoolName(fileName);
}
function lastPrice(line){
  let nums=String(line).match(/(?:\$|USD|美金|美元)?\s*([0-9]{3,5})(?:\s*(?:USD|美金|美元|\$))?/gi);
  if(!nums) return 0;
  let candidates=nums.map(x=>num(String(x).replace(/[^0-9.]/g,""))).filter(n=>n>=100);
  return candidates.length?candidates[candidates.length-1]:0;
}
function cleanItemName(line){
  return String(line)
    .replace(/(?:\$|USD|美金|美元)\s*[0-9.,]+/gi,"")
    .replace(/[0-9.,]+\s*(?:USD|美金|美元|\$)/gi,"")
    .replace(/\s+/g," ")
    .replace(/[|｜,，:：]+$/,"")
    .trim()
    .slice(0,36);
}
function extractLessonText(line){
  let src=String(line||"").replace(/\s+/g," ");
  let items=[];
  let m;
  m=src.match(/(?:1\s*[:：对]\s*1|一对一|1-on-1|man\s*to\s*man)[^\d]{0,10}(\d+)\s*(?:节|课|class|classes)?/i);
  if(m) items.push(`1对1 ${m[1]}节`);
  m=src.match(/(?:1\s*[:：对]\s*[234568]|小团体|团课|group)[^\d]{0,10}(\d+)\s*(?:节|课|class|classes)?/i);
  if(m) {
    let ratio=(src.match(/1\s*[:：对]\s*[234568]/)||["团课"])[0].replace("：",":").replace("对",":");
    items.push(`${ratio} ${m[1]}节`);
  } else {
    m=src.match(/(\d+)\s*(?:节|课)?\s*(?:团课|小团体|group)/i);
    if(m) items.push(`团课 ${m[1]}节`);
  }
  m=src.match(/(?:选修|optional|elective)[^\d]{0,10}(\d+)\s*(?:节|课|class|classes)?/i);
  if(m) items.push(`选修课 ${m[1]}节`);
  m=src.match(/(\d+)\s*(?:节|课)?\s*(?:选修|optional|elective)/i);
  if(m && !items.some(x=>x.includes("选修"))) items.push(`选修课 ${m[1]}节`);
  return items.join("，");
}
function looksCourse(line){
  return /(ESL|IELTS|TOEIC|TOEFL|Business|Cambridge|Speaking|Power|Intensive|General|Junior|Guardian|课程|雅思|托业|托福|商务|口语|青少年|亲子|一对一)/i.test(line);
}
function looksRoom(line){
  return /(单人|双人|三人|四人|五人|六人|1人|2人|3人|4人|5人|6人|single|double|triple|quad|dorm|room|宿舍|酒店|hotel|校内|校外)/i.test(line);
}
function parsePriceText(text,fileName=""){
  let lines=String(text||"").split(/\n|\r/).map(x=>x.trim()).filter(x=>x && !/^[-_=]+$/.test(x));
  let courses=[], rooms=[];
  for(let raw of lines){
    let line=raw.replace(/\t/g," ").replace(/\s{2,}/g," ");
    let price=lastPrice(line);
    if(!price) continue;
    let lessonText=extractLessonText(line);
    let name=cleanItemName(line);
    if(looksRoom(line) && !looksCourse(line)){
      rooms.push({id:"room"+Date.now()+rooms.length,name:name||`房型${rooms.length+1}`,price4w:price});
    }else if(looksCourse(line)){
      courses.push({id:"course"+Date.now()+courses.length,name:name||`课程${courses.length+1}`,price4w:price,note:"",lessonText});
    }
  }
  // 去重
  courses=courses.filter((v,i,a)=>a.findIndex(x=>x.name===v.name&&x.price4w===v.price4w)===i);
  rooms=rooms.filter((v,i,a)=>a.findIndex(x=>x.name===v.name&&x.price4w===v.price4w)===i);
  return {schoolName:detectSchoolName(text,fileName),courses,rooms};
}
function handlePriceFile(e){
  let file=e.target.files&&e.target.files[0];
  if(!file) return;
  if(file.type.startsWith("image/") || file.type==="application/pdf"){
    $("priceText").value = `已上传：${file.name}\n\n静态版浏览器无法直接OCR识别图片/PDF。请先用微信/电脑OCR提取文字，再粘贴到这里点击识别导入。`;
    $("importResult").innerHTML = `<p class="muted">图片/PDF已选择，但静态版不能直接OCR。请粘贴价格单文字后再导入。</p>`;
    return;
  }
  let reader=new FileReader();
  reader.onload=()=>{$("priceText").value=reader.result; importPriceText(file.name)};
  reader.readAsText(file);
}
function importPriceText(fileName=""){
  let s=editingSchool(), raw=$("priceText")?.value||"";
  let result=parsePriceText(raw,fileName);
  if(result.schoolName) {
    let parts=result.schoolName.split(/\s+|-/).filter(Boolean);
    s.name=parts[0]||s.name;
    if(parts.length>1) s.campus=parts.slice(1).join(" ");
  }
  if(result.courses.length) s.courses=result.courses;
  if(result.rooms.length) s.rooms=result.rooms;
  saveData();
  renderSchoolEditor();renderSelectors();renderCalc();
  $("importResult").innerHTML = `<p><b>识别完成：</b>课程 ${result.courses.length} 个，房型 ${result.rooms.length} 个。${result.schoolName?`学校名：${html(result.schoolName)}`:""}</p>`;
}


function isAcrIcardName(name){return /ACR\s*I-?Card|ACR I-Card|超过59天/i.test(String(name||""))}
function isBooksName(name){return /Books|教材|书本/i.test(String(name||""))}
function isVisaExtensionName(name){return /Visa Extension|签证延期/i.test(String(name||""))}
function isDormDepositName(name){return /Dorm Deposit|宿舍押金|押金/i.test(String(name||""))}
function isPickupName(name){return /Airport Pick-?up|接机/i.test(String(name||""))}
function isExcludedLocalFee(name){return isDormDepositName(name)||isPickupName(name)}
function bookFeeForWeeks(s,weeks){
  let b=s.bookFees||{4:2500,8:4000,12:5500};
  if(weeks<=4) return num(b[4]);
  if(weeks<=8) return num(b[8]);
  return num(b[12]);
}
function visaFeeForWeeks(s,weeks){
  let v=s.visaFees||{9:7500,12:10000,16:13000,20:16000};
  if(weeks>=20) return {amount:num(v[20]),note:"第20周起"};
  if(weeks>=16) return {amount:num(v[16]),note:"第16周起"};
  if(weeks>=12) return {amount:num(v[12]),note:"第12周起"};
  if(weeks>=9) return {amount:num(v[9]),note:"第9周起"};
  return {amount:0,note:"1-8周不计"};
}
function localFeeItemTotal(s,it,weeks){
  let name=it.name||"";
  let total=num(it.amount)*(it.perWeek?weeks:1);
  let note="";
  if(isAcrIcardName(name)){
    if(weeks>=9){
      total=num(it.amount);
      note="第9周起";
    }else{
      total=0;
      note="未超过59天";
    }
  }
  if(isVisaExtensionName(name)){
    let vf=visaFeeForWeeks(s,weeks);
    total=vf.amount;
    note=vf.note;
  }
  if(isBooksName(name)){
    total=bookFeeForWeeks(s,weeks);
    note=weeks<=4?"4周教材费":weeks<=8?"8周教材费":"12周教材费";
  }
  return {...it,total,excluded:isExcludedLocalFee(name),note};
}

function calc(){let school=currentSchool(),course=school.courses.find(c=>c.id===$("courseSelect").value)||school.courses[0],room=school.rooms.find(r=>r.id===$("roomSelect").value)||school.rooms[0],weeks=num($("weeksSelect").value||4),d=school.discounts;let tuition=num(course?.price4w)*weeks/4,dorm=num(room?.price4w)*weeks/4,low=$("lowSeason").checked?num(d.lowSeasonDiscountPer4w)*weeks/4:0,peak=$("peakSeason").checked?num(d.peakFeePerWeek)*weeks:0,longD=$("longDiscount").checked?longAmount(d,weeks):0,beforeSchool=tuition+dorm-low-longD+peak,schoolRate=$("schoolRate").checked?beforeSchool*(1-num(d.schoolLowSeasonDiscountRate)):0,beforeAgency=beforeSchool-schoolRate,agency=$("agencyDiscount").checked?beforeAgency*(1-num(d.agencyDiscountRate)):0,afterAgency=$("agencyDiscount").checked?beforeAgency*num(d.agencyDiscountRate):beforeAgency,regWaive=$("waiveRegistration").checked?Math.min(num(d.registrationFee),num(d.registrationWaiverAmount)):0,regFee=Math.max(num(d.registrationFee)-regWaive,0),totalUsd=afterAgency+regFee,official=num(school.officialTotals?.[weeks]);let localItems=[],localPeso=0;if(official>0){localItems=[{name:"学校官方 Total（不含宿舍押金/接机）",amount:official,total:official,perWeek:false,excluded:false,note:"官方合计"}];localPeso=official}else{localItems=school.localFees.map(it=>localFeeItemTotal(school,it,weeks));localPeso=localItems.reduce((a,b)=>a+(b.excluded?0:num(b.total)),0)}let tuitionRmb=totalUsd*num(data.settings.usdRate),localRmb=localPeso*num(data.settings.pesoRate);return{school,course,room,weeks,startDate:$("startDateSelect").value,endDate:addWeeks($("startDateSelect").value,weeks),tuition,dorm,lowDiscount:low,peakFee:peak,longDiscount:longD,schoolLowSeasonDiscount:schoolRate,agencyDiscount:agency,registrationWaiver:regWaive,registrationFee:regFee,originalRegistrationFee:num(d.registrationFee),totalUsd,localItems,localPeso,excludedLocalPeso:localItems.reduce((a,b)=>a+(b.excluded?num(b.total):0),0),tuitionRmb,localRmb,totalRmb:tuitionRmb+localRmb}}
function renderSelectors(){let ssel=$("schoolSelect");ssel.innerHTML=data.schools.map(s=>`<option value="${s.id}">${s.name} ${s.campus}</option>`).join("");ssel.value=selectedSchoolId;let s=currentSchool();$("courseSelect").innerHTML=s.courses.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");$("roomSelect").innerHTML=s.rooms.map(r=>`<option value="${r.id}">${r.name}</option>`).join("");let oldW=$("weeksSelect").value||4;$("weeksSelect").innerHTML=Array.from({length:24},(_,i)=>i+1).map(w=>`<option value="${w}">${w}周</option>`).join("");$("weeksSelect").value=oldW;let oldD=$("startDateSelect").value;$("startDateSelect").innerHTML=sundayOptions().map(v=>`<option value="${v}">${v} 周日</option>`).join("");if(oldD)$("startDateSelect").value=oldD;applySchoolDefaults()}
function line(a,b,cls=""){return `<div class="calc-line ${cls}"><span>${a}</span><strong>${b}</strong></div>`}function renderCalc(){let c=calc();let rows=`${line("课程学费",money(c.tuition))}${line("住宿费",money(c.dorm))}`;if(num(c.lowDiscount)>0)rows+=line("淡季优惠","-"+money(c.lowDiscount),"minus");if(num(c.longDiscount)>0)rows+=line("长期优惠","-"+money(c.longDiscount),"minus");if(num(c.schoolLowSeasonDiscount)>0)rows+=line("学校淡季折扣","-"+money(c.schoolLowSeasonDiscount),"minus");if(num(c.peakFee)>0)rows+=line("旺季附加",money(c.peakFee));if(num(c.agencyDiscount)>0)rows+=line("超能折扣","-"+money(c.agencyDiscount),"minus");if(num(c.registrationWaiver)>0)rows+=line("超能减免注册金","-"+money(c.registrationWaiver),"minus");rows+=line("注册金",money(c.registrationFee));$("calcBox").innerHTML=`${rows}<div class="calc-total"><span>费用一合计：${money(c.totalUsd)} / ${rmb(c.tuitionRmb)}</span><span>费用二合计：${peso(c.localPeso)} / ${rmb(c.localRmb)}</span><span class="local-note">宿舍押金、接机费不含在学杂费合计内。</span><b>总人民币：${rmb(c.totalRmb)}</b></div>`;renderQuoteSheet()}
function info(t,b,s){return `<div class="info"><small>${t}</small><b>${b}</b><span>${s||""}</span></div>`}function table(headers,rows){return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((x,i)=>`<td class="${i===2?"amount":""}">${x}</td>`).join("")}</tr>`).join("")}</tbody></table>`}
function buildUsdRows(c,s){
  let rows=[
    ["课程",`${c.course?.name||"-"} / ${num(c.course?.price4w)}美元/4周`,Math.round(c.tuition).toLocaleString(),courseLesson(c.course)||`${c.weeks}周`],
    ["房型",`${c.room?.name||"-"} / ${num(c.room?.price4w)}美元/4周`,Math.round(c.dorm).toLocaleString(),`${c.weeks}周`]
  ];
  if(num(c.lowDiscount)>0) rows.push(["淡季优惠",`${s.discounts.lowSeasonDiscountPer4w}美元/4周`,`-${Math.round(c.lowDiscount).toLocaleString()}`,"优惠"]);
  if(num(c.longDiscount)>0) rows.push(["长期优惠",`${c.weeks}周对应`,`-${Math.round(c.longDiscount).toLocaleString()}`,"优惠"]);
  if(num(c.schoolLowSeasonDiscount)>0) rows.push(["学校淡季折扣",`折扣比例 ${s.discounts.schoolLowSeasonDiscountRate}`,`-${Math.round(c.schoolLowSeasonDiscount).toLocaleString()}`,"学校优惠"]);
  if(num(c.peakFee)>0) rows.push(["旺季附加",`${s.discounts.peakFeePerWeek}美元/周`,Math.round(c.peakFee).toLocaleString(),"旺季"]);
  if(num(c.agencyDiscount)>0) rows.push(["超能折扣",`折扣比例 ${s.discounts.agencyDiscountRate}`,`-${Math.round(c.agencyDiscount).toLocaleString()}`,"超能优惠"]);
  if(num(c.registrationWaiver)>0) rows.push(["减免注册金",`最高减${s.discounts.registrationWaiverAmount}美元`,`-${Math.round(c.registrationWaiver).toLocaleString()}`,"超能优惠"]);
  rows.push(["注册金",`${Math.round(c.originalRegistrationFee)}美元/人`,Math.round(c.registrationFee).toLocaleString(),""]);
  return rows;
}
function renderQuoteSheet(){let c=calc(),s=c.school,set=data.settings;let usdRows=buildUsdRows(c,s);let phpRows=c.localItems.map(it=>[it.name,it.perWeek?`${it.amount} PHP/周`:(isBooksName(it.name)?"按周数设置":"固定费用"),Math.round(it.total??it.amount).toLocaleString(),it.excluded?"不含合计":(it.note||"")]);$("quoteSheet").innerHTML=`<div class="quote-inner"><div class="sheet-head"><img class="sheet-logo" src="${set.brandLogo}"/><div class="sheet-title"><h2>${s.name} ${s.campus}</h2><h3>游学报价单（${c.weeks}周）</h3><span class="slogan">超能游学 · 透明报价 · 安心之选</span></div></div><div class="info-grid">${info("学校",s.name,s.campus)}${info("时间",`${c.weeks}周`,`${c.startDate} 入学`)}${info("课程",c.course?.name||"-",courseLesson(c.course)||c.course?.note||"以学校安排为准")}${info("房型",c.room?.name||"-","住宿按所选房型")}${info("注册金",`${Math.round(c.originalRegistrationFee)}美元/人`,"")}</div><div class="promo-grid"><div class="promo red"><h4>${s.discounts.schoolPromoTitle}</h4><p>${s.discounts.schoolPromoText}</p></div><div class="promo blue"><h4>${set.agencyAdvantageTitle}</h4><p>✓ ${set.agencyAdvantageLine1}<br/>✓ ${set.agencyAdvantageLine2}</p></div></div><div class="cost-grid"><div class="panel"><h4>费用一：学费 & 住宿费（美元）</h4>${table(["项目","说明","金额","备注"],usdRows)}<div class="panel-total">费用一合计：<strong>${Math.round(c.totalUsd).toLocaleString()} 美元</strong></div></div><div class="panel green"><h4>费用二：到校支付费用（披索）</h4>${table(["项目","说明","金额","备注"],phpRows)}<div class="panel-total">费用二合计：<strong>${Math.round(c.localPeso).toLocaleString()} PHP</strong></div></div></div><div class="summary"><h4>本次游学总计（以实际汇率为准）</h4><div class="sum-grid"><div class="sum-item"><small>美元部分</small><b>${rmb(c.tuitionRmb)}</b><span>${Math.round(c.totalUsd).toLocaleString()} USD × ${set.usdRate}</span></div><div class="plus">+</div><div class="sum-item"><small>披索部分</small><b>${rmb(c.localRmb)}</b><span>${Math.round(c.localPeso).toLocaleString()} PHP × ${set.pesoRate}</span></div><div class="equals">≈</div><div class="sum-item final"><small>总人民币</small><b>${Math.round(c.totalRmb).toLocaleString()} 元</b><span>学费 + 本地费用</span></div></div></div><div class="foot">选择 ${set.brandName}｜价格透明｜专业顾问｜安心服务<br/>备注：菲律宾本地费用只做参考，最终以学校实际收取为准。宿舍押金、接机费不含在学杂费合计内。</div></div>`}
function wechatText(){let c=calc(),s=c.school;return `❤️超能游学报价\n学校：${s.name} ${s.campus}\n时间：${c.weeks}周\n课程：${c.course?.name}\n课程课时：${courseLesson(c.course)||"以学校实际安排为准"}\n房型：${c.room?.name}\n入学：${c.startDate} 周日\n毕业：${c.endDate}\n\n费用一合计：${money(c.totalUsd)}（${rmb(c.tuitionRmb)}）\n费用二本地费用：${peso(c.localPeso)}（${rmb(c.localRmb)}）\n合计人民币参考：${rmb(c.totalRmb)}\n\n备注：菲律宾本地费用只做参考，最终以学校实际收取为准。宿舍押金、接机费不含。`}
async function loadImage(src){return new Promise(res=>{let img=new Image();img.crossOrigin="anonymous";img.onload=()=>res(img);img.onerror=()=>res(null);img.src=src})}function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}function t(ctx,txt,x,y,mw,lh,ml=2){let cs=String(txt||"").split(""),line="",ls=[];for(let ch of cs){let test=line+ch;if(ctx.measureText(test).width>mw&&line){ls.push(line);line=ch;if(ls.length>=ml)break}else line=test}if(line&&ls.length<ml)ls.push(line);ls.forEach((l,i)=>ctx.fillText(l,x,y+i*lh))}function drawRows(ctx,heads,rows,x,y,w,rowH){let col=[w*.23,w*.37,w*.22,w*.18],cy=y,cx=x;ctx.font="bold 16px sans-serif";ctx.fillStyle="#f5f8ff";ctx.fillRect(x,cy,w,rowH);heads.forEach((h,i)=>{ctx.strokeStyle="#dbe7ff";ctx.strokeRect(cx,cy,col[i],rowH);ctx.fillStyle="#0639a6";ctx.fillText(h,cx+8,cy+25);cx+=col[i]});cy+=rowH;ctx.font="15px sans-serif";rows.forEach((r,ri)=>{cx=x;ctx.fillStyle=ri%2?"#fbfdff":"#fff";ctx.fillRect(x,cy,w,rowH);r.forEach((cell,i)=>{ctx.strokeStyle="#dbe7ff";ctx.strokeRect(cx,cy,col[i],rowH);ctx.fillStyle=i===2?"#0639a6":"#17214d";ctx.font=i===2?"bold 15px sans-serif":"15px sans-serif";t(ctx,cell,cx+7,cy+21,col[i]-12,16,2);cx+=col[i]});cy+=rowH})}
async function downloadImage(){let c=calc(),set=data.settings,s=c.school,canvas=document.createElement("canvas"),W=1080,H=1528;canvas.width=W*2;canvas.height=H*2;let ctx=canvas.getContext("2d");ctx.scale(2,2);ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);let logo=await loadImage(set.brandLogo||"./public/superstudy-logo.png");let grad=ctx.createLinearGradient(0,0,W,180);grad.addColorStop(0,"#eaf7ff");grad.addColorStop(.6,"#fff");grad.addColorStop(1,"#fff3c0");ctx.fillStyle=grad;ctx.fillRect(0,0,W,180);if(logo)ctx.drawImage(logo,32,20,130,130);ctx.fillStyle="#0639a6";ctx.font="bold 52px sans-serif";ctx.fillText(`${s.name} ${s.campus}`,180,65);ctx.font="bold 40px sans-serif";ctx.fillText(`游学报价单（${c.weeks}周）`,180,120);ctx.fillStyle="#0798e8";rr(ctx,180,138,520,40,20);ctx.fill();ctx.fillStyle="#fff";ctx.font="bold 23px sans-serif";ctx.fillText("超能游学 · 透明报价 · 安心之选",220,166);[["学校",s.name,s.campus],["时间",`${c.weeks}周`,`${c.startDate} 入学`],["课程",c.course?.name||"-",courseLesson(c.course)||c.course?.note||""],["房型",c.room?.name||"-","住宿按所选房型"],["注册金",`${c.originalRegistrationFee}美元/人`,""]].forEach((it,i)=>{let x=32+i*206,y=205;rr(ctx,x,y,196,126,18);ctx.fillStyle="#fff";ctx.fill();ctx.strokeStyle="#dbe7ff";ctx.stroke();ctx.fillStyle="#0639a6";ctx.font="bold 22px sans-serif";ctx.fillText(it[0],x+16,y+32);ctx.fillStyle="#111b63";ctx.font="bold 20px sans-serif";t(ctx,it[1],x+16,y+70,164,24,2);ctx.fillStyle="#667395";ctx.font="14px sans-serif";t(ctx,it[2],x+16,y+105,164,16,2)});let promoY=350;rr(ctx,32,promoY,480,96,18);ctx.fillStyle="#fff5f5";ctx.fill();ctx.strokeStyle="#ffd7d7";ctx.stroke();ctx.fillStyle="#e4251a";ctx.font="bold 24px sans-serif";ctx.fillText(s.discounts.schoolPromoTitle,56,promoY+34);ctx.fillStyle="#17214d";ctx.font="17px sans-serif";t(ctx,s.discounts.schoolPromoText,56,promoY+64,430,20,2);rr(ctx,534,promoY,514,96,18);ctx.fillStyle="#f7f9ff";ctx.fill();ctx.strokeStyle="#dbe7ff";ctx.stroke();ctx.fillStyle="#0639a6";ctx.font="bold 24px sans-serif";ctx.fillText(set.agencyAdvantageTitle,558,promoY+34);ctx.font="18px sans-serif";ctx.fillText(`✓ ${set.agencyAdvantageLine1}`,558,promoY+65);ctx.fillText(`✓ ${set.agencyAdvantageLine2}`,558,promoY+90);let px=32,py=470,pw=500,ph=520;rr(ctx,px,py,pw,ph,20);ctx.fillStyle="#fff";ctx.fill();ctx.strokeStyle="#dbe7ff";ctx.stroke();ctx.fillStyle="#0639a6";rr(ctx,px,py,pw,54,20);ctx.fill();ctx.fillStyle="#fff";ctx.font="bold 23px sans-serif";ctx.fillText("费用一：学费 & 住宿费（美元）",px+20,py+35);let usd=buildUsdRows(c,s);drawRows(ctx,["项目","说明","金额","备注"],usd,44,py+70,pw-24,39);ctx.fillStyle="#fff";ctx.fillRect(48,py+ph-70,pw-32,52);ctx.fillStyle="#0639a6";ctx.font="bold 27px sans-serif";ctx.fillText("费用一合计：",64,py+ph-35);ctx.fillStyle="#e4251a";ctx.font="bold 36px sans-serif";ctx.fillText(`${Math.round(c.totalUsd).toLocaleString()} 美元`,250,py+ph-35);let gx=548;rr(ctx,gx,py,pw,ph,20);ctx.fillStyle="#fff";ctx.fill();ctx.strokeStyle="#dbe7ff";ctx.stroke();ctx.fillStyle="#0b7a48";rr(ctx,gx,py,pw,54,20);ctx.fill();ctx.fillStyle="#fff";ctx.font="bold 23px sans-serif";ctx.fillText("费用二：到校支付费用（披索）",gx+20,py+35);let php=c.localItems.slice(0,10).map(it=>[it.name.replace("（超过59天必须办理）",""),it.perWeek?`${it.amount}PHP/周`:(isBooksName(it.name)?"按周数设置":"固定费用"),Math.round(it.total??it.amount).toLocaleString(),it.excluded?"不含合计":(it.note||"")]);drawRows(ctx,["项目","说明","金额","备注"],php,560,py+70,pw-24,36);ctx.fillStyle="#fff";ctx.fillRect(564,py+ph-70,pw-32,52);ctx.fillStyle="#0b7a48";ctx.font="bold 27px sans-serif";ctx.fillText("费用二合计：",580,py+ph-35);ctx.font="bold 33px sans-serif";ctx.fillText(`${Math.round(c.localPeso).toLocaleString()} PHP`,770,py+ph-35);let sy=1016;rr(ctx,32,sy,1016,286,24);ctx.fillStyle="#fbfdff";ctx.fill();ctx.strokeStyle="#dbe7ff";ctx.stroke();ctx.fillStyle="#0639a6";ctx.textAlign="center";ctx.font="bold 34px sans-serif";ctx.fillText("本次游学总计（以实际汇率为准）",W/2,sy+48);ctx.textAlign="left";let by=sy+78;[["美元部分",`${Math.round(c.totalUsd).toLocaleString()} USD × ${set.usdRate}`,rmb(c.tuitionRmb),"#0639a6"],["披索部分",`${Math.round(c.localPeso).toLocaleString()} PHP × ${set.pesoRate}`,rmb(c.localRmb),"#0b7a48"]].forEach((b,i)=>{let x=60+i*386;rr(ctx,x,by,300,112,20);ctx.fillStyle="#fff";ctx.fill();ctx.strokeStyle="#dbe7ff";ctx.stroke();ctx.fillStyle=b[3];ctx.font="bold 20px sans-serif";ctx.fillText(b[0],x+26,by+38);ctx.fillStyle="#17214d";ctx.font="15px sans-serif";ctx.fillText(b[1],x+26,by+66);ctx.fillStyle=b[3];ctx.font="bold 22px sans-serif";ctx.fillText(b[2],x+26,by+94)});ctx.fillStyle="#0639a6";ctx.font="bold 44px sans-serif";ctx.fillText("+",384,by+70);ctx.fillText("≈",800,by+70);ctx.fillStyle="#e4251a";ctx.font="bold 54px sans-serif";ctx.fillText(`${Math.round(c.totalRmb).toLocaleString()}`,860,by+66);ctx.font="bold 24px sans-serif";ctx.fillText("人民币",900,by+100);rr(ctx,32,1332,1016,110,20);ctx.fillStyle="#fff7e8";ctx.fill();ctx.strokeStyle="#ffd98c";ctx.stroke();ctx.fillStyle="#17214d";ctx.font="bold 20px sans-serif";ctx.fillText(`选择 ${set.brandName}｜价格透明｜专业顾问｜安心服务`,58,1372);ctx.font="17px sans-serif";ctx.fillText("备注：菲律宾本地费用只做参考，最终以学校实际收取为准。宿舍押金、接机费不含。",58,1410);let wmText=set.watermarkText||set.brandName||"超能游学";ctx.save();ctx.globalAlpha=.075;ctx.translate(W/2,H/2);ctx.rotate(-Math.PI/6);for(let yy=-2200;yy<=2200;yy+=105){for(let xx=-1800;xx<=1800;xx+=180){if(logo){ctx.drawImage(logo,xx,yy-16,28,28)}ctx.fillStyle="#0639a6";ctx.font="bold 20px sans-serif";ctx.fillText(wmText,xx+34,yy+4)}}ctx.restore();let a=document.createElement("a");a.download=`${s.name}-${s.campus}-${c.weeks}周-报价单.png`;a.href=canvas.toDataURL("image/png");a.click()}
function renderRecords(){$("recordsList").innerHTML=data.records.length?data.records.map((r,i)=>`<div class="list-item"><div><b>${r.title}</b><br/><span class="muted">${r.createdAt}</span></div><div class="list-actions"><button onclick="navigator.clipboard.writeText(data.records[${i}].text)">复制</button><button class="danger" onclick="deleteRecord(${i})">删除</button></div></div>`).join(""):`<p class="muted">暂无报价记录</p>`}function deleteRecord(i){data.records.splice(i,1);saveData();renderRecords()}
function renderSchoolList(){$("schoolList").innerHTML=data.schools.map(s=>`<div class="list-item"><div><b>${s.name} ${s.campus}</b><br/><span class="muted">${s.courses.length}个课程 / ${s.rooms.length}个房型</span></div><div class="list-actions"><button onclick="editSchool('${s.id}')">编辑</button><button class="danger" onclick="removeSchool('${s.id}')">删除</button></div></div>`).join("")}function editSchool(id){editingSchoolId=id;renderSchoolEditor();renderFeeEditor()}function removeSchool(id){if(data.schools.length<=1)return alert("至少保留一个学校");data.schools=data.schools.filter(s=>s.id!==id);selectedSchoolId=data.schools[0].id;editingSchoolId=selectedSchoolId;saveData();refreshAll()}
function field(label,id,value,type="text",ph=""){return `<label>${label}<input id="${id}" type="${type}" step="0.01" value="${html(value)}" placeholder="${ph}"/></label>`}function renderSchoolEditor(){let s=editingSchool();$("schoolEditor").innerHTML=`<div class="editor-grid">${field("学校名称","edName",s.name)}${field("校区","edCampus",s.campus)}${field("注册费","edReg",s.discounts.registrationFee,"number")}${field("淡季优惠/4周","edLow",s.discounts.lowSeasonDiscountPer4w,"number")}${field("学校淡季折扣比例","edSchoolRate",s.discounts.schoolLowSeasonDiscountRate,"number","1=无折扣 0.9=9折 0.5=5折")}${field("旺季附加/周","edPeak",s.discounts.peakFeePerWeek,"number")}${field("超能折扣比例","edAgency",s.discounts.agencyDiscountRate,"number")}${field("超能减免注册金金额","edWaive",s.discounts.registrationWaiverAmount,"number")}${field("12周长期优惠","edLong12",s.discounts.long12,"number")}${field("16周长期优惠","edLong16",s.discounts.long16,"number")}${field("20周长期优惠","edLong20",s.discounts.long20,"number")}${field("24周长期优惠","edLong24",s.discounts.long24,"number")}</div><div class="sub-box"><h3>该学校默认启用的优惠</h3><div class="editor-grid">${yesNo("默认启用淡季优惠","edLowEnabled",s.discounts.lowSeasonEnabled!==false)}${yesNo("默认启用学校淡季折扣","edSchoolRateEnabled",!!s.discounts.schoolLowSeasonRateEnabled)}${yesNo("默认启用旺季附加","edPeakEnabled",!!s.discounts.peakSeasonEnabled)}${yesNo("默认启用长期优惠","edLongEnabled",s.discounts.longDiscountEnabled!==false)}${yesNo("默认启用超能折扣","edAgencyEnabled",s.discounts.agencyDiscountEnabled!==false)}${yesNo("默认启用减免注册金","edWaiveEnabled",!!s.discounts.registrationWaiverEnabled)}</div><p class="muted">以后选择这个学校时，系统会自动切换到这些优惠，不需要手动勾选。</p></div><label>学校优惠标题<input id="edPromoTitle" value="${html(s.discounts.schoolPromoTitle)}"/></label><label>学校优惠说明<textarea id="edPromoText">${html(s.discounts.schoolPromoText)}</textarea></label><div class="sub-box"><h3>价格单智能导入（文本/CSV）</h3><p class="muted">支持 TXT / CSV / 复制出来的价格表文字。图片或PDF需要先用OCR提取文字再粘贴。</p><input type="file" id="priceFile" accept=".txt,.csv,.md,.html,.json,.pdf,image/*"/><textarea id="priceText" placeholder="把学校价格单文字粘贴到这里，例如：\nCG Banilad\nESL加强课 1对1 5节 团课1节 选修2节 750 USD\n3人间宿舍 700 USD"></textarea><div class="btn-row"><button onclick="importPriceText()">识别并导入到当前学校</button></div><div id="importResult" class="muted"></div></div><div class="sub-box"><h3>课程价格（每4周/美元）</h3><div id="courseEdit"></div><button onclick="addCourse()">添加课程</button></div><div class="sub-box"><h3>房型价格（每4周/美元）</h3><div id="roomEdit"></div><button onclick="addRoom()">添加房型</button></div><button onclick="saveSchoolEditor()">保存学校设置</button>`;let pf=$("priceFile");if(pf)pf.addEventListener("change",handlePriceFile);renderCourseRoomEdit()}
function renderCourseRoomEdit(){let s=editingSchool();$("courseEdit").innerHTML=s.courses.map((c,i)=>`<div class="list-item"><div class="editor-grid">${field("课程名",`cName${i}`,c.name)}${field("价格",`cPrice${i}`,c.price4w,"number")}${field("课程课时显示",`cLesson${i}`,courseLesson(c),"text","例如：1对1 4节，1对4 2节，选修课 2节")}<label>备注<input id="cNote${i}" value="${html(c.note||"")}"/></label></div><button class="danger" onclick="deleteCourse(${i})">删除</button></div>`).join("");$("roomEdit").innerHTML=s.rooms.map((r,i)=>`<div class="list-item"><div class="editor-grid">${field("房型",`rName${i}`,r.name)}${field("价格",`rPrice${i}`,r.price4w,"number")}</div><button class="danger" onclick="deleteRoom(${i})">删除</button></div>`).join("")}
function saveSchoolEditor(){let s=editingSchool();s.name=$("edName").value;s.campus=$("edCampus").value;Object.assign(s.discounts,{registrationFee:num($("edReg").value),lowSeasonDiscountPer4w:num($("edLow").value),schoolLowSeasonDiscountRate:num($("edSchoolRate").value),peakFeePerWeek:num($("edPeak").value),agencyDiscountRate:num($("edAgency").value),registrationWaiverAmount:num($("edWaive").value),long12:num($("edLong12").value),long16:num($("edLong16").value),long20:num($("edLong20").value),long24:num($("edLong24").value),schoolPromoTitle:$("edPromoTitle").value,schoolPromoText:$("edPromoText").value,lowSeasonEnabled:$("edLowEnabled").value==="true",schoolLowSeasonRateEnabled:$("edSchoolRateEnabled").value==="true",peakSeasonEnabled:$("edPeakEnabled").value==="true",longDiscountEnabled:$("edLongEnabled").value==="true",agencyDiscountEnabled:$("edAgencyEnabled").value==="true",registrationWaiverEnabled:$("edWaiveEnabled").value==="true"});s.courses=s.courses.map((c,i)=>({id:c.id,name:$(`cName${i}`).value,price4w:num($(`cPrice${i}`).value),note:$(`cNote${i}`).value,lessonText:$(`cLesson${i}`).value}));s.rooms=s.rooms.map((r,i)=>({id:r.id,name:$(`rName${i}`).value,price4w:num($(`rPrice${i}`).value)}));saveData();refreshAll();alert("已保存")}
function addCourse(){let s=editingSchool();s.courses.push({id:"course"+Date.now(),name:"新课程",price4w:0,note:"",lessonText:""});saveData();renderSchoolEditor()}function deleteCourse(i){let s=editingSchool();s.courses.splice(i,1);saveData();renderSchoolEditor()}function addRoom(){let s=editingSchool();s.rooms.push({id:"room"+Date.now(),name:"新房型",price4w:0});saveData();renderSchoolEditor()}function deleteRoom(i){let s=editingSchool();s.rooms.splice(i,1);saveData();renderSchoolEditor()}
function renderFeeEditor(){let s=editingSchool();s.bookFees=s.bookFees||{4:2500,8:4000,12:5500};s.visaFees=s.visaFees||{9:7500,12:10000,16:13000,20:16000};$("feeEditor").innerHTML=`<h3>${s.name} ${s.campus}</h3><p class="muted">规则：ACR I-Card 从第9周开始自动计算；宿舍押金、接机费只展示，不计入学杂费合计。</p><div class="sub-box"><h3>预估教材费 Books（按周数）</h3><div class="editor-grid">${field("4周教材费","book4",s.bookFees[4]||0,"number")}${field("8周教材费","book8",s.bookFees[8]||0,"number")}${field("12周教材费","book12",s.bookFees[12]||0,"number")}</div><p class="muted">1-4周用4周金额，5-8周用8周金额，9周以上用12周金额。</p></div><div class="sub-box"><h3>签证延期 Visa Extension（按周数自动切换）</h3><div class="editor-grid">${field("第9周起金额","visa9",s.visaFees?.[9]||0,"number")}${field("第12周起金额","visa12",s.visaFees?.[12]||0,"number")}${field("第16周起金额","visa16",s.visaFees?.[16]||0,"number")}${field("第20周起金额","visa20",s.visaFees?.[20]||0,"number")}</div><p class="muted">1-8周自动为0；9-11周用第9周金额；12-15周用第12周金额；16-19周用第16周金额；20周及以上用第20周金额。</p></div><div class="editor-grid">${s.localFees.map((f,i)=>`${field(f.name,`fee${i}`,f.amount,"number")}<label>计算方式<select id="feeType${i}"><option value="fixed" ${!f.perWeek?"selected":""}>固定费用</option><option value="week" ${f.perWeek?"selected":""}>按周计算</option></select></label>`).join("")}</div><div class="sub-box"><h3>官方 Total 覆盖（可选）</h3><p class="muted">如果学校给了某个周数的本地费用总额，可以填这里。建议填写“不含宿舍押金/接机”的学杂费合计。填 0 表示不用覆盖。</p><div class="editor-grid">${[4,8,12,16,20,24].map(w=>field(`${w}周 Total`,`total${w}`,s.officialTotals?.[w]||0,"number")).join("")}</div></div><button onclick="saveFees()">保存本地费用</button>`}function saveFees(){let s=editingSchool();s.bookFees={4:num($("book4").value),8:num($("book8").value),12:num($("book12").value)};s.visaFees={9:num($("visa9").value),12:num($("visa12").value),16:num($("visa16").value),20:num($("visa20").value)};s.localFees=s.localFees.map((f,i)=>({...f,amount:num($(`fee${i}`).value),perWeek:$(`feeType${i}`).value==="week"}));[4,8,12,16,20,24].forEach(w=>{s.officialTotals[w]=num($(`total${w}`).value)});saveData();renderCalc();alert("已保存")}
function renderSettings(){
  let set=data.settings,cfg=getCloudConfig();
  $("settingsEditor").innerHTML=`<div class="editor-grid">${field("品牌中文","setBrand",set.brandName)}${field("品牌英文","setBrandEn",set.brandEn)}${field("美金汇率","setUsd",set.usdRate,"number")}${field("披索汇率","setPeso",set.pesoRate,"number")}${field("水印文字","setWatermark",set.watermarkText)}<label>是否开启网页水印（下载图片默认强制显示）<select id="setWatermarkEnabled"><option value="true" ${set.watermarkEnabled?"selected":""}>开启</option><option value="false" ${!set.watermarkEnabled?"selected":""}>关闭</option></select></label>${field("优势标题","setAdvTitle",set.agencyAdvantageTitle)}${field("优势1","setAdv1",set.agencyAdvantageLine1)}${field("优势2","setAdv2",set.agencyAdvantageLine2)}${field("管理员密码","setAdminPassword",set.adminPassword||"SuperStudy888","text","员工不知道这个密码就只能看到自动报价")}<label>上传 Logo<input type="file" id="logoUpload" accept="image/*"/></label></div><img class="logo-preview" src="${set.brandLogo}"/><div class="btn-row"><button onclick="saveSettings()">保存系统设置</button></div>
  <div class="sub-box cloud-box"><h3>V6 云端同步（Supabase）</h3><p class="muted">开启后，你在后台修改学校、价格、优惠、本地费用，员工手机会读取同一份云端数据。</p><div class="editor-grid"><label>是否开启云端同步<select id="cloudEnabled"><option value="true" ${cfg.enabled?"selected":""}>开启</option><option value="false" ${!cfg.enabled?"selected":""}>关闭</option></select></label>${field("Supabase Project URL","cloudUrl",cfg.url||"","text","例如：https://xxxx.supabase.co")}${field("Supabase anon public key","cloudKey",cfg.anonKey||"","text","Supabase API Settings 里的 anon public key")}${field("数据表名","cloudTable",cfg.table||"super_study_data","text")}${field("数据ID","cloudRow",cfg.rowId||"main","text")}</div><div class="btn-row"><button onclick="saveCloudSettings()">保存云端配置</button><button onclick="uploadCloudData(false)">上传本地数据到云端</button><button onclick="loadCloudData(false)">从云端拉取数据</button><button onclick="copyCloudShareLink()">复制员工云端同步链接</button></div><div id="cloudStatus" class="cloud-status">${cfg.enabled?"云端同步已开启":"云端同步未开启"}</div><p class="muted">第一次设置：先保存云端配置 → 上传本地数据到云端 → 复制员工云端同步链接发给员工。</p></div>`;
  $("logoUpload").addEventListener("change",e=>{let file=e.target.files[0];if(!file)return;let r=new FileReader();r.onload=()=>{data.settings.brandLogo=r.result;saveData();refreshAll()};r.readAsDataURL(file)})
}
function saveSettings(){let set=data.settings;set.brandName=$("setBrand").value;set.brandEn=$("setBrandEn").value;set.usdRate=num($("setUsd").value);set.pesoRate=num($("setPeso").value);set.watermarkText=$("setWatermark").value;set.watermarkEnabled=$("setWatermarkEnabled").value==="true";set.agencyAdvantageTitle=$("setAdvTitle").value;set.agencyAdvantageLine1=$("setAdv1").value;set.agencyAdvantageLine2=$("setAdv2").value;set.adminPassword=$("setAdminPassword").value||"SuperStudy888";saveData();refreshAll();alert("已保存")}

const ADMIN_SESSION_KEY = "super-study-admin-session-v5";

function isAdminMode(){
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
}

function activateTab(tab){
  if(!isAdminMode() && tab !== "quote"){
    tab = "quote";
  }
  document.querySelectorAll(".nav").forEach(b=>b.classList.remove("active"));
  const nav = document.querySelector(`.nav[data-tab="${tab}"]`);
  if(nav) nav.classList.add("active");
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("show"));
  const target = $("tab-"+tab);
  if(target) target.classList.add("show");
}

function applyRoleMode(){
  const admin = isAdminMode();
  document.body.classList.toggle("admin-mode", admin);
  document.body.classList.toggle("employee-mode", !admin);
  const roleHint = $("roleHint");
  if(roleHint){
    roleHint.textContent = admin ? "管理员模式：可查看全部功能" : "员工模式：仅可自助报价";
  }
  if(!admin){
    activateTab("quote");
  }
}

function adminLogin(){
  const password = prompt("请输入管理员密码");
  if(password === null) return;
  const realPassword = data.settings.adminPassword || "SuperStudy888";
  if(password === realPassword){
    sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
    applyRoleMode();
    refreshAll();
    alert("已进入管理员模式");
  }else{
    alert("管理员密码错误");
  }
}

function adminLogout(){
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  applyRoleMode();
  alert("已退出管理员模式");
}

function refreshAll(){renderSelectors();renderCalc();renderRecords();renderSchoolList();renderSchoolEditor();renderFeeEditor();renderSettings();$("sideLogo").src=data.settings.brandLogo}function init(){applyCloudConfigFromUrl();document.querySelectorAll(".nav").forEach(btn=>btn.addEventListener("click",()=>activateTab(btn.dataset.tab)));["schoolSelect","courseSelect","roomSelect","weeksSelect","startDateSelect","lowSeason","schoolRate","peakSeason","longDiscount","agencyDiscount","waiveRegistration"].forEach(id=>$(id)?.addEventListener("change",()=>{if(id==="schoolSelect"){selectedSchoolId=$("schoolSelect").value;renderSelectors()}renderCalc()}));$("adminLoginBtn").onclick=adminLogin;$("adminLogoutBtn").onclick=adminLogout;applyRoleMode();$("copyWechat").onclick=async()=>{await navigator.clipboard.writeText(wechatText());alert("已复制微信报价")};$("saveRecord").onclick=()=>{if(!isAdminMode()) return alert("员工模式不能保存记录");let c=calc();data.records.unshift({title:`${c.school.name} ${c.school.campus} ${c.weeks}周 ${Math.round(c.totalRmb).toLocaleString()}元`,text:wechatText(),createdAt:new Date().toLocaleString()});saveData();renderRecords();alert("已保存")};$("downloadImage").onclick=downloadImage;$("printPdf").onclick=()=>window.print();$("addSchool").onclick=()=>{let id="school"+Date.now();data.schools.push({id,name:"新学校",campus:"校区",courses:[{id:"course"+Date.now(),name:"ESL",price4w:0,note:"",lessonText:""}],rooms:[{id:"room"+Date.now(),name:"单人间",price4w:0}],discounts:{...defaultData.schools[0].discounts},localFees:feeTemplate.map(([name,amount,perWeek])=>({name,amount,perWeek})),officialTotals:{},bookFees:{4:2500,8:4000,12:5500},visaFees:{9:7500,12:10000,16:13000,20:16000}});selectedSchoolId=id;editingSchoolId=id;saveData();refreshAll()};$("backupBtn").onclick=()=>{let blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="超能游学报价系统数据备份.json";a.click()};$("importData").onchange=e=>{let file=e.target.files[0];if(!file)return;let r=new FileReader();r.onload=()=>{try{data=normalize(JSON.parse(r.result));saveData();selectedSchoolId=data.schools[0].id;editingSchoolId=selectedSchoolId;refreshAll();alert("导入成功")}catch(err){alert("导入失败")}};r.readAsText(file)};$("resetBtn").onclick=()=>{if(confirm("确定恢复默认？本浏览器保存的数据会清空。")){localStorage.removeItem(STORAGE_KEY);data=clone(defaultData);selectedSchoolId=data.schools[0].id;editingSchoolId=selectedSchoolId;refreshAll()}};refreshAll();applyRoleMode();autoLoadCloudData()}init();
