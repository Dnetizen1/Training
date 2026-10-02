/* Вид «Фокус» — по макету (https://claude.ai/artifact/E7r61u6nLNSxHS8iDcLWBq, экраны «Тренировка», «Отдых»).
   Одно упражнение и один текущий подход; плитки «Вес» и «Повторы» с круглыми ±; сегменты «Сколько ещё мог»;
   капсула «Подход сделан»; после неё — экран отдыха с большим кольцом. */

const W_STEP=2.5;
const nfmt=v=>{ const x=num(v); return x===null?"":String(Math.round(x*100)/100).replace(".",","); };
const mmss=s=>Math.floor(s/60)+":"+String(s%60).padStart(2,"0");

function RestScreen({t,onShift,onStop,onBack,back,done}){
  const [,tick]=useState(0);
  useEffect(()=>{ const h=setInterval(()=>tick(x=>x+1),250); return ()=>clearInterval(h); },[t]);
  const total=Math.max(1,t.total||60), left=Math.max(0,Math.round((t.end-Date.now())/1000)), p=left/total;
  const R=124, C=2*Math.PI*R;
  return html`<section class="rest2" aria-label="Отдых">
    <section class="hero">
      <${AppBar} left=${html`<${AbIcon} n="left" label=${"Назад: "+back} onClick=${onBack}/>`} title=${left===0?"Отдых окончен":"Отдых"} sub=${back+(done?" · "+done:"")}/>
    </section>
    <div class="ring2">
      <svg viewBox="0 0 280 280" aria-hidden="true">
        <circle cx="140" cy="140" r=${R} class="ring2-bg"/>
        <circle cx="140" cy="140" r=${R} class=${"ring2-fg"+(left===0?" over":"")} style=${{strokeDasharray:C,strokeDashoffset:C*(1-p)}} transform="rotate(-90 140 140)"/>
      </svg>
      <div class="ring2-c"><b class="big">${mmss(left)}</b><span>из ${mmss(total)}</span></div>
    </div>
    ${t.next?html`<div class="nextcard"><span>Дальше</span><b>${t.next}</b>${t.nextSub?html`<small>${t.nextSub}</small>`:null}</div>`:null}
    <div class="pair">
      <button class="pill" onClick=${()=>onShift(-15)}>−15 с</button>
      <button class="pill" onClick=${()=>onShift(15)}>+15 с</button>
    </div>
    <button class="capsule" onClick=${onStop}>${left===0?"Начать подход":"Пропустить отдых"}</button>
    <span class="foot-note">В конце отдыха прозвучит сигнал</span>
  </section>`;
}

function Tile({label,hint,unit,value,step,dec,onChange}){
  const [editing,setEditing]=useState(false);
  const v=num(value);
  const set=x=>onChange(String(Math.max(0,Math.round(x*100)/100)).replace(".",dec?",":"."));
  return html`<div class="tile">
    <span class="tile-l">${label}${hint?html`<i> · ${hint}</i>`:null}</span>
    ${editing?html`<input class="tile-in" autoFocus type="text" inputmode="decimal" value=${value} aria-label=${label} onChange=${ev=>onChange(ev.target.value)} onBlur=${()=>setEditing(false)} onKeyDown=${ev=>{ if(ev.key==="Enter") setEditing(false); }}/>`
      :html`<button class="tile-v" onClick=${()=>setEditing(true)} aria-label=${label+": "+(value||"не задано")+". Нажми, чтобы ввести"}><b class="big">${value===""?"–":nfmt(value)}</b><small>${unit}</small></button>`}
    <div class="tile-b">
      <button class="round" aria-label=${"Меньше: "+label} onClick=${()=>set((v??0)-step)}>−</button>
      <button class="round" aria-label=${"Больше: "+label} onClick=${()=>set((v??0)+step)}>+</button>
    </div>
  </div>`;
}

