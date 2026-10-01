/* Вид «Фокус»: одно упражнение и один текущий подход на экране.
   Вес и повторы — крупные кнопки ±, без клавиатуры, предзаполнены по прошлому разу.
   Одна главная кнопка «Подход сделан», после неё — кольцо отдыха с превью следующего подхода. */

const W_STEP=2.5;
const nfmt=v=>{ const x=num(v); return x===null?"":String(Math.round(x*100)/100).replace(".",","); };

function RestRing({t,onShift,onStop,next}){
  const [,tick]=useState(0);
  useEffect(()=>{ const h=setInterval(()=>tick(x=>x+1),250); return ()=>clearInterval(h); },[t]);
  const total=Math.max(1,t.total||60), left=Math.max(0,Math.round((t.end-Date.now())/1000)), p=left/total;
  const R=88, C=2*Math.PI*R;
  return html`<section class=${"rest"+(left===0?" over":"")} aria-label="Отдых">
    <div class="ring">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r=${R} class="ring-bg"/>
        <circle cx="100" cy="100" r=${R} class="ring-fg" style=${{strokeDasharray:C,strokeDashoffset:C*(1-p)}}/>
      </svg>
      <div class="ring-c"><b class="big">${Math.floor(left/60)}:${String(left%60).padStart(2,"0")}</b><span>${left===0?"можно начинать":"отдых"}</span></div>
    </div>
    ${next?html`<div class="rest-next"><span>Дальше</span><b>${next}</b></div>`:null}
    <div class="rest-act">
      <button class="fbtn" onClick=${()=>onShift(-15)}>−15 с</button>
      <button class="fbtn" onClick=${()=>onShift(15)}>+15 с</button>
      <button class="fbtn main" onClick=${onStop}>${left===0?"Начать подход":"Пропустить"}</button>
    </div>
  </section>`;
}

function Stepper({label,value,unit,step,onChange,dec}){
  const [edit,setEdit]=useState(false);
  const v=num(value);
  const set=x=>onChange(x===null?"":String(Math.max(0,Math.round(x*100)/100)).replace(".",dec?",":"."));
  return html`<div class="stp">
    <span class="stp-l">${label}</span>
    <div class="stp-row">
      <button class="stp-b" aria-label=${"Меньше: "+label} onClick=${()=>set((v??0)-step)}><${Icon} n="minus" size=${26}/></button>
      ${edit?html`<input class="stp-in" autoFocus type="text" inputmode="decimal" value=${value} onChange=${ev=>onChange(ev.target.value)} onBlur=${()=>setEdit(false)} onKeyDown=${ev=>{ if(ev.key==="Enter") setEdit(false); }}/>`
        :html`<button class="stp-v" onClick=${()=>setEdit(true)} aria-label=${label+": "+(value||"не задано")+". Нажми, чтобы ввести"}><b class="big">${value===""?"–":nfmt(value)}</b><small>${unit}</small></button>`}
      <button class="stp-b" aria-label=${"Больше: "+label} onClick=${()=>set((v??0)+step)}><${Icon} n="plus" size=${26}/></button>
    </div>
  </div>`;
}

