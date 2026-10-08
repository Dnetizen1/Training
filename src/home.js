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
// Тренер — круглая «аватарка» с фиолетовым облачком, как кнопка чата в референсе
const CoachBtn=({onClick})=>html`<button class="ab-coach" aria-label="Спросить тренера" onClick=${onClick}><svg width="26" height="22" viewBox="0 0 26 22" aria-hidden="true">
  <path d="M4 1h18a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H11l-5 4v-4H4a3 3 0 0 1-3-3V4a3 3 0 0 1 3-3z" style=${{fill:"var(--ink)"}}/>
  <circle cx="8.5" cy="9" r="1.4" style=${{fill:"var(--bg)"}}/><circle cx="13" cy="9" r="1.4" style=${{fill:"var(--bg)"}}/><circle cx="17.5" cy="9" r="1.4" style=${{fill:"var(--bg)"}}/></svg></button>`;
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
    ${pts.length>1?html`<polyline points=${pts.map((p,i)=>X(i)+","+Y(p.v)).join(" ")} fill="none" stroke="#05AA8E" stroke-width="1.6" stroke-linejoin="round"/>`:null}
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

// Прогресс — по экрану «Дневник» референса
function HomeView({date,setDate,day,go,openHistory,openSession,openAsk,openBody}){
  const [page,setPage]=useState(0);
  const s=getSession(date,day), w=weekData(date), days=weekDays(date);
  const rows=s.ex.reduce((a,e)=>a+rowsOf(s,e),0), doneSets=s.ex.reduce((a,e)=>a+Math.min(doneOf(e),rowsOf(s,e)),0);
  const started=hasData(s);
  const prs=sessions().filter(x=>x.date<=date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).flatMap(sessionPRs).slice(0,3);
  const lifts=[...new Set(ORDER.map(k=>P[k].ex[0][0]))].map(n=>({name:n,h:exerciseHistory(n)})).filter(x=>x.h.length);
  const main=lifts.slice().sort((a,b)=>b.h.length-a.h.length||b.h[b.h.length-1].date.localeCompare(a.h[a.h.length-1].date))[0];
  const body=Object.values(S.data).filter(v=>v&&v.kind==="body"&&num(v.w)!==null).sort((a,b)=>a.date.localeCompare(b.date));
  const mus=w.used.slice().sort((a,b)=>w.plan[b]-w.plan[a]).slice(0,5);
  const R=54.5, C=2*Math.PI*R, rp=rows?doneSets/rows:0;
  const bw=body.length?num(body[body.length-1].w):null, bw0=body.length?num(body[0].w):null, waist=body.slice().reverse().find(x=>num(x.waist)!==null);
  const avg=main?main.h.reduce((a,x)=>a+x.best,0)/main.h.length:0;
  return html`<div class="home">
    <section class="hero">
      <${AppBar} left=${html`<${CoachBtn} onClick=${openAsk}/>`} title="Прогресс" right=${html`<${AbIcon} n="sliders" label="Вес и замеры" onClick=${openBody}/>`}/>
      <div class="datenav">
        <button class="dn-a" aria-label="Предыдущий день" onClick=${()=>setDate(shiftDate(date,-1))}><${Icon} n="left" size=${18}/></button>
        <label class="dn-l"><span>${navDate(date)}</span><input type="date" value=${date} aria-label="Сменить дату" onChange=${ev=>ev.target.value&&setDate(ev.target.value)}/></label>
        <button class="dn-a" aria-label="Следующий день" onClick=${()=>setDate(shiftDate(date,1))}><${Icon} n="right" size=${18}/></button>
      </div>
      <div class="pager" onScroll=${ev=>{ const el=ev.currentTarget, k=Math.round(el.scrollLeft/el.clientWidth); if(k!==page) setPage(k); }}>
        <div class="page">
          <div class="kpi">
            <div class="kcol"><b>${rows}</b><span>план</span></div>
            <button class="kring" onClick=${()=>go("train")} aria-label=${"Сделано подходов: "+doneSets+" из "+rows+". Открыть тренировку"}>
              <svg viewBox="0 0 118 118" aria-hidden="true"><circle cx="59" cy="59" r=${R} class="kr-bg"/>
                ${rp>0?html`<circle cx="59" cy="59" r=${R} class="kr-fg" style=${{strokeDasharray:C,strokeDashoffset:C*(1-rp)}} transform="rotate(-90 59 59)"/>`:null}</svg>
              <span><b>${doneSets}</b><small>подходов</small></span>
            </button>
            <div class="kcol"><b>${Math.max(0,rows-doneSets)}</b><span>осталось</span></div>
          </div>
          <div class="tri">
            ${[["Тренировки",w.done,4,""],["Подходы",w.dSets,w.pSets,""],["Мышцы",w.full.length,w.used.length,""]].map(([l,v,m])=>html`<div key=${l} class="tri-c">
              <span>${l}</span><${Meter} v=${v} max=${m}/><b>${fmt(v)} <em>/ ${fmt(m)}</em></b></div>`)}
          </div>
        </div>
        <div class="page plist2">
          ${mus.length?mus.map(m=>html`<div key=${m} class="pl2">
            <div class="pl2-h"><span>${MUS[m]}</span><b>${fmt(Math.round(w.fact[m]*4)/4)} <em>/ ${fmt(Math.round(w.plan[m]*4)/4)} подх.</em></b></div>
            <${Meter} v=${w.fact[m]} max=${w.plan[m]} color="var(--blue)"/></div>`):html`<p class="st">На этой неделе ещё нет плана по мышцам.</p>`}
        </div>
      </div>
      <div class="dots" aria-hidden="true"><i class=${page===0?"on":""}></i><i class=${page===1?"on":""}></i></div>
      ${date!==todayStr()?html`<button class="linkbtn today-back" onClick=${()=>setDate(todayStr())}>Вернуться к сегодня</button>`:null}
    </section>

    <${SecHead} title="Тренировки недели" onClick=${()=>go("week")}/>
    <div class="dgrid">${days.map(d=>{ const badge=d.real?dm(d.real.date):d.k===day&&date===todayStr()?"сегодня":"";
      return html`<button key=${d.k} class="dtile" onClick=${()=>openSession(d.real?d.real.date:date,d.k)}>
        <span class="dt-h"><span>${P[d.k].name}</span>${badge?html`<em class="tbadge">${badge}</em>`:null}</span>
        <b>${d.done}</b><small>из ${d.rows} подходов</small>
        <span class="dt-img" style=${{"--c":PC[d.k]}} aria-hidden="true"><${Icon} n="dumbbell" size=${26}/></span>
      </button>`; })}</div>
    <button class="capsule home-cta" onClick=${()=>go("train")}>${s.done?"Посмотреть итог":started?"Продолжить тренировку":"Начать тренировку"} · ${P[day].name}</button>

    ${main?html`<${SecHead} title="Динамика" onClick=${()=>openHistory(main.name)}/>
    <div class="ccard">
      <div class="cc-h"><span>${main.name}</span><span class="mute">1ПМ, кг</span></div>
      <span class="cc-s">В среднем: ${fmt(Math.round(avg*10)/10)}</span>
      <${LineChart} pts=${main.h.slice(-8).map(x=>({x:dm(x.date),v:x.best}))}/>
    </div>`:null}

    ${prs.length?html`<${SecHead} title="Рекорды"/>
    <div class="rows">${prs.map((r,k)=>html`<button key=${k} class="rowc" onClick=${()=>openHistory(r.name)}>
        <span class="rc-i">${I_TROPHY}</span>
        <span class="lmain"><b>${r.name}</b><small>${dm(r.date)} · ${r.w?fmt(num(r.w))+" кг × ":""}${r.r} · 1ПМ ≈ ${kgf(r.v)} кг</small></span>
        <${Icon} n="right" size=${16}/></button>`)}</div>`:null}

    <${SecHead} title="Цели"/>
    <button class="gcard" onClick=${openBody}>
      <span class="gc-h"><span>Вес</span><${Icon} n="right" size=${16}/></span>
      <b class="gc-v">${bw!==null?fmt(bw)+" кг":"Внести вес"}</b>
      ${bw!==null?html`<span class="gc-r"><span>Начальный вес<br/><b>${fmt(bw0)} кг</b></span><span>Записей<br/><b>${body.length}</b></span></span>
      <span class="gc-cells">
        <span><small>Изменение</small><b>${(bw-bw0>0?"+":"")+fmt(Math.round((bw-bw0)*10)/10)} кг</b></span>
        <span><small>Талия</small><b>${waist?fmt(num(waist.waist))+" см":"–"}</b></span>
      </span>`:html`<span class="gc-r"><span>Мерь утром, натощак, в одинаковых условиях</span></span>`}
    </button>
    <div class="rows mt8"><button class="rowc" onClick=${openBody}><${Icon} n="ruler" size=${22}/><span class="lmain"><b>Замеры тела</b></span><${Icon} n="right" size=${20}/></button></div>
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
  const [hideTip,setHideTip]=useState(false);
  const days=weekDays(ref);
  return html`<div class="weekscr">
    <section class="hero hero-top">
      <div class="appbar left">
        <h1>Неделя</h1>
        <label class="pillsel"><${Icon} n="cal" size=${16}/><span>${mode==="prev"?"Прошлая":"Эта неделя"}</span><${Icon} n="down" size=${14}/>
          <select aria-label="Период" value=${mode} onChange=${ev=>setMode(ev.target.value)}><option value="now">Эта неделя</option><option value="prev">Прошлая</option></select></label>
      </div>
    </section>
    <div class="blacksheet">
    <div class="statline"><b>Подходы: ${w.dSets} / ${w.pSets}</b><span>${dayMonth(w.ws)} – ${dayMonth(w.we)}</span></div>
    <div class="ccard">
      <span class="cc-s">По дням, сделано подходов</span>
      <div class="dbars">${days.map(d=>html`<div key=${d.k} class="dbar">
        <span class="db-t"><i style=${{height:(d.rows?Math.min(1,d.done/d.rows)*100:0)+"%"}}></i></span>
        <b>${d.done}/${d.rows}</b><small><${Plate} k=${d.k}/>${P[d.k].name}</small></div>`)}</div>
    </div>
    <div class="statline"><b>Эффективные подходы</b><span>Цель: 10–16</span></div>
    <section class="ccard eff2">
      ${!groups.length?html`<p class="st">Пока нет данных.</p>`:groups.map(([g,rs])=>html`<div key=${g} class="effg">
        <span class="effg-t">${g}</span>
        ${rs.map(r=>{ const target=Math.min(10,r.plan||10), ok=r.v>=target-0.01; return html`<div key=${r.m} class="pl2">
          <div class="pl2-h"><span>${MUS[r.m]}${ok?html`<i class="okdot" title="В норме"></i>`:null}</span><b>${fmt(Math.round(r.v*4)/4)} / ${fmt(target)}</b></div>
          <span class="meter"><i style=${{width:Math.min(100,r.v/max*100)+"%",background:r.v>max?"var(--pink)":"var(--accf)"}}></i><em style=${{left:(target/max*100)+"%"}}></em></span>
        </div>`; })}
      </div>`)}
      ${zero?html`<button class="linkbtn effmore" onClick=${()=>setAll(!all)}>${all?"Скрыть мышцы без подходов":"Ещё без подходов: "+zero}</button>`:null}
      <div class="efflg"><span><i style=${{background:"var(--accf)"}}></i>сделано</span><span><i class="okdot"></i>норма набрана</span><span><i class="tick"></i>нижняя граница нормы</span></div>
    </section>
    ${tip&&!hideTip?html`<section class="banner">
      <div class="bn-h"><b>${MUS[tip.m]} отстаёт</b><button class="ibtn" aria-label="Скрыть" onClick=${()=>setHideTip(true)}><${Icon} n="close" size=${18}/></button></div>
      <span>${fmt(Math.round(tip.fact*4)/4)} из ${fmt(Math.round(tip.plan*4)/4)} подходов за неделю.${tip.mod?" Тренер предлагает +"+tip.mod.n+" подх. «"+P[tip.mod.day].ex[tip.mod.base][0]+"» в "+P[tip.mod.day].name+".":" В оставшихся тренировках этой недели нет подходящего упражнения."}</span>
      ${tip.mod?(sent?html`<span class="mute">Добавлено в план</span>`:html`<button class="capsule sm" onClick=${()=>{ addMods([tip.mod]); toast({text:"Добавлено в план: "+P[tip.mod.day].name}); }}>Добавить в план</button>`):null}
    </section>`:null}
    <details class="grp more">
      <summary class="grp-row"><span><${Icon} n="list" size=${16}/>Подробно по дням</span><${Icon} n="right" size=${16}/></summary>
      <${WeekView} date=${ref} embedded=${true}/>
    </details>
    </div>
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
