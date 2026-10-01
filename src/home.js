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

// Сводка — по экрану «Сводка» макета
function HomeView({date,setDate,day,go,openHistory,openSession,toast}){
  const [bodyOpen,setBodyOpen]=useState(false);
  const s=getSession(date,day), w=weekData(date);
  const rows=s.ex.reduce((a,e)=>a+rowsOf(s,e),0), doneSets=s.ex.reduce((a,e)=>a+Math.min(doneOf(e),rowsOf(s,e)),0);
  const started=hasData(s);
  const prs=sessions().filter(x=>x.date<=date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).flatMap(sessionPRs).slice(0,3);
  const lifts=[...new Set(ORDER.map(k=>P[k].ex[0][0]))].map(n=>({name:n,h:exerciseHistory(n)})).filter(x=>x.h.length);
  const main=lifts.slice().sort((a,b)=>b.h[b.h.length-1].date.localeCompare(a.h[a.h.length-1].date))[0];
  const body=Object.values(S.data).filter(v=>v&&v.kind==="body"&&num(v.w)!==null).sort((a,b)=>a.date.localeCompare(b.date));
  const topSet=h=>h.sets.reduce((b,x)=>e1rm(x.w,x.r)>e1rm(b.w,b.r)?x:b,h.sets[0]);
  return html`<div class="home">
    <header class="large">
      <h1>Прогресс</h1>
      <label class="datepick"><span>${longDate(date)}</span><${Icon} n="down" size=${16}/>
        <input type="date" value=${date} aria-label="Сменить дату" onChange=${ev=>ev.target.value&&setDate(ev.target.value)}/></label>
      ${date!==todayStr()?html`<button class="linkbtn today-back" onClick=${()=>setDate(todayStr())}>Вернуться к сегодня</button>`:null}
    </header>

    <section class="card today">
      <div class="card-h"><span class="card-t acc">${date===todayStr()?"Тренировка сегодня":"Тренировка "+dm(date)}</span></div>
      <div class="today-main">
        <${Rings} size=${76} stroke=${10} label=${"Сделано подходов: "+doneSets+" из "+rows} rings=${[{p:rows?doneSets/rows:0,color:"var(--acc)",track:"var(--acc-track)"}]}/>
        <div class="today-txt">
          <b>${P[day].name}</b>
          <span>${s.ex.length} упражнений · ${rows} подходов</span>
          <small>${s.done?"Тренировка завершена":started?"Сделано "+doneSets+" из "+rows+" подходов":"Ещё не начата"}</small>
        </div>
      </div>
      <ul class="plist">${s.ex.slice(0,3).map(e=>{ const inf=xinfo(s,e); return html`<li key=${e.uid}><span>${inf.name}</span><span class="num">${rowsOf(s,e)} × ${inf.plan.lo}–${inf.plan.hi}</span></li>`; })}</ul>
      ${s.ex.length>3?html`<span class="card-s">и ещё ${s.ex.length-3} упражнения</span>`:null}
      <button class="cta" onClick=${()=>go("train")}>${s.done?"Посмотреть итог":started?"Продолжить тренировку":"Начать тренировку"}</button>
    </section>

    <h2 class="sec">Эта неделя</h2>
    <button class="card week-card" onClick=${()=>go("week")} aria-label="Открыть неделю">
      <${Rings} size=${112} stroke=${11} label="Кольца недели" rings=${[
        {p:w.done/4,color:"var(--acc)",track:"var(--acc-track)"},
        {p:w.pSets?w.dSets/w.pSets:0,color:"var(--grn)",track:"var(--grn-track)"},
        {p:w.used.length?w.full.length/w.used.length:0,color:"var(--pur)",track:"var(--pur-track)"}]}/>
      <dl class="ringlegend">
        <div><dt>Тренировки</dt><dd class="num" style=${{color:"var(--acc)"}}>${w.done}/4</dd></div>
        <div><dt>Подходы</dt><dd class="num" style=${{color:"var(--grn)"}}>${w.dSets}/${w.pSets}</dd></div>
        <div><dt>Объём набран</dt><dd class="num" style=${{color:"var(--pur)"}}>${w.full.length}/${w.used.length} мышц</dd></div>
      </dl>
    </button>

    ${main?html`<h2 class="sec">Динамика</h2>
    <button class="card prog" onClick=${()=>openHistory(main.name)}>
      <div class="card-h"><span class="card-t">${main.name}</span><span class="card-s">${main.h.length} ${main.h.length===1?"тренировка":main.h.length<5?"тренировки":"тренировок"}</span></div>
      <div class="prog-row">
        <div class="prog-n"><b class="big">${topSet(main.h[main.h.length-1]).w?fmt(num(topSet(main.h[main.h.length-1]).w)):"б/в"}</b><span>${topSet(main.h[main.h.length-1]).w?"кг × ":"× "}${topSet(main.h[main.h.length-1]).r}</span></div>
        <${Spark} values=${main.h.map(x=>x.best)} w=${150} h=${44}/>
      </div>
    </button>`:null}

    ${prs.length?html`<h2 class="sec">Рекорды</h2>
    <div class="card list">${prs.map((r,k)=>html`<button key=${k} class="lrow" onClick=${()=>openHistory(r.name)}>
        <span class="badge">${I_TROPHY}</span>
        <span class="lmain"><b>${r.name}</b><small>${dm(r.date)} · ${r.w?fmt(num(r.w))+" кг × ":""}${r.r} · 1ПМ ≈ ${kgf(r.v)} кг</small></span>
        <${Icon} n="right" size=${18}/></button>`)}</div>`:null}

    <h2 class="sec">Вес и замеры</h2>
    <div class="tiles4 bodytiles">
      <button onClick=${()=>setBodyOpen(true)}><span>Вес</span><b class="big">${body.length?fmt(num(body[body.length-1].w)):"–"}<small> кг</small></b>
        <small class="bt-s">${body.length?dm(body[body.length-1].date)+(body.length>1?" · "+(num(body[body.length-1].w)-num(body[0].w)>=0?"+":"")+fmt(Math.round((num(body[body.length-1].w)-num(body[0].w))*10)/10)+" кг":""):"Нажми, чтобы внести"}</small></button>
      <button onClick=${()=>setBodyOpen(true)}><span>Замеры</span><b class="big">${body.length}</b>
        <small class="bt-s">${body.length?"записей · добавить":"Добавить первый"}</small></button>
    </div>
    ${bodyOpen?html`<${BodySheet} toast=${toast} onClose=${()=>setBodyOpen(false)}/>`:null}
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
  const [mode,setMode]=useState("now"), [all,setAll]=useState(false);
  const d=new Date(date+"T00:00:00"); if(mode==="prev") d.setDate(d.getDate()-7);
  const ref=d.toLocaleDateString("sv-SE"), w=weekData(ref), tip=mode==="now"?lagTip(date):null;
  // мезоцикл: среднее в неделю по неделям, где были тренировки
  let rows=MUS_ORDER.map(m=>({m,v:w.fact[m],plan:w.plan[m]}));
  const max=16;
  const zero=rows.filter(r=>r.plan>0&&!(r.v>0)).length;
  const groups=MUS_GROUPS.map(([g,ks])=>[g,rows.filter(r=>ks.includes(r.m)&&(r.v>0||(all&&r.plan>0)))]).filter(g=>g[1].length);
  const sent=tip&&tip.mod&&modsList(tip.mod.day).some(x=>x.type==="add_sets"&&x.base===tip.mod.base&&x.reason===tip.mod.reason);
  return html`<div class="weekscr">
    <header class="large">
      <span class="eyebrow">${dayMonth(w.ws)} – ${dayMonth(w.we)}</span>
      <h1>${mode==="prev"?"Прошлая неделя":"Эта неделя"}</h1>
    </header>
    <div class="seg3" role="group" aria-label="Период">
      ${[["now","Эта неделя"],["prev","Прошлая"]].map(([k,l])=>html`<button key=${k} aria-pressed=${String(mode===k)} onClick=${()=>setMode(k)}>${l}</button>`)}
    </div>
    <section class="card eff">
      <div class="card-h"><span class="card-t">Эффективные подходы</span><span class="card-s">цель 10–16</span></div>
      ${!groups.length?html`<p class="st">Пока нет данных.</p>`:groups.map(([g,rs])=>html`<div key=${g} class="effg">
        <span class="effg-t">${g}</span>
        ${rs.map(r=>{ const target=Math.min(10,r.plan||10), ok=r.v>=target-0.01; return html`<div key=${r.m} class="effr">
          <span>${MUS[r.m]}</span>
          <span class="effb"><i style=${{width:Math.min(100,r.v/max*100)+"%",background:ok?"var(--grn)":"var(--acc)"}}></i></span>
          <b class="num">${fmt(Math.round(r.v*4)/4)}</b>
        </div>`; })}
      </div>`)}
      ${zero?html`<button class="linkbtn effmore" onClick=${()=>setAll(!all)}>${all?"Скрыть мышцы без подходов":"Ещё без подходов: "+zero}</button>`:null}
      <div class="efflg"><span><i style=${{background:"var(--acc)"}}></i>ниже нормы</span><span><i style=${{background:"var(--grn)"}}></i>в норме</span></div>
    </section>
    ${tip?html`<section class="card tip">
      <span class="tip-i">${I_SPARK}</span>
      <div class="tip-b">
        <b>${MUS[tip.m]} отстаёт</b>
        <span>${fmt(Math.round(tip.fact*4)/4)} из ${fmt(Math.round(tip.plan*4)/4)} подходов за неделю.${tip.mod?" Тренер предлагает +"+tip.mod.n+" подх. «"+P[tip.mod.day].ex[tip.mod.base][0]+"» в "+P[tip.mod.day].name+".":" В оставшихся тренировках этой недели нет подходящего упражнения."}</span>
        ${tip.mod?(sent?html`<span class="mute">Добавлено в план</span>`:html`<button class="softbtn" onClick=${()=>{ addMods([tip.mod]); toast({text:"Добавлено в план: "+P[tip.mod.day].name}); }}>Добавить в план</button>`):null}
      </div>
    </section>`:null}
    <details class="grp more">
      <summary class="grp-row">Подробно по дням</summary>
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
