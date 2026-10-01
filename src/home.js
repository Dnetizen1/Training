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

function HomeView({date,day,go,openHistory}){
  const s=getSession(date,day), w=weekData(date);
  const rows=s.ex.reduce((a,e)=>a+rowsOf(s,e),0), doneSets=s.ex.reduce((a,e)=>a+Math.min(doneOf(e),rowsOf(s,e)),0);
  const prs=sessions().filter(x=>x.date<=date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).flatMap(sessionPRs).slice(0,4);
  const lifts=[...new Set(ORDER.map(k=>P[k].ex[0][0]))].map(n=>({name:n,h:exerciseHistory(n)})).filter(x=>x.h.length);
  const body=Object.values(S.data).filter(v=>v&&v.kind==="body"&&num(v.w)!==null).sort((a,b)=>a.date.localeCompare(b.date));
  const started=hasData(s);
  return html`<div class="home">
    <header class="large">
      <span class="eyebrow">${longDate(date)}</span>
      <h1>Сводка</h1>
    </header>

    <section class="card today">
      <div class="card-h"><span class="card-t acc">Тренировка сегодня</span><span class="card-s">Неделя ${w.wk} из 6 · ${WEEKS[w.wk]}</span></div>
      <div class="today-main">
        <${Rings} size=${76} stroke=${10} label=${"Сделано подходов: "+doneSets+" из "+rows} rings=${[{p:rows?doneSets/rows:0,color:"var(--acc)",track:"var(--acc-track)"}]}/>
        <div class="today-txt">
          <b>${P[day].name}</b>
          <span>${s.ex.length} упражнений · ${rows} подходов</span>
          <span>${s.done?"Завершена":started?"Сделано "+doneSets+" из "+rows+" подходов":"Цель: запас "+rirFor("3",w.wk)+" повтора"}</span>
        </div>
      </div>
      <ul class="plist">${s.ex.slice(0,3).map(e=>{ const inf=xinfo(s,e); return html`<li key=${e.uid}><span>${inf.name}</span><span class="num">${rowsOf(s,e)} × ${inf.plan.lo}–${inf.plan.hi}</span></li>`; })}</ul>
      ${s.ex.length>3?html`<span class="card-s">и ещё ${s.ex.length-3}</span>`:null}
      <button class="cta" onClick=${()=>go("train")}>${s.done?"Посмотреть итог":started?"Продолжить тренировку":"Начать тренировку"}</button>
    </section>

    <section>
      <h2 class="sec">Эта неделя</h2>
      <button class="card week-card" onClick=${()=>go("week")} aria-label="Открыть неделю">
        <${Rings} size=${116} stroke=${11} label="Кольца недели" rings=${[
          {p:w.done/4,color:"var(--acc)",track:"var(--acc-track)"},
          {p:w.pSets?w.dSets/w.pSets:0,color:"var(--grn)",track:"var(--grn-track)"},
          {p:w.used.length?w.full.length/w.used.length:0,color:"var(--pur)",track:"var(--pur-track)"}]}/>
        <dl class="ringlegend">
          <div><dt><i style=${{background:"var(--acc)"}}></i>Тренировки</dt><dd class="num">${w.done}<small>/4</small></dd></div>
          <div><dt><i style=${{background:"var(--grn)"}}></i>Подходы</dt><dd class="num">${w.dSets}<small>/${w.pSets}</small></dd></div>
          <div><dt><i style=${{background:"var(--pur)"}}></i>Объём набран</dt><dd class="num">${w.full.length}<small>/${w.used.length} мышц</small></dd></div>
        </dl>
      </button>
    </section>

    <section>
      <h2 class="sec">Рекорды</h2>
      <div class="card list">
        ${prs.length?prs.map((r,k)=>html`<button key=${k} class="lrow" onClick=${()=>openHistory(r.name)}>
            <span class="badge">${I_TROPHY}</span>
            <span class="lmain"><b>${r.name}</b><small>${dm(r.date)} · ${r.w?fmt(num(r.w))+" кг × ":""}${r.r} · 1ПМ ≈ ${kgf(r.v)} кг (+${kgf(r.v-r.prev)})</small></span>
            <${Icon} n="right" size=${18}/></button>`)
          :html`<p class="empty-row">Рекорд появится, когда побьёшь свой прошлый результат в упражнении. Считаем по расчётному 1ПМ, так что 60 × 10 лучше, чем 62,5 × 6.</p>`}
      </div>
    </section>

    ${lifts.length?html`<section>
      <h2 class="sec">Прогресс</h2>
      <div class="card list">${lifts.map(l=>{ const last=l.h[l.h.length-1], top=last.sets.reduce((b,x)=>e1rm(x.w,x.r)>e1rm(b.w,b.r)?x:b,last.sets[0]);
        return html`<button key=${l.name} class="lrow" onClick=${()=>openHistory(l.name)}>
          <span class="lmain"><b>${l.name}</b><small>${dm(last.date)} · ${top.w?fmt(num(top.w))+" кг × ":""}${top.r}</small></span>
          <${Spark} values=${l.h.map(x=>x.best)} w=${96} h=${34}/>
          <${Icon} n="right" size=${18}/></button>`; })}</div>
    </section>`:null}

    <section>
      <h2 class="sec">Тело</h2>
      <button class="card lrow solo" onClick=${()=>go("body")}>
        <span class="lmain"><b>Вес и замеры</b><small>${body.length?"Последний: "+fmt(num(body[body.length-1].w))+" кг, "+dm(body[body.length-1].date):"Пока нет замеров. Добавь вес утром натощак."}</small></span>
        ${body.length>1?html`<${Spark} values=${body.map(b=>num(b.w))} w=${96} h=${34}/>`:null}
        <${Icon} n="right" size=${18}/>
      </button>
    </section>
  </div>`;
}
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