function FocusView({date,setDate,day,setDay,toast,timer,setTimer,openAsk,setUi}){
  const {s,edit,remove,setWeek,finish}=useSession(date,day,toast), wk=s.week;
  const [idx,setIdx]=useState(null), [sheet,setSheet]=useState(null), [panel,setPanel]=useState(null), [draft,setDraft]=useState(null);
  useEffect(()=>{ setIdx(null); setDraft(null); },[day,date]);
  const open=s.ex.findIndex(e=>curSet(s,e)>=0);
  const i=idx!=null&&idx<s.ex.length?idx:(open>=0?open:Math.max(0,s.ex.length-1));
  const e=s.ex[i];
  const allDone=s.ex.length>0&&open<0;
  const go=k=>{ setIdx(Math.max(0,Math.min(s.ex.length-1,k))); setDraft(null); };

  // текущий подход и значения по умолчанию: этот подход → прошлый подход сегодня → прошлая тренировка
  let inf=null, rows=0, j=0, lt=null, exDone=false, def={w:"",r:"",q:""};
  if(e){
    inf=xinfo(s,e); rows=rowsOf(s,e); lt=lastTime(inf.name,date);
    j=curSet(s,e); exDone=j<0; if(j<0) j=Math.max(0,rows-1);
    const cur=e.sets[j]||blankSet(), prev=j>0?e.sets[j-1]:null, lp=lt&&(lt.e.sets[j]||lt.e.sets[lt.e.sets.length-1]);
    def={w:cur.w||(prev&&prev.w)||(lp&&lp.w)||"", r:cur.r||(lp&&lp.r)||String(inf.plan.lo), q:cur.q||""};
  }
  const key=e?e.uid+"#"+j:"";
  const val=draft&&draft.key===key?draft:Object.assign({key},def);
  const setVal=patch=>setDraft(Object.assign({},val,patch,{key}));
  const upd=fn=>edit(ss=>{ const x=ss.ex.find(y=>y.uid===e.uid); if(x){ if(x.n==null) x.n=rowsOf(ss,x); while(x.sets.length<x.n) x.sets.push(blankSet()); fn(x); } });

  const nextLabel=()=>{
    if(!e) return "";
    if(j+1<rows) return `${inf.name}: подход ${j+2} из ${rows}`;
    const n=s.ex.findIndex((x,k)=>k>i&&curSet(s,x)>=0); return n>=0?xinfo(s,s.ex[n]).name:"тренировка закончена";
  };
  const logSet=ev=>{
    const nl=nextLabel();
    upd(x=>{ x.sets[j]=Object.assign({},x.sets[j],{w:val.w,r:val.r,q:val.q,ok:true}); });
    anim(ev.currentTarget,{transform:["scale(.94)","scale(1)"]},{bounce:.45,duration:.45});
    unlockSound(); setTimer({end:Date.now()+inf.plan.rest*1000,total:inf.plan.rest,label:inf.name,next:nl});
    setDraft(null);
    if(j>=rows-1){ const n=s.ex.findIndex((x,k)=>k>i&&curSet(s,x)>=0); setIdx(n>=0?n:i); }
  };
  const restOn=timer&&(timer.end>Date.now()-60000);

  const progress=html`<div class="fprog" role="tablist" aria-label="Упражнения тренировки">${s.ex.map((x,k)=>{ const r=rowsOf(s,x), d=Math.min(r,doneOf(x)); return html`<button key=${x.uid} role="tab" aria-selected=${String(k===i)} aria-label=${xinfo(s,x).name+": "+d+" из "+r} style=${{flexGrow:Math.max(1,r)}} onClick=${()=>go(k)}><i style=${{width:(r?d/r*100:0)+"%"}}></i></button>`; })}</div>`;

  return html`<div class="focus">
    <header class="fhead">
      <button class="fday" onClick=${()=>setPanel(panel==="day"?null:"day")} aria-expanded=${String(panel==="day")}><${Plate} k=${day}/><span>${P[day].name}</span><small>нед. ${wk} · ${WEEKS[wk]}</small></button>
      <button class="ibtn" aria-label="Все упражнения" onClick=${()=>setPanel(panel==="list"?null:"list")}><${Icon} n="list" size=${20}/></button>
    </header>
    ${panel==="day"?html`<div class="fpanel">
      <div class="days" role="group" aria-label="День программы">${ORDER.map(k=>html`<button key=${k} aria-pressed=${String(k===day)} onClick=${()=>{ setDay(k); setPanel(null); }}><${Plate} k=${k}/>${P[k].name}</button>`)}</div>
      <div class="wk-meta">
        <input type="date" value=${date} aria-label="Дата" onChange=${ev=>ev.target.value&&setDate(ev.target.value)}/>
        ${date!==todayStr()?html`<button class="btn quiet" onClick=${()=>setDate(todayStr())}>Сегодня</button>`:null}
        <div class="stepper"><button aria-label="Неделя назад" onClick=${()=>setWeek(-1)}>−</button><span>нед. ${wk}</span><button aria-label="Неделя вперёд" onClick=${()=>setWeek(1)}>+</button></div>
      </div>
    </div>`:null}
    ${progress}
    <${AppliedBanner} s=${s} date=${date} day=${day} edit=${edit}/>

    ${restOn?html`<${RestRing} t=${timer} next=${timer.next} onShift=${d=>setTimer(t=>t&&({...t,end:Math.max(Date.now(),t.end)+d*1000}))} onStop=${()=>setTimer(null)}/>`:null}

    ${!e?html`<section class="stage"><p class="empty">В тренировке нет упражнений.</p><button class="fbtn main wide" onClick=${()=>setSheet({type:"add"})}>Добавить упражнение</button></section>`
    :html`<section class=${"stage"+(restOn?" dim":"")}>
      <div class="st-top">
        <button class="ibtn" aria-label="Предыдущее упражнение" disabled=${i===0} onClick=${()=>go(i-1)}><${Icon} n="left" size=${22}/></button>
        <div class="st-name">
          <small>Упражнение ${i+1} из ${s.ex.length}${e.alt&&!inf.custom?" · вместо: "+inf.base:""}</small>
          <h2>${inf.name}</h2>
        </div>
        <button class="ibtn" aria-label="Действия с упражнением" onClick=${()=>setSheet({type:"menu",uid:e.uid})}><${Icon} n="more" size=${22}/></button>
      </div>
      <div class="st-meta">
        <span class="tgt"><b>${inf.plan.lo}–${inf.plan.hi}</b> повт · RIR <b>${rirFor(inf.plan.rir,wk)}</b> · отдых ${restTxt(inf.plan.rest)}</span>
        <span class="lvline">${lvSorted(inf.lv).slice(0,3).map(k=>html`<span key=${k} class=${inf.lv[k]>=7?"hi":inf.lv[k]>=4?"mid":"lo"}>${MUS[k]} <b>${inf.lv[k]}</b></span>`)}</span>
      </div>

      <div class="setno">${exDone?html`<b>Все подходы сделаны</b>`:html`Подход <b class="big">${j+1}</b> из ${rows}`}</div>

      ${!exDone?html`
        <div class="stps">
          <${Stepper} label="Вес" unit="кг" step=${W_STEP} dec=${true} value=${val.w} onChange=${w=>setVal({w})}/>
          <${Stepper} label="Повторы" unit="раз" step=${1} value=${val.r} onChange=${r=>setVal({r})}/>
        </div>
        <div class="qrow" role="group" aria-label="Запас: сколько ещё мог сделать">
          <span>Ещё мог</span>
          ${["0","1","2","3","4+"].map(v=>html`<button key=${v} class=${(val.q===v?"on ":"")+qTone(v)} aria-pressed=${String(val.q===v)} onClick=${()=>setVal({q:val.q===v?"":v})}>${v}</button>`)}
        </div>
        ${lt?html`<div class="fwas">В прошлый раз (${dm(lt.date)}): ${lt.e.sets.filter(x=>num(x.r)!==null).map(x=>(x.w||"б/в")+"×"+x.r).join(", ")}</div>`:null}
        <button class="fbtn main hero" onClick=${logSet}><${Icon} n="check" size=${26}/> Подход сделан</button>
      `:html`<button class="fbtn main hero" onClick=${()=>{ const n=s.ex.findIndex((x,k)=>k!==i&&curSet(s,x)>=0); n>=0?go(n):setPanel("finish"); }}>${allDone?"Подвести итог":"Следующее упражнение"}</button>`}

      <div class="chips" aria-label="Подходы">
        ${Array.from({length:rows},(_,k)=>{ const x=e.sets[k]||blankSet(); return html`<button key=${k} class=${"chip-s"+(setDone(x)?" ok":"")+(k===j&&!exDone?" cur":"")}
          onClick=${()=>{ if(setDone(x)){ upd(y=>{ y.sets[k].ok=false; y.sets[k].r=""; }); setDraft(null); } }} aria-label=${setDone(x)?"Подход "+(k+1)+" сделан, нажми чтобы переделать":"Подход "+(k+1)}>
          <small>${k+1}</small><span>${setDone(x)?(x.w?nfmt(x.w)+"×":"")+(x.r||"✓"):"–"}</span></button>`; })}
        <button class="chip-s add" aria-label="Добавить подход" onClick=${()=>upd(x=>{ x.n+=1; x.sets.push(blankSet()); })}><${Icon} n="plus" size=${16}/></button>
        ${rows>1?html`<button class="chip-s add" aria-label="Убрать последний подход" onClick=${()=>upd(x=>{ x.n=Math.max(1,x.n-1); x.sets=x.sets.slice(0,x.n); })}><${Icon} n="minus" size=${16}/></button>`:null}
      </div>
      <${NoteField} value=${e.note||""} onChange=${v=>edit(ss=>{ const x=ss.ex.find(y=>y.uid===e.uid); if(x) x.note=v; })}/>
      <div class="st-nav">
        <button class="btn quiet" disabled=${i===0} onClick=${()=>go(i-1)}>‹ Назад</button>
        <button class="btn quiet" onClick=${()=>setPanel(panel==="list"?null:"list")}>Все упражнения</button>
        <button class="btn quiet" disabled=${i>=s.ex.length-1} onClick=${()=>go(i+1)}>Дальше ›</button>
      </div>
    </section>`}

    ${panel==="list"?html`<section class="flist">
      ${s.ex.map((x,k)=>{ const r=rowsOf(s,x), d=Math.min(r,doneOf(x)); return html`<div key=${x.uid} class=${"fl-row"+(k===i?" cur":"")+(d>=r&&r?" done":"")}>
        <button class="fl-main" onClick=${()=>{ go(k); setPanel(null); }}><small>${k+1}</small><span>${xinfo(s,x).name}</span><b>${d}/${r}</b></button>
        <button class="ibtn" aria-label="Действия" onClick=${()=>setSheet({type:"menu",uid:x.uid})}><${Icon} n="more" size=${18}/></button>
      </div>`; })}
      <button class="btn wide" onClick=${()=>setSheet({type:"add"})}><${Icon} n="plus" size=${16}/> Добавить упражнение</button>
    </section>`:null}

    <div class="fend">
      <button class=${"btn wide "+(s.done?"ok":allDone?"primary":"")} onClick=${()=>{ finish(); setPanel("finish"); }}>${s.done?"Тренировка завершена":"Завершить тренировку"}</button>
      ${panel!=="finish"&&!s.done?html`<button class="btn quiet" onClick=${()=>setPanel("finish")}>Итог и разбор</button>`:null}
    </div>
    ${panel==="finish"||s.done?html`<${FinishPanel} s=${s} edit=${edit} toast=${toast}/>`:null}
    <${SessionSheets} sheet=${sheet} setSheet=${setSheet} s=${s} date=${date} edit=${edit} remove=${remove} openAsk=${openAsk}/>
  </div>`;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${App}/>`);
