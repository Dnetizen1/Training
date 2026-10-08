/* Вкладка «Сводка» (как Summary в Apple Health / Fitness) и экран «История упражнения». */

// Концентрические кольца: rings = [{p: 0..1, color, track}], снаружи внутрь
function Rings({size,stroke,rings,label}){
  const c=size/2;
  return html`<svg class="rings" width=${size} height=${size} viewBox=${"0 0 "+size+" "+size} role="img" aria-label=${label}>
    ${rings.map((r,k)=>{ const rad=c-stroke/2-k*(stroke+3), C=2*Math.PI*rad, p=Math.max(0,Math.min(1,r.p||0));
      return html`<g key=${k}><circle cx=${c} cy=${c} r=${rad} fill="none" stroke=${r.track} stroke-width=${stroke}/>
        ${p>0?html`<circle cx=${c} cy=${c} r=${rad} fill="none" stroke=${r.color} stroke-width=${stroke} stroke-linecap="round" stroke-dasharray=${C} stroke-dashoffset=${C*(1-p)} transform=${"rotate(-90 "+c+" "+c+")"}/>`:null}</g>`; })}
  </svg>`;
}
// Мини-график: values — числа по порядку, последняя точка выделена
function Spark({values,w,h,big}){
  w=w||140; h=h||40; const pad=big?10:5;
  if(!values.length) return null;
  const lo=Math.min(...values), hi=Math.max(...values), span=hi-lo||1;
  const pts=values.map((v,i)=>[values.length>1?pad+i*(w-2*pad)/(values.length-1):w/2, h-pad-(v-lo)/span*(h-2*pad)]);
  const last=pts[pts.length-1];
  return html`<svg class="spark" width=${w} height=${h} viewBox=${"0 0 "+w+" "+h} aria-hidden="true">
    ${pts.length>1?html`<polyline points=${pts.map(p=>p.join(",")).join(" ")} fill="none" stroke="var(--acc)" stroke-width=${big?3:2.5} stroke-linecap="round" stroke-linejoin="round"/>`:null}
    ${big?pts.slice(0,-1).map((p,i)=>html`<circle key=${i} cx=${p[0]} cy=${p[1]} r="3.5" fill="var(--acc)"/>`):null}
    <circle cx=${last[0]} cy=${last[1]} r=${big?6:4.5} fill="var(--acc)"/>
  </svg>`;
}
const RU_DAYS=["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
const RU_MONTHS=["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const dayMonth=d=>{ const t=new Date(d+"T00:00:00"); return t.getDate()+" "+RU_MONTHS[t.getMonth()]; };
const longDate=d=>{ const t=new Date(d+"T00:00:00"); return RU_DAYS[t.getDay()]+", "+t.getDate()+" "+RU_MONTHS[t.getMonth()]; };
const kgf=v=>fmt(Math.round(v*2)/2);

// Сводка недели: тренировки, подходы, мышцы с набранным объёмом
function weekData(date){
  const wk=weekFromDate(date), ws=weekStart(date), we=weekEnd(date);
  const inWeek=sessions().filter(x=>x.date>=ws&&x.date<=we);
  const plan=MUS.map(()=>0), fact=MUS.map(()=>0); let pSets=0, dSets=0, done=0;
  ORDER.forEach(k=>{ const real=inWeek.filter(x=>x.day===k).sort((a,b)=>b.date.localeCompare(a.date))[0], s=real||defSession(k);
    const cnt=e=>real?rowsOf(s,e):setsFor(xinfo(s,e).plan.ns,wk);
    muscleCount(s,cnt).forEach((c,m)=>{ plan[m]+=c.f; }); pSets+=s.ex.reduce((a,e)=>a+cnt(e),0); });
  inWeek.forEach(x=>{ muscleCount(x,doneOf).forEach((c,m)=>{ fact[m]+=c.f; }); dSets+=x.ex.reduce((a,e)=>a+doneOf(e),0); if(hasData(x)) done++; });
  const used=MUS_ORDER.filter(m=>plan[m]>0), full=used.filter(m=>fact[m]>=plan[m]-0.01);
  return {wk,ws,we,plan,fact,pSets,dSets,done:Math.min(done,4),used,full};
}

// Шапка экрана по референсу: слева круглая кнопка, по центру заголовок (и подпись), справа действие
function AppBar({left,title,sub,onTitle,right,label}){
  const t=html`<b>${title}</b>${sub?html`<small>${sub}</small>`:null}`;
  return html`<div class="appbar">
    <div class="ab-side">${left}</div>
    ${onTitle?html`<button class="ab-t" onClick=${onTitle} aria-label=${label}>${t}<${Icon} n="down" size=${14}/></button>`:html`<div class="ab-t"><h1>${title}</h1>${sub?html`<small>${sub}</small>`:null}</div>`}
    <div class="ab-side r">${right}</div>
  </div>`;
}
// Тренер — белая круглая кнопка с иконкой чата, как кнопка настроек справа
const CoachBtn=({onClick})=>html`<button class="ab-coach" aria-label="Спросить тренера" onClick=${onClick}><${Icon} n="chat" size=${22}/></button>`;
const AbIcon=({n,label,onClick})=>html`<button class="ab-i" aria-label=${label} onClick=${onClick}><${Icon} n=${n} size=${20}/></button>`;
const SecHead=({title,onClick,children})=>onClick
  ?html`<button class="sec2" onClick=${onClick}><span>${title}</span>${children}<${Icon} n="right" size=${18}/></button>`
  :html`<h2 class="sec2"><span>${title}</span>${children}</h2>`;
// Полоса «значение / норма». Сверх нормы — как в референсе: полоса полная, а розовый отрезок в начале показывает долю перебора
const Meter=({v,max,color})=>{ const p=max?v/max:0, ex=p>1.001?Math.min(1,p-1):0;
  return html`<span class="meter"><i style=${{width:Math.min(100,p*100)+"%",background:color||"var(--accf)"}}></i>${ex?html`<i class="ex" style=${{width:Math.max(4,ex*100)+"%"}}></i>`:null}</span>`; };
const shiftDate=(d,n)=>{ const t=new Date(d+"T00:00:00"); t.setDate(t.getDate()+n); return t.toLocaleDateString("sv-SE"); };
const navDate=d=>{ const t=todayStr(), w=d===t?"Сегодня":d===shiftDate(t,-1)?"Вчера":d===shiftDate(t,1)?"Завтра":RU_DAYS[new Date(d+"T00:00:00").getDay()]; return w+", "+dayMonth(d); };
// Линейный график на тёмной карточке: сетка, подписи осей, точка на последнем значении
function LineChart({pts,w,h}){
  w=w||340; h=h||160; const L=30,R=14,T=16,B=22;
  // «круглый» шаг сетки (1, 2, 5, 10…), чтобы подписи оси не повторялись
  const vs=pts.map(p=>p.v), lo0=Math.min(...vs), hi0=Math.max(...vs), raw=Math.max(1,(hi0-lo0)/3), mag=Math.pow(10,Math.floor(Math.log10(raw)));
  const step=[1,2,5,10].map(k=>k*mag).find(x=>x>=raw), lo=Math.floor(lo0/step)*step-(hi0===lo0?step*2:0), hi=lo+step*4<hi0?Math.ceil(hi0/step)*step:lo+step*4;
  const ys=Array.from({length:Math.round((hi-lo)/step)+1},(_,k)=>lo+k*step);
  const X=i=>pts.length>1?L+i*(w-L-R)/(pts.length-1):(L+w-R)/2, Y=v=>T+(h-T-B)*(1-(v-lo)/(hi-lo||1));
  const last=pts.length-1, every=Math.ceil(pts.length/6);
  return html`<svg class="lchart" viewBox=${"0 0 "+w+" "+h} role="img" aria-label=${"График: последнее значение "+fmt(Math.round(vs[last]))}>
    ${ys.map((v,k)=>html`<g key=${k}><line x1=${L} x2=${w-R} y1=${Y(v)} y2=${Y(v)} stroke="var(--grid)" stroke-width=".6"/><text x=${L-6} y=${Y(v)+3} text-anchor="end">${fmt(Math.round(v))}</text></g>`)}
    ${pts.map((p,i)=>i%every===0||i===last?html`<text key=${i} x=${X(i)} y=${h-6} text-anchor="middle">${p.x}</text>`:null)}
    ${pts.length>1?html`<polyline points=${pts.map((p,i)=>X(i)+","+Y(p.v)).join(" ")} fill="none" stroke="var(--teal)" stroke-width="1.6" stroke-linejoin="round"/>`:null}
    <text x=${X(last)} y=${Y(vs[last])-9} text-anchor="middle" class="lc-v">${fmt(Math.round(vs[last]*10)/10)}</text>
    <circle cx=${X(last)} cy=${Y(vs[last])} r="4" fill="var(--teal)"/>
  </svg>`;
}
// Плитки дней недели: как «Приёмы пищи» в референсе
function weekDays(date){
  const wk=weekFromDate(date), ws=weekStart(date), we=weekEnd(date);
  const inWeek=sessions().filter(x=>x.date>=ws&&x.date<=we);
  return ORDER.map(k=>{ const real=inWeek.filter(x=>x.day===k).sort((a,b)=>b.date.localeCompare(a.date))[0], s=real||defSession(k);
    const rows=real?s.ex.reduce((a,e)=>a+rowsOf(s,e),0):s.ex.reduce((a,e)=>a+setsFor(xinfo(s,e).plan.ns,wk),0);
    const done=real?s.ex.reduce((a,e)=>a+Math.min(doneOf(e),rowsOf(s,e)),0):0;
    return {k,real,rows,done}; });
}

// Простой график тренда: две линии сетки, линия, точка на последнем значении, подписи первого и последнего
function TrendChart({vals,unit,w,h}){
  w=w||350; h=h||100; const pad=8, lo=Math.min(...vals), hi=Math.max(...vals), span=hi-lo||1;
  const X=i=>vals.length>1?pad+i*(w-2*pad)/(vals.length-1):w/2, Y=v=>h-22-(v-lo)/span*(h-44);
  const last=vals.length-1;
  return html`<svg class="trend" viewBox=${"0 0 "+w+" "+h} role="img" aria-label=${"С "+fmt(Math.round(vals[0]))+" до "+fmt(Math.round(vals[last]))+" "+unit}>
    <line x1="0" x2=${w} y1=${Y(hi)} y2=${Y(hi)} class="tr-g"/><line x1="0" x2=${w} y1=${Y(lo)} y2=${Y(lo)} class="tr-g"/>
    ${vals.length>1?html`<polyline points=${vals.map((v,i)=>X(i)+","+Y(v)).join(" ")} class="tr-l"/>`:null}
    <circle cx=${X(last)} cy=${Y(vals[last])} r="5" class="tr-d"/>
    <text x="0" y=${h-4} class="tr-t">${fmt(Math.round(vals[0]))} ${unit}</text>
    <text x=${w} y=${Math.max(12,Y(vals[last])-10)} text-anchor="end" class="tr-t tr-v">${fmt(Math.round(vals[last]))} ${unit}</text>
  </svg>`;
}
const WDS=["вс","пн","вт","ср","чт","пт","сб"];
// Прогресс: сверху сегодняшняя тренировка (всегда сегодня), ниже неделя кольцами, график, рекорды, вес
function HomeView({date,setDate,day,go,openHistory,openSession,openAsk,openBody}){
  const w=weekData(date), days=weekDays(date);
  const today=todayStr(), onToday=date===today, tday=onToday?day:defaultDay(today), ts=getSession(today,tday);
  const rows=ts.ex.reduce((a,e)=>a+rowsOf(ts,e),0), doneSets=ts.ex.reduce((a,e)=>a+Math.min(doneOf(e),rowsOf(ts,e)),0);
  const thisWeek=weekStart(date)===weekStart(today);
  const prs=sessions().filter(x=>x.date<=today).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).flatMap(sessionPRs).slice(0,3);
  const lifts=[...new Set(ORDER.map(k=>P[k].ex[0][0]))].map(n=>({name:n,h:exerciseHistory(n)})).filter(x=>x.h.length);
  const main=lifts.slice().sort((a,b)=>b.h.length-a.h.length||b.h[b.h.length-1].date.localeCompare(a.h[a.h.length-1].date))[0];
  const mh=main?main.h.slice(-8).filter(x=>x.best>0):[], gain=mh.length>1?Math.round((mh[mh.length-1].best-mh[0].best)*2)/2:0;
  const body=Object.values(S.data).filter(v=>v&&v.kind==="body"&&num(v.w)!==null).sort((a,b)=>a.date.localeCompare(b.date));
  const bw=body.length?num(body[body.length-1].w):null, bw0=body.length?num(body[0].w):null, waist=body.slice().reverse().find(x=>num(x.waist)!==null);
  const cur=ts.ex.findIndex(e=>doneOf(e)<rowsOf(ts,e));
  const goToday=()=>{ if(!onToday) setDate(today); go("train"); };
  return html`<div class="home">
    <section class="thero" style=${{"--c":PC[tday]}}>
      <div class="th-top">
        <${CoachBtn} onClick=${openAsk}/>
        <span>Сегодня, ${WDS[new Date(today+"T00:00:00").getDay()]} ${dayMonth(today)}</span>
        <${AbIcon} n="sliders" label="Вес и замеры" onClick=${openBody}/>
      </div>
      <button class="th-day" onClick=${goToday}>${P[tday].name}</button>
      ${ts.ex.length?html`<div class="th-bar"><${Barbell} s=${ts} day=${tday} cur=${cur} onPick=${goToday}/>
        <span class="th-cnt"><b>${doneSets}/${rows}</b><small>подходов</small></span></div>`:null}
      <button class="th-go" onClick=${goToday}>${ts.done?"Посмотреть итог":hasData(ts)?"Продолжить":"Начать тренировку"}</button>
    </section>

    <div class="wk-h">
      <button class="sec2" onClick=${()=>go("week")}><span>${thisWeek?"Неделя":dayMonth(w.ws)+" – "+dayMonth(w.we)}</span><em class="wk-n">${w.dSets} из ${w.pSets}</em></button>
      <span class="wk-nav">
        <button class="dn-a" aria-label="Прошлая неделя" onClick=${()=>setDate(shiftDate(date,-7))}><${Icon} n="left" size=${18}/></button>
        <button class="dn-a" aria-label="Следующая неделя" disabled=${thisWeek} onClick=${()=>setDate(shiftDate(date,7))}><${Icon} n="right" size=${18}/></button>
      </span>
    </div>
    ${!thisWeek?html`<button class="linkbtn today-back" onClick=${()=>setDate(today)}>К этой неделе</button>`:null}
    <div class="wrings">${days.map(d=>{ const lbl=d.real?(d.real.date===today?"сегодня":WDS[new Date(d.real.date+"T00:00:00").getDay()])+" · ":"";
      return html`<button key=${d.k} class="wr" onClick=${()=>openSession(d.real?d.real.date:today,d.k)} aria-label=${P[d.k].name+": "+d.done+" из "+d.rows}>
        <${Rings} size=${56} stroke=${7} rings=${[{p:d.rows?d.done/d.rows:0,color:PC[d.k],track:"var(--fill)"}]} label=""/>
        <b>${P[d.k].name}</b><small>${lbl}${d.done}/${d.rows}</small></button>`; })}</div>

    ${main&&mh.length>1?html`<div class="tr-h"><button class="sec2" onClick=${()=>openHistory(main.name)}><span>${main.name}</span></button>
      <span class=${gain>0?"tr-up":gain<0?"tr-dn":"mute"}>${gain?(gain>0?"+":"")+fmt(gain)+" кг 1ПМ":"без изменений"}</span></div>
    <${TrendChart} vals=${mh.map(x=>x.best)} unit="кг"/>`:null}

    ${prs.length?html`<${SecHead} title="Рекорды"/>
    <div class="plist3">${prs.map((r,k)=>html`<button key=${k} onClick=${()=>openHistory(r.name)}>
        <span>${r.name}<small>${dm(r.date)}</small></span><b>${r.w?fmt(num(r.w))+" × ":""}${r.r}</b></button>`)}</div>`:null}

    <${SecHead} title="Вес"/>
    <button class="gcard" onClick=${openBody}>
      <b class="gc-v">${bw!==null?fmt(bw)+" кг":"Внести вес"}</b>
      ${bw!==null?html`<span class="gc-cells">
        <span><small>Изменение</small><b>${(bw-bw0>0?"+":"")+fmt(Math.round((bw-bw0)*10)/10)} кг</b></span>
        <span><small>Талия</small><b>${waist?fmt(num(waist.waist))+" см":"–"}</b></span>
      </span>`:html`<span class="gc-r"><span>Мерь утром, натощак, в одинаковых условиях</span></span>`}
    </button>
  </div>`;
}

// Неделя — по экрану «Неделя» макета
function lagTip(date){
  const w=weekData(date), ws=w.ws, we=w.we;
  const inWeek=sessions().filter(x=>x.date>=ws&&x.date<=we&&hasData(x));
  if(!inWeek.length) return null;
  const doneDays=new Set(inWeek.map(x=>x.day)), left=ORDER.filter(k=>!doneDays.has(k));
  // план только по уже проведённым дням: что из них не добрали
  const planDone=MUS.map(()=>0);
  ORDER.filter(k=>doneDays.has(k)).forEach(k=>{ const real=inWeek.filter(x=>x.day===k).sort((a,b)=>b.date.localeCompare(a.date))[0];
    muscleCount(real,e=>rowsOf(real,e)).forEach((c,m)=>{ planDone[m]+=c.f; }); });
  let best=null;
  MUS_ORDER.forEach(m=>{ const gap=planDone[m]-w.fact[m]; if(gap>=1&&(!best||gap>best.gap)) best={m,gap}; });
  if(!best) return null;
  const day=left.find(k=>P[k].ex.some((r,i)=>(LV[k][i][best.m]||0)>=7));
  const bi=day?P[day].ex.findIndex((r,i)=>(LV[day][i][best.m]||0)>=7):-1;
  const n=Math.min(2,Math.ceil(best.gap));
  return {m:best.m,fact:w.fact[best.m],plan:w.plan[best.m],gap:best.gap,
    mod:day?{id:rid(),day,type:"add_sets",base:bi,n,from:inWeek.map(x=>x.date).sort().slice(-1)[0],reason:`не добрано ${fmt(best.gap)} подх. на «${MUS[best.m]}»`}:null};
}
function WeekScreen({date,toast}){
  const [mode,setMode]=useState("now");
  const d=new Date(date+"T00:00:00"); if(mode==="prev") d.setDate(d.getDate()-7);
  const ref=d.toLocaleDateString("sv-SE"), w=weekData(ref), tip=mode==="now"?lagTip(date):null;
  // плитки — только основные мышцы (по плану недели от 4 подходов): набрано / цель (10 или сколько даёт программа).
  // «Недобор» — в завершённых тренировках этой недели (идущая сегодня не считается) по плану было больше подходов, чем сделано.
  const inWeek=sessions().filter(x=>x.date>=w.ws&&x.date<=w.we&&hasData(x)&&(x.done||x.date<todayStr())), doneDays=new Set(inWeek.map(x=>x.day)), planDone=MUS.map(()=>0);
  ORDER.filter(k=>doneDays.has(k)).forEach(k=>{ const real=inWeek.filter(x=>x.day===k).sort((a,b)=>b.date.localeCompare(a.date))[0];
    muscleCount(real,e=>rowsOf(real,e)).forEach((c,m)=>{ planDone[m]+=c.f; }); });
  const q4=v=>fmt(Math.round(v*4)/4);
  const tiles=w.used.filter(m=>w.plan[m]>=4).map(m=>{ const target=Math.min(10,w.plan[m]), v=w.fact[m], gap=Math.round((planDone[m]-v)*2)/2;
    return {m,v,target,p:v/target,ok:v>=target-0.01,gap:gap>=1?gap:0}; }).sort((a,b)=>(b.gap>0)-(a.gap>0)||(a.ok-b.ok)||a.p-b.p);
  const minor=w.used.filter(m=>w.plan[m]<4);
  const nOk=tiles.filter(x=>x.ok).length, nLow=tiles.filter(x=>x.gap).length, left=4-w.done;
  const sent=tip&&tip.mod&&modsList(tip.mod.day).some(x=>x.type==="add_sets"&&x.base===tip.mod.base&&x.reason===tip.mod.reason);
  const [hideTip,setHideTip]=useState(false);
  const ru=(n,a,b,c)=>{ const k=n%100>10&&n%100<20?c:n%10===1?a:n%10>=2&&n%10<=4?b:c; return n+" "+k; };
  return html`<div class="weekscr">
    <section class="hero hero-top">
      <div class="appbar left">
        <h1>Неделя</h1>
        <label class="pillsel"><${Icon} n="cal" size=${16}/><span>${mode==="prev"?"Прошлая":"Эта неделя"}</span><${Icon} n="down" size=${14}/>
          <select aria-label="Период" value=${mode} onChange=${ev=>setMode(ev.target.value)}><option value="now">Эта неделя</option><option value="prev">Прошлая</option></select></label>
      </div>
      <p class="wk-sum">${dayMonth(w.ws)} – ${dayMonth(w.we)} · ${w.dSets} из ${w.pSets} подходов.<br/>
        ${[nOk?ru(nOk,"мышца","мышцы","мышц")+" в норме":"",nLow?"у "+ru(nLow,"мышцы","мышц","мышц")+" недобор":""].filter(Boolean).join(", ").replace(/^./,c=>c.toUpperCase())}${nOk||nLow?". ":""}${mode==="now"&&left>0?"Осталось "+ru(left,"тренировка","тренировки","тренировок")+".":""}</p>
    </section>
    ${!tiles.length?html`<p class="st">На этой неделе ещё нет плана по мышцам.</p>`:html`<div class="mtiles">${tiles.map(x=>html`<div key=${x.m} class=${"mtile"+(x.ok?" ok":"")}
        aria-label=${MUS[x.m]+": "+q4(x.v)+" из "+fmt(x.target)+(x.ok?", норма":"")+(x.gap?", недобор "+fmt(x.gap):"")}>
        <i style=${{height:Math.min(100,x.p*100)+"%"}}></i><span>${MUS[x.m]}</span>${x.gap?html`<em>недобор ${fmt(x.gap)}</em>`:null}
        <b>${q4(x.v)}${x.ok?null:html`<small> / ${fmt(x.target)}</small>`}</b></div>`)}</div>
      <p class="mnote">Подходы за неделю против цели: 10 или сколько даёт программа. Зелёная плитка — цель набрана. «Недобор» — в прошедших тренировках сделано меньше, чем было по плану.</p>
      ${minor.length?html`<p class="mnote">Второстепенные: ${minor.map(m=>MUS[m]+" "+q4(w.fact[m])).join(" · ")}</p>`:null}`}
    ${tip&&!hideTip?html`<section class="banner">
      <div class="bn-h"><b>${MUS[tip.m]} отстаёт</b><button class="ibtn" aria-label="Скрыть" onClick=${()=>setHideTip(true)}><${Icon} n="close" size=${18}/></button></div>
      <span>${fmt(Math.round(tip.fact*4)/4)} из ${fmt(Math.round(tip.plan*4)/4)} подходов за неделю.${tip.mod?" Тренер предлагает +"+tip.mod.n+" подх. «"+P[tip.mod.day].ex[tip.mod.base][0]+"» в "+P[tip.mod.day].name+".":" В оставшихся тренировках этой недели нет подходящего упражнения."}</span>
      ${tip.mod?(sent?html`<span class="mute">Добавлено в план</span>`:html`<button class="capsule sm" onClick=${()=>{ addMods([tip.mod]); toast({text:"Добавлено в план: "+P[tip.mod.day].name}); }}>Добавить в план</button>`):null}
    </section>`:null}
    <details class="grp more">
      <summary class="grp-row"><span><${Icon} n="list" size=${16}/>Подробно по дням</span><${Icon} n="right" size=${16}/></summary>
      <${WeekView} date=${ref} embedded=${true}/>
    </details>
  </div>`;
}
const I_SPARK=html`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>`;
const I_TROPHY=html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/></svg>`;

// История упражнения: график расчётного 1ПМ и все тренировки
function ExerciseHistory({name,onClose}){
  const h=exerciseHistory(name);
  return html`<${Sheet} title=${name} onClose=${onClose}>
    ${!h.length?html`<div class="st">Это упражнение ещё не записано ни в одной тренировке.</div>`:html`
      <div class="hist-chart">
        <div class="hist-top"><span class="card-s">Расчётный 1ПМ</span><b class="num">${kgf(h[h.length-1].best)} кг</b></div>
        <${Spark} values=${h.map(x=>x.best)} w=${320} h=${110} big=${true}/>
        <div class="hist-ax"><span>${dm(h[0].date)}</span><span>${dm(h[h.length-1].date)}</span></div>
      </div>
      <div class="menu">${h.slice().reverse().map((x,k)=>{ return html`<div key=${k} class="mitem hrow">
        <span class="lmain"><b>${dmy(x.date)} · ${P[x.day]?P[x.day].name:""}</b><small class="num">${x.sets.map(y=>(y.w?fmt(num(y.w))+"×":"")+y.r+(y.q?" ·"+y.q:"")).join("   ")}</small></span>
        <span class="num hbest">${kgf(x.best)}</span></div>`; })}</div>
      <div class="st">1ПМ по формуле Эпли: вес × (1 + повторы / 30). Нужен, чтобы сравнивать подходы с разным числом повторов.</div>`}
  <//>`;
}
