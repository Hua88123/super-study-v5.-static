import sharp from "sharp";

function esc(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function money(v){ return Math.round(Number(v||0)).toLocaleString(); }
function fit(s, n=34){ s=String(s||""); return s.length>n ? s.slice(0,n-1)+"…" : s; }
function wrapText(s, max=26, maxLines=3){
  s=String(s||"").replace(/\r/g,"");
  const out=[];
  for(const p of s.split("\n")){
    let line="";
    for(const ch of p){
      if((line+ch).length>max){ out.push(line); line=ch; if(out.length>=maxLines) return out; }
      else line+=ch;
    }
    if(line) out.push(line);
    if(out.length>=maxLines) return out;
  }
  return out.length?out:[""];
}
function textLines(lines,x,y,opt={}){
  const size=opt.size||22, fill=opt.fill||"#17214d", weight=opt.weight||400, lh=opt.lh||Math.round(size*1.35);
  return lines.map((t,i)=>`<text x="${x}" y="${y+i*lh}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(t)}</text>`).join("");
}
function card(x,y,w,h,label,main,sub){
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#fff" stroke="#dbe7ff"/>
  <text x="${x+12}" y="${y+24}" font-size="15" font-weight="700" fill="#0639a6">${esc(label)}</text>
  ${textLines(wrapText(main,14,2),x+12,y+51,{size:16,weight:700,fill:"#111b63",lh:20})}
  ${sub?textLines(wrapText(sub,18,2),x+12,y+h-26,{size:11,fill:"#667395",lh:14}):""}`;
}
function tableSvg(headers, rows, x, y, w, title, color="#0639a6"){
  const col=[w*.25,w*.35,w*.19,w*.21];
  let svg=`<rect x="${x}" y="${y}" width="${w}" height="44" rx="14" fill="${color}"/>
  <text x="${x+16}" y="${y+29}" font-size="20" font-weight="700" fill="#fff">${esc(title)}</text>`;
  y+=54;
  svg+=`<rect x="${x}" y="${y}" width="${w}" height="34" fill="#f5f8ff"/>`;
  let cx=x;
  headers.forEach((h,i)=>{
    svg+=`<rect x="${cx}" y="${y}" width="${col[i]}" height="34" fill="none" stroke="#dbe7ff"/>
      <text x="${cx+7}" y="${y+23}" font-size="13" font-weight="700" fill="#0639a6">${esc(h)}</text>`;
    cx+=col[i];
  });
  y+=34;
  rows.forEach((r,ri)=>{
    const h=34; cx=x;
    svg+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${ri%2?"#fbfdff":"#fff"}"/>`;
    r.forEach((cell,i)=>{
      const txt=fit(cell, i===0?16:i===1?20:i===3?14:10);
      svg+=`<rect x="${cx}" y="${y}" width="${col[i]}" height="${h}" fill="none" stroke="#dbe7ff"/>
        <text x="${cx+6}" y="${y+22}" font-size="12" font-weight="${i===2?700:400}" fill="${i===2?"#0639a6":"#17214d"}">${esc(txt)}</text>`;
      cx+=col[i];
    });
    y+=h;
  });
  return {svg,y};
}
export default async function handler(req,res){
  try{
    if(req.method!=="POST"){ res.statusCode=405; res.end("Method Not Allowed"); return; }
    let raw="";
    for await (const chunk of req) raw += chunk.toString("utf8");
    let body={};
    try{ body=JSON.parse(raw||"{}"); }catch(e){ body=Object.fromEntries(new URLSearchParams(raw)); }
    const q=typeof body.quote==="string"?JSON.parse(body.quote):body.quote||body;
    const filename=String(q.filename||"quote.png").replace(/[\\/:*?"<>|]/g,"-");

    const W=900, pad=22;
    const c=q.calc||{}, s=q.school||{}, set=q.settings||{};
    const usdRows=q.usdRows||[], phpRows=q.phpRows||[];
    const courseRows=q.courseRows||[], roomRows=q.roomRows||[];

    const courseH=Math.max(76, 38 + courseRows.length*42);
    const promoLines=Math.max(wrapText(s.promoText||"",36,6).length,2);
    const promoH=Math.max(92, 40 + promoLines*19);
    const tableH=Math.max(290, 44+54+34 + Math.max(usdRows.length,phpRows.length)*34 + 58);
    const H=170+116+courseH+promoH+tableH+150+70;

    let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    <defs>
      <pattern id="wm" width="230" height="145" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
        <text x="12" y="78" font-size="20" font-weight="700" fill="#0639a6" opacity="0.10">${esc(set.watermarkText||set.brandName||"超能游学")}</text>
      </pattern>
      <linearGradient id="head" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#eaf7ff"/><stop offset="60%" stop-color="#f7fbff"/><stop offset="100%" stop-color="#fff4c9"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#wm)"/>`;

    let y=pad;
    svg+=`<rect x="${pad}" y="${y}" width="${W-pad*2}" height="132" rx="22" fill="url(#head)"/>
      ${set.logo?`<image href="${esc(set.logo)}" x="${pad+16}" y="${y+18}" width="96" height="96" preserveAspectRatio="xMidYMid meet"/>`:""}
      <text x="${pad+130}" y="${y+46}" font-size="33" font-weight="800" fill="#0639a6">${esc(fit((s.name||"")+"-"+(s.campus||""),28))}</text>
      <text x="${pad+130}" y="${y+84}" font-size="28" font-weight="800" fill="#111b63">游学报价单（${esc(c.weeks||"")}周）</text>
      <rect x="${pad+130}" y="${y+98}" width="310" height="26" rx="13" fill="#0639a6"/>
      <text x="${pad+148}" y="${y+117}" font-size="14" font-weight="700" fill="#fff">${esc(fit(set.slogan||"透明报价 · 安心之选",28))}</text>`;
    y+=146;

    const gap=8, cardW=(W-pad*2-gap*4)/5;
    [
      ["学校",(s.name||"")+"-"+(s.campus||""),s.campus||""],
      ["时间",`${c.weeks||""}周`,`${c.startDate||""} 入学`],
      ["课程",c.courseName||"-","报名周数已列明"],
      ["房型",c.roomName||"-","住宿按所选房型"],
      ["注册金",`${money(c.regFee)}美元/人`,""]
    ].forEach((it,i)=>{svg+=card(pad+i*(cardW+gap),y,cardW,100,it[0],it[1],it[2])});
    y+=114;

    const leftW=540,rightW=W-pad*2-leftW-gap;
    svg+=`<rect x="${pad}" y="${y}" width="${leftW}" height="${courseH}" rx="16" fill="#fff" stroke="#dbe7ff"/>
      <text x="${pad+14}" y="${y+26}" font-size="17" font-weight="800" fill="#0639a6">具体课程课时</text>`;
    let cy=y+52;
    courseRows.forEach(r=>{
      svg+=`<text x="${pad+16}" y="${cy}" font-size="14" font-weight="700" fill="#111b63">${esc(fit(r.name,22))} ${esc(r.weeks)}周</text>
        <text x="${pad+210}" y="${cy}" font-size="13" fill="#44506f">${esc(fit(r.lesson||"以学校安排为准",42))}</text>`;
      cy+=34;
    });
    svg+=`<rect x="${pad+leftW+gap}" y="${y}" width="${rightW}" height="${courseH}" rx="16" fill="#fff" stroke="#dbe7ff"/>
      <text x="${pad+leftW+gap+14}" y="${y+26}" font-size="17" font-weight="800" fill="#0639a6">住宿安排</text>`;
    let ry=y+56;
    roomRows.forEach(r=>{svg+=`<text x="${pad+leftW+gap+16}" y="${ry}" font-size="14" font-weight="700" fill="#111b63">${esc(fit(r.name,18))} ${esc(r.weeks)}周</text>`; ry+=28;});
    y+=courseH+12;

    svg+=`<rect x="${pad}" y="${y}" width="${leftW}" height="${promoH}" rx="16" fill="#fff5f5" stroke="#ffd9d9"/>
      <text x="${pad+14}" y="${y+26}" font-size="16" font-weight="800" fill="#e4251a">${esc(s.promoTitle||"学校优惠")}</text>
      ${textLines(wrapText(s.promoText||"",43,6),pad+14,y+52,{size:13,fill:"#17214d",lh:18})}
      <rect x="${pad+leftW+gap}" y="${y}" width="${rightW}" height="${promoH}" rx="16" fill="#f7f9ff" stroke="#dbe7ff"/>
      <text x="${pad+leftW+gap+14}" y="${y+26}" font-size="16" font-weight="800" fill="#0639a6">${esc(set.advTitle||"超能游学优势")}</text>
      ${textLines([`✓ ${set.adv1||""}`,`✓ ${set.adv2||""}`],pad+leftW+gap+14,y+54,{size:13,fill:"#17214d",lh:20})}`;
    y+=promoH+12;

    let t1=tableSvg(["项目","说明","金额","备注"],usdRows,pad,y,(W-pad*2-gap)/2,"费用一：学费 & 住宿费（美元）","#0639a6");
    svg+=t1.svg;
    let t2=tableSvg(["项目","说明","金额","备注"],phpRows,pad+(W-pad*2-gap)/2+gap,y,(W-pad*2-gap)/2,"费用二：到校支付费用（披索）","#0b7a48");
    svg+=t2.svg;
    const tableBottom=Math.max(t1.y,t2.y);
    svg+=`<text x="${pad+225}" y="${tableBottom+34}" font-size="18" font-weight="800" fill="#0639a6">费用一合计：<tspan fill="#e4251a">${money(c.totalUsd)} 美元</tspan></text>
      <text x="${pad+(W-pad*2-gap)/2+gap+185}" y="${tableBottom+34}" font-size="18" font-weight="800" fill="#0b7a48">费用二合计：<tspan fill="#e4251a">${money(c.localPeso)} PHP</tspan></text>`;
    y=tableBottom+58;

    svg+=`<rect x="${pad}" y="${y}" width="${W-pad*2}" height="128" rx="18" fill="#fbfdff" stroke="#dbe7ff"/>
      <text x="${W/2}" y="${y+30}" text-anchor="middle" font-size="22" font-weight="800" fill="#0639a6">本次游学总计（以实际汇率为准）</text>
      <text x="${pad+46}" y="${y+75}" font-size="13" fill="#667395">美元部分</text>
      <text x="${pad+46}" y="${y+98}" font-size="20" font-weight="800" fill="#0639a6">${esc(c.tuitionRmb||"")}</text>
      <text x="${pad+278}" y="${y+88}" font-size="30" font-weight="800" fill="#0639a6">+</text>
      <text x="${pad+338}" y="${y+75}" font-size="13" fill="#667395">披索部分</text>
      <text x="${pad+338}" y="${y+98}" font-size="20" font-weight="800" fill="#0b7a48">${esc(c.localRmb||"")}</text>
      <text x="${pad+570}" y="${y+88}" font-size="30" font-weight="800" fill="#0639a6">≈</text>
      <text x="${pad+620}" y="${y+88}" font-size="34" font-weight="900" fill="#e4251a">${money(c.totalRmb)} 元</text>`;
    y+=142;

    svg+=`<rect x="${pad}" y="${y}" width="${W-pad*2}" height="52" rx="14" fill="#fff7e8" stroke="#ffdf9f"/>
      <text x="${pad+14}" y="${y+24}" font-size="13" font-weight="700" fill="#17214d">选择 ${esc(set.brandName||"超能游学")}｜价格透明｜专业顾问｜安心服务</text>
      <text x="${pad+14}" y="${y+43}" font-size="12" fill="#334">备注：菲律宾本地费用只做参考，最终以学校实际收取为准。宿舍押金、接机费不含。</text>
    </svg>`;

    const png = await sharp(Buffer.from(svg)).png({compressionLevel:9}).toBuffer();
    res.statusCode=200;
    res.setHeader("Content-Type","image/png");
    res.setHeader("Content-Disposition",`inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("Cache-Control","no-store");
    res.setHeader("Content-Length",String(png.length));
    res.end(png);
  }catch(err){
    res.statusCode=500;
    res.setHeader("Content-Type","text/plain; charset=utf-8");
    res.end("quote png failed: "+(err&&err.message?err.message:String(err)));
  }
}