function FocusView({date,setDate,day,setDay,toast,timer,setTimer,openAsk,ui,setUi,openHistory,go}){
  const {s,edit,remove,setWeek,finish}=useSession(date,day,toast), wk=s.week;
  const [idx,setIdx]=useState(null), [sheet,setSheet]=useState(null), [draft,setDraft]=useState(null), [showSum,setShowSum]=useState(false);
  useEffect(()=>{ setIdx(null); setDraft(null); setShowSum(false); },[day,date]);
  const open=s.ex.findIndex(e=>curSet(s,e)>=0);
  const i=idx!=null&&idx<s.ex.length?idx:(open>=0?open:Math.max(0,s.ex.length-1));
  const e=s.ex[i];
  const allDone=s.ex.length>0&&open<0;
  const goEx=k=>{ setIdx(Math.max(0,Math.min(s.ex.length-1,k))); setDraft(null); setShowSum(false); };

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
  const nextIdx=s.ex.findIndex((x,k)=>k>i&&curSet(s,x)>=0);
  const nk=nextIdx>=0?nextIdx:(i<s.ex.length-1?i+1:-1);
  const nInf=nk>=0?xinfo(s,s.ex[nk]):null;

  const logSet=()=>{
    const prevBest=bestBefore(inf.name,date), isPR=prevBest&&e1rm(val.w,val.r)>prevBest&&!e.sets.some(y=>e1rm(y.w,y.r)>=e1rm(val.w,val.r));
    const last=j>=rows-1, nx=nextIdx>=0?s.ex[nextIdx]:null;
    const next=!last?inf.name+" · подход "+(j+2):nx?xinfo(s,nx).name:"Тренировка закончена";
    const nextSub=!last?(val.w?nfmt(val.w)+" кг × ":"")+val.r+" · как сейчас":nx?rowsOf(s,nx)+" × "+xinfo(s,nx).plan.lo+"–"+xinfo(s,nx).plan.hi:"";
    upd(x=>{ x.sets[j]=Object.assign({},x.sets[j],{w:val.w,r:val.r,q:val.q,ok:true}); });
    if(isPR) toast({text:`Рекорд в «${inf.name}»: 1ПМ ≈ ${kgf(e1rm(val.w,val.r))} кг`});
    unlockSound(); setTimer({end:Date.now()+inf.plan.rest*1000,total:inf.plan.rest,label:inf.name,next,nextSub,done:"Подход "+(j+1)+" из "+rows+" записан"});
    setDraft(null);
    if(last) setIdx(nextIdx>=0?nextIdx:i);
  };
  const resting=timer&&!timer.hidden&&timer.end>Date.now()-60000;
  const doneSets=s.ex.reduce((a,x)=>a+Math.min(doneOf(x),rowsOf(s,x)),0);
  const summary=showSum||(s.done&&allDone);

  const shift=d=>setTimer(t=>t&&({...t,end:Math.max(Date.now(),t.end)+d*1000}));
  if(!summary&&resting) return html`<div class="fx"><${RestScreen} t=${timer} back=${P[day].name} done=${timer.done||""} onBack=${()=>setTimer(t=>t&&({...t,hidden:true}))} onShift=${shift} onStop=${()=>setTimer(null)}/></div>`;
  if(summary) return html`<div class="fx">
    <section class="hero">
      <${AppBar} left=${html`<${AbIcon} n="left" label=${showSum?"Назад, к тренировке":"Назад, к прогрессу"} onClick=${()=>showSum?setShowSum(false):go("home")}/>`} title="Итог" sub=${P[day].name+" · "+navDate(date)} right=${html`<button class="ab-link" onClick=${()=>go("home")}>Готово</button>`}/>
    </section>
    <${ViewSwitch} ui=${ui} setUi=${setUi}/>
    <${FinishPanel} s=${s} edit=${edit} toast=${toast} head=${{title:P[day].name,sub:longDate(date)}}/>
  </div>`;

  return html`<div class="fx">
    <${TrainHero} s=${s} date=${date} day=${day} go=${go} onDay=${()=>setSheet({type:"day"})} onMuscles=${()=>setSheet({type:"muscles"})}
      right=${html`<button class="ab-link" onClick=${()=>{ if(!s.done) finish(); setShowSum(true); }}>Завершить</button>`}/>
    <${ViewSwitch} ui=${ui} setUi=${setUi}/>
    <${SecHead} title=${e?"Упражнение "+(i+1)+" из "+s.ex.length:"Нет упражнений"}><${Elapsed} s=${s}/><//>
    <div class="segs" role="tablist" aria-label="Упражнения">${s.ex.map((x,k)=>{ const r=rowsOf(s,x), d=Math.min(r,doneOf(x)); return html`<button key=${x.uid} role="tab" class=${k===i?"on":""} aria-selected=${String(k===i)} aria-label=${xinfo(s,x).name+": "+d+" из "+r} onClick=${()=>goEx(k)}><i style=${{width:(r?d/r*100:0)+"%"}}></i></button>`; })}</div>
    <${AppliedBanner} s=${s} date=${date} day=${day} edit=${edit}/>

    ${!e?html`<section class="xcard"><p class="st">В тренировке нет упражнений.</p><button class="capsule" onClick=${()=>setSheet({type:"add"})}>Добавить упражнение</button></section>`
    :html`<${React.Fragment}>
      <section class="xcard">
        <div class="x-top">
          <h2>${inf.name}</h2>
          <button class="ibtn" aria-label="Действия с упражнением" onClick=${()=>setSheet({type:"menu",uid:e.uid})}><${Icon} n="vmore" size=${22}/></button>
        </div>
        <span class="x-sub">${exDone?"Все подходы сделаны":"Подход "+(j+1)+" из "+rows} · цель ${inf.plan.lo}–${inf.plan.hi} повторов · запас ${rirFor(inf.plan.rir)}${e.alt&&!inf.custom?" · вместо: "+inf.base:""}</span>
        <button class="tags" aria-label="Нагрузка на мышцы" onClick=${()=>setSheet({type:"mus",uid:e.uid})}>${lvSorted(inf.lv).slice(0,3).map(k=>html`<span key=${k} class=${inf.lv[k]>=7?"hi":"lo"}>${MUS[k]} ${inf.lv[k]}</span>`)}</button>
        ${!exDone?html`
          <div class="tiles">
            <${Tile} label="Вес" hint=${isBarbell(inf.name)&&platesFor(val.w)?"по "+platesFor(val.w).map(fmt).join("+"):""} unit="кг" step=${W_STEP} dec=${true} value=${val.w} onChange=${w=>setVal({w})}/>
            <${Tile} label="Повторы" unit="раз" step=${1} value=${val.r} onChange=${r=>setVal({r})}/>
          </div>
          <div class="qwrap">
            <span>Сколько ещё мог сделать</span>
            <div class="seg5" role="group" aria-label="Запас повторов">${["0","1","2","3","4+"].map(v=>html`<button key=${v} aria-pressed=${String(val.q===v)} class=${v==="0"?"q0":""} onClick=${()=>setVal({q:val.q===v?"":v})}>${v}</button>`)}</div>
          </div>
          <button class="capsule" onClick=${logSet}><${Icon} n="check" size=${20}/>Подход сделан</button>
        `:html`<button class="capsule" onClick=${()=>{ const n=s.ex.findIndex(x=>curSet(s,x)>=0); n>=0?goEx(n):setShowSum(true); }}>${allDone?"Подвести итог":"Следующее упражнение"}</button>`}
      </section>

      <section class="setlist" aria-label="Подходы">
        ${Array.from({length:rows},(_,k)=>{ const x=e.sets[k]||blankSet(), dn=setDone(x), cur=k===j&&!exDone;
          return html`<button key=${k} class=${"sl-row"+(cur?" cur":"")} onClick=${()=>{ if(dn){ upd(y=>{ y.sets[k].ok=false; y.sets[k].r=""; }); setDraft(null); } }} aria-label=${dn?"Подход "+(k+1)+" сделан. Нажми, чтобы переделать":"Подход "+(k+1)}>
            <span>Подход ${k+1}</span>
            <b class=${dn?"ok":cur?"now":""}>${dn?(x.w?nfmt(x.w)+" × ":"")+(x.r||"")+"  ✓":cur?"сейчас":"–"}</b></button>`; })}
        <div class="sl-act">
          <button onClick=${()=>upd(x=>{ x.n+=1; x.sets.push(blankSet()); })}>+ Подход</button>
          ${rows>1?html`<button onClick=${()=>upd(x=>{ x.n=Math.max(1,x.n-1); x.sets=x.sets.slice(0,x.n); })}>− Подход</button>`:null}
        </div>
      </section>

      ${nInf?html`<button class="nx" onClick=${()=>goEx(nk)}><span>Дальше: ${nInf.name}</span><small>${rowsOf(s,s.ex[nk])} × ${nInf.plan.lo}–${nInf.plan.hi}</small></button>`:null}
      <${NoteField} value=${e.note||""} onChange=${v=>edit(ss=>{ const x=ss.ex.find(y=>y.uid===e.uid); if(x) x.note=v; })}/>
    <//>`}
    <${SessionSheets} sheet=${sheet} setSheet=${setSheet} s=${s} date=${date} day=${day} edit=${edit} remove=${remove} openAsk=${openAsk} openHistory=${openHistory}
      setDate=${setDate} setDay=${setDay} setWeek=${setWeek} ui=${ui} setUi=${setUi}/>
  </div>`;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${App}/>`);
