/* Интерфейс. Раскладка по образцу Strong/Hevy, см. DESIGN.md */

/* ---------- Общие части ---------- */
// Нагрузка по 10-балльной шкале, как в «Твой тренер»: строка на мышцу, − значение +
function LevelPicker({value,onChange}){
  const set=(k,v)=>{ const n=Object.assign({},value); v=Math.max(0,Math.min(10,v)); if(v) n[k]=v; else delete n[k]; onChange(n); };
  const used=MUS_ORDER.filter(k=>value[k]);
  const row=k=>{ const v=+value[k]||0, c=v>=7?"hi":v>=4?"mid":v?"lo":""; return html`<div key=${k} class=${"lvrow "+c}>
      <span class="lvn">${MUS[k]}</span>
      <button class="lvb" aria-label=${"Меньше: "+MUS[k]} disabled=${!v} onClick=${()=>set(k,v-1)}><${Icon} n="minus" size=${14}/></button>
      <b class="lvv">${v||"–"}</b>
      <button class="lvb" aria-label=${"Больше: "+MUS[k]} disabled=${v>=10} onClick=${()=>set(k,v?v+1:4)}><${Icon} n="plus" size=${14}/></button>
      <span class="lvc">${lvCat(v)}</span>
    </div>`; };
  return html`<div class="lv">
    ${used.length?html`<div class="lvg">Работают</div>${[...used].sort((a,b)=>value[b]-value[a]).map(row)}`:null}
    ${MUS_GROUPS.map(([g,ks])=>{ const rest=ks.filter(k=>!value[k]); return rest.length?html`<${React.Fragment} key=${g}><div class="lvg">${g}</div>${rest.map(row)}<//>`:null; })}
    <div class="lvtotal"><span>Общая нагрузка</span><b>${used.reduce((a,k)=>a+(+value[k]),0)}</b></div>
  </div>`;
}
// График «план / сделано» по мышцам, сгруппированным как в списке мышц. rows: {k:{plan,fact}}; zone — рабочий диапазон недели
function MuscleBars({rows,zone,showEmpty}){
  const vals=MUS_ORDER.flatMap(k=>[rows[k].plan,rows[k].fact]);
  const max=Math.max(zone?16:1,...vals), hasFact=MUS_ORDER.some(k=>rows[k].fact>0);
  const groups=MUS_GROUPS.map(([g,ks])=>[g,ks.filter(k=>showEmpty||rows[k].plan>0||rows[k].fact>0)]).filter(g=>g[1].length);
  if(!groups.length) return html`<div class="st">В этой тренировке пока нет упражнений с указанными мышцами.</div>`;
  return html`<div class="bars">
    ${groups.map(([g,ks])=>html`<${React.Fragment} key=${g}>
      <div class="bgroup">${g}</div>
      ${ks.map(k=>{ const r=rows[k]; return html`<div class="bar" key=${k}>
        <span class="bl">${MUS[k]}</span>
        <div class="track" title=${"план "+fmt(r.plan)+", сделано "+fmt(r.fact)}>
          ${zone?html`<i class="zone" style=${{left:(10/max*100)+"%",width:(6/max*100)+"%"}}></i>`:null}
          <i class="planb" style=${{width:(r.plan/max*100)+"%"}}></i>
          ${hasFact?html`<i class=${"factb"+(r.fact>=r.plan-0.01?" ok":"")} style=${{width:(r.fact/max*100)+"%"}}></i>`:null}
        </div>
        <span class="bv mono">${hasFact?fmt(r.fact)+"/":""}${fmt(r.plan)}</span>
      </div>`; })}
    <//>`)}
    <div class="legend"><span><i class="planb"></i>план</span><span><i class="factb"></i>сделано</span>${zone?html`<span><i class="zone"></i>10–16 в неделю</span>`:null}</div>
  </div>`;
}
const sessionRows=s=>{ const p=muscleCount(s,e=>rowsOf(s,e)), f=muscleCount(s,doneOf), r={}; MUS.forEach((_,k)=>{ r[k]={plan:p[k].f,fact:f[k].f}; }); return r; };
// Пояснение под знаком вопроса
function Help({children,label}){
  const [open,setOpen]=useState(false);
  return html`<div class="help">
    <button class="help-b" aria-expanded=${String(open)} aria-label=${label||"Пояснение"} onClick=${()=>setOpen(!open)}>?</button>
    ${open?html`<div class="help-t">${children}</div>`:null}
  </div>`;
}
function SessionMuscles({s,onClose}){
  return html`<${Sheet} title=${"Мышцы: "+P[s.day].name} onClose=${onClose}>
    <${Help} label="Как считаются подходы">Эффективные подходы: нагрузка на мышцу 7–10 = 1 подход, 4–6 = 0,5, 1–3 = 0,25. Серая полоса — план этой тренировки, цветная — уже сделано.<//>
    <${MuscleBars} rows=${sessionRows(s)}/>
  <//>`;
}
const MusBtn=({onClick})=>html`<button class="musbtn" onClick=${onClick} aria-label="Мышцы за тренировку"><${Icon} n="bars" size=${16}/><span>Мышцы</span></button>`;

function Sheet({title,onClose,children,foot}){
  const ref=useRef(null);
  useEffect(()=>{ anim(ref.current,{transform:["translateY(-40px)","translateY(0)"],opacity:[.4,1]},{bounce:.12,duration:.45});
    const k=ev=>{ if(ev.key==="Escape") onClose(); }; document.addEventListener("keydown",k); return ()=>document.removeEventListener("keydown",k); },[]);
  return ReactDOM.createPortal(html`<div class="sheet-wrap" onClick=${ev=>{ if(ev.target===ev.currentTarget) onClose(); }}>
    <div class="sheet" role="dialog" aria-label=${title} ref=${ref}>
      <div class="sheet-head"><b>${title}</b><button class="ibtn" aria-label="Закрыть" onClick=${onClose}><${Icon} n="close"/></button></div>
      ${foot?html`<div class="sheet-foot">${foot}</div>`:null}
      <div class="sheet-body">${children}</div>
    </div></div>`,document.body);
}
function NoteField({value,onChange}){
  const [open,setOpen]=useState(false), ref=useRef(null);
  const fit=el=>{ if(el){ el.style.height="auto"; el.style.height=el.scrollHeight+"px"; } };
  useEffect(()=>{ if(open&&ref.current){ ref.current.focus(); fit(ref.current); } },[open]);
  if(open) return html`<textarea ref=${ref} class="noteedit" rows="1" value=${value} placeholder="Техника, ощущения, боль" aria-label="Заметка к упражнению" onChange=${ev=>{ onChange(ev.target.value); fit(ev.target); }} onBlur=${()=>setOpen(false)}></textarea>`;
  return html`<button class=${"notebtn"+(value?" has":"")} onClick=${()=>setOpen(true)}><${Icon} n="pen" size=${14}/><span>${value||"Заметка"}</span></button>`;
}
const qTone=q=>q===""||q==null?"":q==="0"?"q0":q==="1"?"q1":q==="4+"?"q4":"q2";
const Elapsed=({s})=>{
  const [,t]=useState(0);
  useEffect(()=>{ if(!s.start||s.done) return; const h=setInterval(()=>t(x=>x+1),1000); return ()=>clearInterval(h); },[s.start,s.done]);
  if(!s.start) return html`<span class="elapsed mute">0:00</span>`;
  const sec=Math.max(0,Math.round(((s.done&&s.end)||Date.now())-s.start)/1000|0), h=Math.floor(sec/3600), m=Math.floor(sec%3600/60), ss=sec%60;
  return html`<span class="elapsed">${h?h+":"+String(m).padStart(2,"0"):m}:${String(ss).padStart(2,"0")}</span>`;
};

/* ---------- Упражнение: журнал подходов ---------- */
// текущий подход упражнения: первый, где ещё нет повторов (или отметки)
const curSet=(s,e)=>{ const rows=rowsOf(s,e); for(let j=0;j<rows;j++) if(!setDone(e.sets[j]||blankSet())) return j; return -1; };
function ExerciseBlock({s,i,date,edit,openSheet,startTimer}){
  const e=s.ex[i], inf=xinfo(s,e), {lo,hi,rir,rest,note}=inf.plan, wk=s.week;
  const [qOpen,setQOpen]=useState(null);
  const rows=rowsOf(s,e);
  const lt=lastTime(inf.name,date);
  const up=lt&&lt.e.sets.length&&lt.e.sets.every(x=>num(x.r)!==null&&num(x.r)>=hi);
  const top=lvSorted(inf.lv);
  const cj=curSet(s,e), done=rows>0&&cj<0, prevBest=bestBefore(inf.name,date);
  const upd=fn=>edit(ss=>{ const x=ss.ex.find(y=>y.uid===e.uid); if(x){ if(x.n==null) x.n=rowsOf(ss,x); while(x.sets.length<x.n) x.sets.push(blankSet()); fn(x,ss); } });
  // «Подход сделан»: дозаполнить текущий подход (прошлый подход сегодня → прошлая тренировка) и запустить отдых
  const setDoneNow=ev=>{
    if(cj>=0) upd(x=>{ const st=x.sets[cj], prev=cj>0?x.sets[cj-1]:null, lp=lt&&lt.e.sets[cj];
      if(!st.w) st.w=(prev&&prev.w)||(lp&&lp.w)||""; if(!st.r) st.r=String((lp&&lp.r)||lo); st.ok=true; });
    anim(ev.currentTarget,{transform:["scale(.96)","scale(1)"]},{bounce:.4,duration:.4});
    startTimer(rest,inf.name);
  };
  return html`<section class=${"exb"+(done?" complete":"")}>
    <div class="exb-head">
      <div class="exb-tt">
        <button class="exb-title" onClick=${()=>openSheet("menu",e.uid)}>${inf.name}</button>
        ${inf.custom?html`<div class="exb-sub">добавлено в эту тренировку</div>`:e.alt?html`<div class="exb-sub">вместо: ${inf.base}</div>`:null}
      </div>
      <button class="ibtn" aria-label="Действия с упражнением" onClick=${()=>openSheet("menu",e.uid)}><${Icon} n="more"/></button>
    </div>
    <div class="exb-meta">
      <span class="mono"><b>${rows}×${lo}–${hi}</b> · RIR ${rirFor(rir,wk)} · отдых ${restTxt(rest)}</span>
      ${top.length?html`<button class="lvline" onClick=${()=>openSheet("mus",e.uid)} aria-label="Нагрузка на мышцы">${top.slice(0,4).map(k=>html`<span key=${k} class=${inf.lv[k]>=7?"hi":inf.lv[k]>=4?"mid":"lo"}>${MUS[k]} <b>${inf.lv[k]}</b></span>`)}${top.length>4?html`<span class="more">+${top.length-4}</span>`:null}</button>`:html`<button class="linkbtn" onClick=${()=>openSheet("mus",e.uid)}>Указать нагрузку на мышцы</button>`}
    </div>
    ${note?html`<div class="exb-note">${note}</div>`:null}
    ${up?html`<div class="hint up"><${Icon} n="arrowUp" size=${16}/><span>В прошлый раз все подходы на верхней границе (${hi}). Добавь вес.</span></div>`:null}
    <div class="log" role="table" aria-label=${"Подходы: "+inf.name}>
      <div class="row head" role="row"><span>Сет</span><span>Прошлый</span><span>кг</span><span>Повт</span><span>Запас</span></div>
      ${Array.from({length:rows},(_,j)=>{ const x=e.sets[j]||blankSet(), lp=lt&&lt.e.sets[j]||{}; return html`<${React.Fragment} key=${j}>
        <div class=${"row"+(setDone(x)?" done":"")+(j===cj?" cur":"")} role="row">
          <span class="n">${prevBest&&e1rm(x.w,x.r)>prevBest?html`<span class="pr" title="Рекорд: лучше прошлого результата" aria-label="Рекорд">${I_TROPHY}</span>`:j+1}</span>
          <span class="prev">${lp.r?(lp.w||"б/в")+"×"+lp.r+(lp.q?" ·"+lp.q:""):"–"}</span>
          <input type="text" inputmode="decimal" value=${x.w} placeholder=${lp.w||""} aria-label=${"Вес, подход "+(j+1)} onChange=${ev=>upd(y=>{ y.sets[j].w=ev.target.value; })}/>
          <input type="text" inputmode="numeric" value=${x.r} placeholder=${String(lp.r||lo)} aria-label=${"Повторы, подход "+(j+1)} onChange=${ev=>upd(y=>{ y.sets[j].r=ev.target.value; if(!ev.target.value) y.sets[j].ok=false; })}/>
          <button class=${"q "+qTone(x.q)+(qOpen===j?" open":"")} aria-expanded=${String(qOpen===j)} aria-label=${"Запас повторов, подход "+(j+1)+": "+(x.q||"не указан")} onClick=${()=>setQOpen(qOpen===j?null:j)}>${x.q||"?"}</button>
        </div>
        ${qOpen===j?html`<div class="qpick" role="group" aria-label="Сколько повторов ещё мог сделать">
          <div class="qpick-t">Подход ${j+1}: сколько повторов ещё мог сделать? <span>0 = отказ</span></div>
          <div class="qpick-b">${["0","1","2","3","4+"].map(v=>html`<button key=${v} class=${qTone(v)+(x.q===v?" on":"")} onClick=${()=>{ upd(y=>{ y.sets[j].q=v; }); setQOpen(null); }}>${v}</button>`)}
            ${x.q?html`<button class="clr" onClick=${()=>{ upd(y=>{ y.sets[j].q=""; }); setQOpen(null); }}>Очистить</button>`:null}</div>
        </div>`:null}
      <//>`; })}
    </div>
    <div class="exb-add">
      <button class=${"btn wide "+(done?"":"primary")} onClick=${setDoneNow}><${Icon} n="check" size=${18}/> ${done?"Отдых":"Подход "+(cj+1)+" сделан"} · ${restTxt(rest)}</button>
      <button class="btn" aria-label="Добавить подход" onClick=${()=>upd(x=>{ x.n=x.n+1; x.sets.push(blankSet()); })}><${Icon} n="plus" size=${16}/></button>
      <button class="btn" disabled=${rows<=1} aria-label="Убрать последний подход" onClick=${()=>upd(x=>{ x.n=Math.max(1,x.n-1); x.sets=x.sets.slice(0,x.n); })}><${Icon} n="minus" size=${16}/></button>
    </div>
    <${NoteField} value=${e.note||""} onChange=${v=>edit(ss=>{ const x=ss.ex.find(y=>y.uid===e.uid); if(x) x.note=v; })}/>
  </section>`;
}

/* ---------- Шторки действий с упражнением ---------- */
function ExerciseMenu({s,uid,date,edit,go,onClose,onRemove,onAsk,openHistory}){
  const i=s.ex.findIndex(e=>e.uid===uid); if(i<0) return null;
  const e=s.ex[i], inf=xinfo(s,e), lt=lastTime(inf.name,date);
  const item=(icon,label,fn,cls)=>html`<button class=${"mitem "+(cls||"")} onClick=${fn}><${Icon} n=${icon} size=${20}/><span>${label}</span></button>`;
  const move=d=>{ edit(ss=>{ const k=ss.ex.findIndex(y=>y.uid===uid), j=k+d; if(k<0||j<0||j>=ss.ex.length) return; [ss.ex[k],ss.ex[j]]=[ss.ex[j],ss.ex[k]]; }); onClose(); };
  return html`<${Sheet} title=${inf.name} onClose=${onClose}>
    <div class="menu">
      ${item("swap",inf.custom?"Переименовать":"Заменить упражнение",()=>go("swap"))}
      ${item("target","Нагрузка на мышцы",()=>go("mus"))}
      ${openHistory?item("history","История упражнения",()=>{ onClose(); openHistory(inf.name); }):null}
      ${lt?item("clock","Заполнить как в прошлый раз",()=>{ edit(ss=>{ const x=ss.ex.find(y=>y.uid===uid); if(x){ x.sets=lt.e.sets.map(y=>({w:y.w,r:y.r,ok:false,q:""})); x.n=x.sets.length; } }); onClose(); }):null}
      ${i>0?item("up","Поднять выше",()=>move(-1)):null}
      ${i<s.ex.length-1?item("down","Опустить ниже",()=>move(1)):null}
      ${item("spark","Спросить тренера про упражнение",()=>{ onClose(); onAsk(i); },"ai")}
      ${item("trash","Убрать из тренировки",()=>{ onClose(); onRemove(i); },"danger")}
    </div>
  <//>`;
}
function SwapSheet({s,uid,edit,onClose,go}){
  const [own,setOwn]=useState("");
  const [auto,setAuto]=useState(!!S.sample);
  const e=s.ex.find(x=>x.uid===uid); if(!e) return null;
  const inf=xinfo(s,e);
  const apply=nm=>{
    edit(ss=>{ const x=ss.ex.find(y=>y.uid===uid); if(!x) return; if(inf.custom) x.name=nm; else if(nm) x.alt=nm; else { delete x.alt; delete x.mus; delete x.lv; } });
    if(nm) go("mus",{autodetect:auto&&!!S.sample,name:nm}); else onClose();
  };
  return html`<${Sheet} title=${inf.custom?"Переименовать":"Заменить: "+inf.name} onClose=${onClose}>
    ${!inf.custom?html`<div class="menu">
      ${(ALT[inf.base]||[]).filter(a=>a!==inf.name).map(a=>html`<button key=${a} class="mitem" onClick=${()=>apply(a)}><${Icon} n="swap" size=${18}/><span>${a}</span></button>`)}
      ${e.alt?html`<button class="mitem" onClick=${()=>apply("")}><${Icon} n="clock" size=${18}/><span>Вернуть по программе: ${inf.base}</span></button>`:null}
    </div>`:null}
    <div class="own"><input type="text" value=${own} onChange=${ev=>setOwn(ev.target.value)} placeholder=${inf.custom?"Новое название":"Своё упражнение"} aria-label="Название упражнения"/><button class="btn primary" onClick=${()=>own.trim()&&apply(own.trim())}>Взять</button></div>
    <label class="chk"><input type="checkbox" checked=${auto} disabled=${!S.sample} onChange=${ev=>setAuto(ev.target.checked)}/> Определить нагрузку на мышцы автоматически</label>
  <//>`;
}
function MuscleSheet({s,uid,edit,onClose,opts}){
  const e=s.ex.find(x=>x.uid===uid);
  const [busy,setBusy]=useState(false), [msg,setMsg]=useState("");
  const name=e?xinfo(s,e).name:"";
  const run=async()=>{
    setBusy(true); setMsg("");
    try{ const m=await detectMuscles(name); if(!Object.keys(m).length) throw {};
      edit(ss=>{ const x=ss.ex.find(y=>y.uid===uid); if(x){ x.lv=m; delete x.mus; } }); setMsg("Нагрузка определена автоматически. Можно поправить вручную."); }
    catch(err){ setMsg(err&&err.code==="not_granted"?ERR.not_granted+" Отметь вручную.":"Не получилось определить автоматически. Отметь вручную."); }
    setBusy(false);
  };
  useEffect(()=>{ if(opts&&opts.autodetect) run(); },[]);
  if(!e) return null;
  return html`<${Sheet} title=${"Нагрузка: "+name} onClose=${onClose} foot=${html`<button class="btn primary wide" onClick=${onClose}>Готово</button>`}>
    <div class="st">Нагрузка по шкале 0–10. В объём недели идёт так: высокая (7–10) = 1 подход, средняя (4–6) = 0,5, низкая (1–3) = 0,25.</div>
    <${LevelPicker} value=${xinfo(s,e).lv} onChange=${m=>edit(ss=>{ const x=ss.ex.find(y=>y.uid===uid); if(x){ x.lv=m; delete x.mus; } })}/>
    ${S.sample?html`<button class="btn" disabled=${busy} onClick=${run}><${Icon} n="spark" size=${16}/> ${busy?"Определяю…":"Определить автоматически"}</button>`:null}
    ${msg?html`<div class="st">${msg}</div>`:null}
  <//>`;
}
function AddSheet({edit,onClose}){
  const [f,setF]=useState({name:"",n:"3",lo:"8",hi:"12"});
  const [mode,setMode]=useState(S.sample?"auto":"manual");
  const [mus,setMus]=useState({});
  const [msg,setMsg]=useState("");
  const add=async()=>{
    const name=f.name.trim(); if(!name){ setMsg("Впиши название."); return; }
    const cl=(v,a,z,d)=>Math.min(z,Math.max(a,Math.round(num(v)??d)));
    const n=cl(f.n,1,10,3), lo=cl(f.lo,1,100,8), hi=Math.max(lo,cl(f.hi,1,100,12)), uid="c"+rid();
    edit(ss=>{ ss.ex.push({uid,base:-1,name,n,plan:{ns:n,lo,hi,rir:"1",rest:120,note:""},lv:mode==="manual"?mus:{},sets:Array.from({length:n},blankSet),note:""}); });
    onClose();
    if(mode==="auto"){ try{ const r=await detectMuscles(name); edit(ss=>{ const x=ss.ex.find(y=>y.uid===uid); if(x) x.lv=r; }); }catch(e){} }
  };
  const inp=(k,label,im)=>html`<label class=${k==="name"?"full":""}>${label}<input type="text" inputmode=${im} value=${f[k]} onChange=${ev=>setF(Object.assign({},f,{[k]:ev.target.value}))} placeholder=${k==="name"?"Например, жим Свенда":""}/></label>`;
  return html`<${Sheet} title="Добавить упражнение" onClose=${onClose} foot=${html`<button class="btn primary wide" onClick=${add}>Добавить в тренировку</button>`}>
    <div class="adform">${inp("name","Название","text")}${inp("n","Подходы","numeric")}${inp("lo","Повт. от","numeric")}${inp("hi","Повт. до","numeric")}</div>
    <div class="seg" role="group" aria-label="Как указать мышцы">
      <button aria-pressed=${String(mode==="auto")} disabled=${!S.sample} onClick=${()=>setMode("auto")}>Нагрузка автоматически</button>
      <button aria-pressed=${String(mode==="manual")} onClick=${()=>setMode("manual")}>Вручную</button>
    </div>
    ${mode==="manual"?html`<${LevelPicker} value=${mus} onChange=${setMus}/>`:html`<div class="st">Нагрузка на мышцы (0–10) определится сама после добавления. Поправить можно через «⋯ → Нагрузка на мышцы».</div>`}
    ${msg?html`<div class="st bad">${msg}</div>`:null}
  <//>`;
}

/* ---------- Корректировки следующих тренировок ---------- */
const modKey=m=>m.day+"|"+m.type+"|"+(m.base??"")+"|"+(m.name||"");
function Corrections({s,toast}){
  const [ai,setAi]=useState(null), [off,setOff]=useState({}), [busy,setBusy]=useState(false), [msg,setMsg]=useState("");
  const list=ai||suggestMods(s);
  const planned=ORDER.flatMap(d=>modsList(d).filter(m=>m.from===s.date));
  const sentKeys=new Set(planned.map(modKey));
  const fresh=list.filter(m=>!sentKeys.has(modKey(m)));
  const auto=async()=>{ setBusy(true); setMsg("");
    try{ const r=await suggestModsAuto(s); setAi(r); setOff({}); if(!r.length) setMsg("Переносить нечего: недобор небольшой или уже покрыт."); }
    catch(e){ setMsg(errText(e)); }
    setBusy(false); };
  const apply=()=>{ const chosen=fresh.filter(m=>!off[modKey(m)]); if(!chosen.length) return;
    addMods(chosen.map(m=>Object.assign({},m,{id:rid()})));
    toast({text:`Добавлено в план: ${chosen.length}`,action:"Отменить",run:()=>{ const ks=new Set(chosen.map(modKey)); ORDER.forEach(d=>modsList(d).filter(m=>m.from===s.date&&ks.has(modKey(m))).forEach(m=>dropMod(d,m.id))); }}); };
  return html`<div class="corr">
    <h3>Перенос в ближайшие тренировки</h3>
    ${!list.length&&!planned.length?html`<div class="st">Всё сделано по плану, переносить нечего.</div>`:null}
    ${fresh.length?html`<div class="menu">${fresh.map(m=>{ const k=modKey(m); return html`<label key=${k} class="mitem corr-item">
        <input type="checkbox" checked=${!off[k]} onChange=${ev=>setOff(Object.assign({},off,{[k]:!ev.target.checked}))}/>
        <span><b>${P[m.day].name} · ${modText(m)}</b>${m.reason?html`<small>${m.reason}</small>`:null}</span>
      </label>`; })}</div>
      <div class="row-actions"><button class="btn primary" onClick=${apply}>Добавить в план</button>
        ${S.sample?html`<button class="btn" disabled=${busy} onClick=${auto}><${Icon} n="spark" size=${16}/> ${busy?"Подбираю…":ai?"Подобрать ещё раз":"Подобрать автоматически"}</button>`:null}
        ${ai?html`<button class="btn quiet" onClick=${()=>setAi(null)}>Простой вариант</button>`:null}</div>`:null}
    ${planned.length?html`<div class="st">Уже в плане (применится, когда откроешь эти тренировки):</div>
      <div class="menu">${planned.map(m=>html`<div key=${m.id} class="mitem corr-item"><span><b>${P[m.day].name} · ${modText(m)}</b></span>
        <button class="ibtn danger" aria-label="Убрать из плана" onClick=${()=>dropMod(m.day,m.id)}><${Icon} n="close" size=${16}/></button></div>`)}</div>`:null}
    ${msg?html`<div class="st">${msg}</div>`:null}
  </div>`;
}

/* ---------- Разбор (тренировки или недели) ---------- */
function Review({label,stored,build,onSave,disabledMsg}){
  const [live,setLive]=useState(""), [err,setErr]=useState("");
  const ctl=useRef(null);
  const run=async()=>{
    const p=build(); if(!p){ setErr(disabledMsg); return; }
    ctl.current=new AbortController(); setErr(""); setLive("…");
    try{ const r=await S.sample(p,{signal:ctl.current.signal,cache:false,onText:({text})=>setLive(text)});
      onSave(r.text+(r.truncated?"\n\n(Ответ оборван, запроси ещё раз.)":"")); setLive(""); }
    catch(e){ setLive(""); if(e&&e.code!=="cancelled"&&!e.text) setErr(errText(e)); if(e&&e.text) onSave(e.text+"\n\n(Ответ прерван.)"); }
    ctl.current=null;
  };
  return html`<div class="review">
    ${live?html`<div class="sum">${live==="…"?html`<div class="st">Анализирую… Ответ может прийти через полминуты.</div>`:html`<${Rich} text=${live}/>`}<div><button class="btn" onClick=${()=>ctl.current&&ctl.current.abort()}>Стоп</button></div></div>`
      :stored?html`<div class="sum"><${Rich} text=${stored}/></div>`:null}
    <div class="row-actions">
      ${S.sample?html`<button class="btn primary" disabled=${!!live} onClick=${run}><${Icon} n="spark" size=${16}/> ${stored?label+" заново":label}</button>`:null}
      <button class="btn" onClick=${()=>{ const p=build(); p?copyText(p,"Запрос скопирован, вставь его в чат"):setErr(disabledMsg); }}>Скопировать запрос</button>
    </div>
    ${err?html`<div class="st bad">${err}</div>`:null}
  </div>`;
}

/* ---------- Экран тренировки ---------- */
// Общее для обоих видов: тренировка, правки, удаление с «Вернуть», неделя мезоцикла, завершение
function useSession(date,day,toast){
  const s=getSession(date,day);
  const edit=fn=>editSession(date,day,fn);
  const remove=i=>{
    const entry=clone(s.ex[i]), name=xinfo(s,entry).name;
    edit(ss=>{ ss.ex.splice(i,1); });
    toast({text:`«${name}» убрано`,action:"Вернуть",run:()=>edit(ss=>{ ss.ex.splice(Math.min(i,ss.ex.length),0,entry); })});
  };
  const setWeek=d=>edit(ss=>{ ss.week=Math.min(6,Math.max(1,ss.week+d));
    ss.ex.forEach(e=>{ if(e.sets.some(x=>x.w||x.r||x.ok)) return; delete e.n; e.sets=Array.from({length:setsFor(xinfo(ss,e).plan.ns,ss.week)},blankSet); }); });
  const finish=()=>edit(ss=>{ ss.done=!ss.done; if(ss.done){ ss.end=Date.now(); if(!ss.dur&&ss.start) ss.dur=String(Math.max(1,Math.round((ss.end-ss.start)/60000))); } });
  return {s,edit,remove,setWeek,finish};
}
function DaySheet({s,date,day,setDate,setDay,setWeek,ui,setUi,onClose}){
  const wk=s.week;
  return html`<${Sheet} title="Тренировка" onClose=${onClose}>
    <div class="grp">
      <div class="grp-row"><span>День</span></div>
      <div class="days" role="group" aria-label="День программы">${ORDER.map(k=>html`<button key=${k} aria-pressed=${String(k===day)} onClick=${()=>{ setDay(k); onClose(); }}><${Plate} k=${k}/>${P[k].name}</button>`)}</div>
    </div>
    <div class="grp">
      <label class="grp-row"><span>Дата</span><input type="date" value=${date} onChange=${ev=>ev.target.value&&setDate(ev.target.value)}/></label>
      ${date!==todayStr()?html`<button class="grp-row link" onClick=${()=>setDate(todayStr())}>Вернуться к сегодня</button>`:null}
      <div class="grp-row"><span>Неделя мезоцикла</span><div class="stepper"><button aria-label="Неделя назад" onClick=${()=>setWeek(-1)}>−</button><span>${wk} из 6</span><button aria-label="Неделя вперёд" onClick=${()=>setWeek(1)}>+</button></div></div>
      <div class="grp-row"><span>Цель недели</span><span class="mute">${WEEKS[wk]}</span></div>
    </div>
    ${setUi?html`<div class="grp">
      <div class="grp-row"><span>Вид экрана</span></div>
      <div class="days two" role="group" aria-label="Вид экрана тренировки">
        <button aria-pressed=${String(ui!=="focus")} onClick=${()=>{ setUi("journal"); onClose(); }}>Журнал</button>
        <button aria-pressed=${String(ui==="focus")} onClick=${()=>{ setUi("focus"); onClose(); }}>По одному подходу</button>
      </div>
    </div>`:null}
  <//>`;
}
function SessionSheets({sheet,setSheet,s,date,day,edit,remove,openAsk,openHistory,setDate,setDay,setWeek,ui,setUi}){
  if(!sheet) return null;
  const close=()=>setSheet(null), go=(t,o)=>setSheet({type:t,uid:sheet.uid,opts:o});
  return sheet.type==="menu"?html`<${ExerciseMenu} s=${s} uid=${sheet.uid} date=${date} edit=${edit} onClose=${close} onRemove=${remove} onAsk=${openAsk} openHistory=${openHistory} go=${go}/>`
    :sheet.type==="swap"?html`<${SwapSheet} s=${s} uid=${sheet.uid} edit=${edit} onClose=${close} go=${go}/>`
    :sheet.type==="mus"?html`<${MuscleSheet} key=${sheet.uid+(sheet.opts?sheet.opts.name:"")} s=${s} uid=${sheet.uid} opts=${sheet.opts} edit=${edit} onClose=${close}/>`
    :sheet.type==="add"?html`<${AddSheet} edit=${edit} onClose=${close}/>`
    :sheet.type==="muscles"?html`<${SessionMuscles} s=${s} onClose=${close}/>`
    :sheet.type==="day"?html`<${DaySheet} s=${s} date=${date} day=${day} setDate=${setDate} setDay=${setDay} setWeek=${setWeek} ui=${ui} setUi=${setUi} onClose=${close}/>`:null;
}
function FinishPanel({s,edit,toast,head}){
  const doneSets=s.ex.reduce((a,e)=>a+Math.min(doneOf(e),rowsOf(s,e)),0), totalSets=s.ex.reduce((a,e)=>a+rowsOf(s,e),0);
  const doneEx=s.ex.filter(e=>rowsOf(s,e)>0&&doneOf(e)>=rowsOf(s,e)).length;
  const qs=s.ex.flatMap(e=>e.sets.map(x=>x.q)).filter(q=>q!==""&&q!=null).map(q=>q==="4+"?4:+q);
  const avgQ=qs.length?fmt(Math.round(qs.reduce((a,b)=>a+b,0)/qs.length*10)/10):"–";
  return html`<section class="finish">
      <div class="sumhead">
        <${Rings} size=${84} stroke=${10} label=${"Подходы "+doneSets+" из "+totalSets+", упражнения "+doneEx+" из "+s.ex.length} rings=${[
          {p:totalSets?doneSets/totalSets:0,color:"var(--acc)",track:"var(--acc-track)"},
          {p:s.ex.length?doneEx/s.ex.length:0,color:"var(--grn)",track:"var(--grn-track)"}]}/>
        <div><h2>${head?head.title:"Итог"}</h2><span class="mute">${head?head.sub:s.done?"Тренировка завершена":"Тренировка ещё идёт"}</span></div>
      </div>
      <div class="tiles4">
        <div><span>Время</span><b class="big">${s.dur||"–"}<small> мин</small></b></div>
        <div><span>Подходы</span><b class="big acc">${doneSets}/${totalSets}</b></div>
        <div><span>Упражнения</span><b class="big grn">${doneEx}/${s.ex.length}</b></div>
        <div><span>Средний запас</span><b class="big">${avgQ}</b></div>
      </div>
      ${s.done?html`<${Corrections} s=${s} toast=${toast}/>`:null}
      <${Review} label="Разобрать тренировку" stored=${s.summary} disabledMsg="Сначала впиши хотя бы один подход."
        build=${()=>hasData(s)?reviewPrompt(s):""} onSave=${t=>edit(ss=>{ ss.summary=t; })}/>
      <details class="grp more">
        <summary class="grp-row">Самочувствие, вес и время</summary>
        <div class="form">
          <label>Вес утром, кг<input type="text" inputmode="decimal" value=${s.bw||""} onChange=${ev=>edit(ss=>{ ss.bw=ev.target.value; })}/></label>
          <label>Длительность, мин<input type="text" inputmode="numeric" value=${s.dur||""} onChange=${ev=>edit(ss=>{ ss.dur=ev.target.value; })}/></label>
          <label class="full">Самочувствие, сон, боли<textarea rows="2" value=${s.note||""} onChange=${ev=>edit(ss=>{ ss.note=ev.target.value; })}></textarea></label>
        </div>
      </details>
      <button class="btn wide" onClick=${()=>copyText(textLog(s))}>Скопировать тренировку текстом</button>
    </section>`;
}
function AppliedBanner({s,date,day,edit}){
  if(!(s.applied&&s.applied.length)) return null;
  return html`<div class="applied">
      <div><b>Учтено после тренировки ${dm(s.applied[0].from)}</b></div>
      <ul>${s.applied.map((a,k)=>html`<li key=${k}>${a.text}${a.reason?html`<span class="mute"> · ${a.reason}</span>`:null}</li>`)}</ul>
      ${!hasData(s)?html`<button class="btn quiet" onClick=${()=>edit(ss=>{ ss.ex=blankSession(date,day).ex; delete ss.applied; })}>Вернуть как в программе</button>`:null}
    </div>`;
}

function TrainView({date,setDate,day,setDay,toast,startTimer,openAsk,ui,setUi,openHistory,go}){
  const {s,edit,remove,setWeek,finish}=useSession(date,day,toast), wk=s.week;
  const [sheet,setSheet]=useState(null);       // {type, uid, opts}
  return html`<div>
    <nav class="navrow" aria-label="Навигация">
      <button class="navback" onClick=${()=>go("home")}><${Icon} n="left" size=${22}/>Сводка</button>
      <span class="navright"><button class="navlink" onClick=${()=>setSheet({type:"muscles"})}>Мышцы</button>
      <button class="navlink" onClick=${()=>{ if(!s.done) finish(); setTimeout(()=>{ const f=document.querySelector(".finish"); f&&f.scrollIntoView({behavior:"smooth"}); },50); }}>${s.done?"Итог":"Завершить"}</button></span>
    </nav>
    <header class="ttl">
      <button class="ttl-b" onClick=${()=>setSheet({type:"day"})} aria-label="Сменить день, дату или неделю"><h1>${P[day].name}</h1></button>
      <span class="ttl-s">Неделя ${wk} · ${WEEKS[wk]} · ${s.ex.reduce((a,e)=>a+Math.min(doneOf(e),rowsOf(s,e)),0)} из ${s.ex.reduce((a,e)=>a+rowsOf(s,e),0)} подх.</span>
    </header>
    <${AppliedBanner} s=${s} date=${date} day=${day} edit=${edit}/>
    <div class="exlist">
      ${s.ex.map((e,i)=>html`<${ExerciseBlock} key=${e.uid} s=${s} i=${i} date=${date} edit=${edit} startTimer=${startTimer} openSheet=${(type,uid,opts)=>setSheet({type,uid,opts})}/>`)}
      ${!s.ex.length?html`<div class="empty">В тренировке нет упражнений.</div>`:null}
      <button class="btn wide addex" onClick=${()=>setSheet({type:"add"})}><${Icon} n="plus" size=${18}/> Добавить упражнение</button>
    </div>
    <${FinishPanel} s=${s} edit=${edit} toast=${toast}/>
    <${SessionSheets} sheet=${sheet} setSheet=${setSheet} s=${s} date=${date} day=${day} edit=${edit} remove=${remove} openAsk=${openAsk} openHistory=${openHistory}
      setDate=${setDate} setDay=${setDay} setWeek=${setWeek} ui=${ui} setUi=${setUi}/>
  </div>`;
}
function textLog(s){
  let t=`## ${s.date} · ${P[s.day].name} · нед. ${s.week}\n`;
  if(s.bw) t+=`Вес утром: ${s.bw} кг`+(s.dur?` · ${s.dur} мин`:"")+"\n";
  s.ex.forEach(e=>{ const sets=e.sets.filter(x=>x.w||x.r).map(x=>`${x.w||"б/в"}×${x.r||"?"}${x.q?" (запас "+x.q+")":""}`).join(", ");
    if(sets||e.note) t+=`- ${xinfo(s,e).name}: ${sets}${e.note?" ("+e.note+")":""}\n`; });
  if(s.note) t+=`Итог: ${s.note}\n`;
  return t;
}

/* ---------- Неделя ---------- */
function WeekView({date,embedded}){
  const [pw,setPw]=useState(null);
  const wk=pw||weekFromDate(date), ws=weekStart(date), we=weekEnd(date);
  const inWeek=sessions().filter(x=>x.date>=ws&&x.date<=we);
  const cols=ORDER.map(k=>{ const real=inWeek.filter(x=>x.day===k).sort((a,b)=>b.date.localeCompare(a.date))[0]; return {k,s:real||defSession(k),real:!!real}; });
  const cnt=c=>e=>c.real?rowsOf(c.s,e):setsFor(xinfo(c.s,e).plan.ns,wk);
  const pd=cols.map(c=>muscleCount(c.s,cnt(c)));
  const perDay=cols.map(c=>c.s.ex.reduce((a,e)=>a+cnt(c)(e),0));
  const fact=MUS.map(()=>0); inWeek.forEach(x=>muscleCount(x,doneOf).forEach((c,k)=>{ fact[k]+=c.f; }));
  const totD=MUS.map((_,k)=>pd.reduce((a,d)=>a+d[k].d,0)), totF=MUS.map((_,k)=>pd.reduce((a,d)=>a+d[k].f,0));
  const hasFact=fact.some(v=>v>0);
  const wid="w_"+ws, wdoc=S.data[wid];
  const max=Math.max(16,...totF,...fact);
  return html`<div>
    ${embedded?null:html`    <header class="wk">
      <div class="wk-top"><div class="wk-name"><h1>Неделя</h1></div><span class="elapsed mute">${dmy(ws).slice(0,5)}–${dmy(we).slice(0,5)}</span></div>
      <div class="wk-meta">
        <div class="stepper"><button aria-label="Неделя назад" onClick=${()=>setPw(Math.max(1,wk-1))}>−</button><span>нед. ${wk}</span><button aria-label="Неделя вперёд" onClick=${()=>setPw(Math.min(6,wk+1))}>+</button></div>
        <span class=${"goal"+(wk===6?" warn":"")}>${WEEKS[wk]}</span>
      </div>
    </header>`}
    <${MuscleBars} zone=${true} rows=${Object.fromEntries(MUS.map((_,k)=>[k,{plan:totF[k],fact:fact[k]}]))}/>
    <div class="tbl"><table>
      <thead><tr><th>Мышца</th>${cols.map(c=>html`<th key=${c.k}><${Plate} k=${c.k}/>${P[c.k].name}${c.real?" •":""}</th>`)}<th>Всего</th><th>Эфф.</th><th>Факт</th></tr></thead>
      <tbody>${MUS_ORDER.filter(k=>totF[k]>0||fact[k]>0).map(k=>html`<tr key=${k}><td>${MUS[k]}</td>
        ${pd.map((d,j)=>d[k].d?html`<td key=${j} class="dir">${d[k].d}</td>`:d[k].f?html`<td key=${j} class="mute">+${fmt(d[k].f)}</td>`:html`<td key=${j} class="mute">–</td>`)}
        <td class="dir">${totD[k]||"–"}</td><td>${fmt(totF[k])}</td>
        <td class=${!hasFact?"":fact[k]>=totF[k]-0.01?"ok":"low"}>${hasFact?fmt(fact[k]):"–"}</td></tr>`)}</tbody>
      <tfoot><tr><td>Подходов за тренировку</td>${perDay.map((n,j)=>html`<td key=${j}>${n}</td>`)}<td>${perDay.reduce((a,b)=>a+b,0)}</td><td></td><td></td></tr></tfoot>
    </table></div>
    <p class="note">Столбцы дней: подходы с высокой нагрузкой (7–10) на мышцу. «•» значит, что тренировка этого дня на этой неделе уже начата и считается по ней, с заменами и добавленными упражнениями. «+1,5» значит, что мышца работает только со средней или низкой нагрузкой. «Эфф.»: эффективные подходы: высокая нагрузка = 1, средняя (4–6) = 0,5, низкая (1–3) = 0,25. «Факт»: то же по сделанным подходам.</p>
    <h3>Разбор недели</h3>
    <${Review} label="Разобрать неделю" stored=${wdoc&&wdoc.summary} disabledMsg="На этой неделе ещё нет записанных тренировок."
      build=${()=>inWeek.some(hasData)?weekPrompt(MUS_ORDER.map(k=>({m:MUS[k],plan:totF[k],fact:fact[k]})),ws,we,inWeek.filter(hasData).sort((a,b)=>a.date.localeCompare(b.date))):""}
      onSave=${t=>putDoc(wid,{kind:"week",start:ws,summary:t})}/>
  </div>`;
}

/* ---------- История ---------- */
function HistoryView({go}){
  const list=sessions().filter(hasData).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  return html`<div>
    <nav class="navrow"><button class="navback" onClick=${()=>go("home")}><${Icon} n="left" size=${22}/>Сводка</button></nav>
    <header class="ttl"><h1>Все тренировки</h1><span class="ttl-s">${list.length} в журнале</span></header>
    ${!list.length?html`<div class="empty">Пока нет записей. Заполни первую тренировку, и она появится здесь.</div>`:html`<div class="list">${list.map(s=>{
      const cnt=s.ex.reduce((a,e)=>a+doneOf(e),0);
      return html`<details class="sess" key=${s.id}><summary><span class="d"><${Plate} k=${s.day}/>${dmy(s.date)} · ${P[s.day].name}</span><span class="s">нед. ${s.week} · ${s.ex.length} упр. · ${cnt} подх.${s.dur?" · "+s.dur+" мин":""}</span></summary>
        <div class="body">
          ${s.bw?html`<div class="mono">Вес утром: ${s.bw} кг</div>`:null}
          ${s.ex.map(e=>{ const sets=e.sets.filter(x=>x.w||x.r).map(x=>`${x.w||"б/в"}×${x.r||"?"}${x.q?"·"+x.q:""}`).join("  "); return sets||e.note?html`<div key=${e.uid}><b>${xinfo(s,e).name}</b><div class="mono">${sets}</div>${e.note?html`<div class="mute">${e.note}</div>`:null}</div>`:null; })}
          ${s.note?html`<div>${s.note}</div>`:null}
          ${s.summary?html`<div class="sum"><${Rich} text=${s.summary}/></div>`:null}
        </div></details>`;
    })}</div>`}
  </div>`;
}

/* ---------- Замеры ---------- */
const BF=[["w","Вес, кг"],["waist","Талия, см"],["arm","Рука, см"],["thigh","Бедро, см"],["bp","Давление"],["hr","Пульс покоя"]];
function BodyView({toast,go}){
  const [f,setF]=useState({date:todayStr()});
  const rows=Object.entries(S.data).filter(([k,v])=>v&&v.kind==="body").map(([k,v])=>Object.assign({id:k},v)).sort((a,b)=>b.date.localeCompare(a.date));
  const submit=ev=>{ ev.preventDefault(); const d=f.date||todayStr(); const rec={kind:"body",date:d}; BF.forEach(([k])=>rec[k]=(f[k]||"").trim()); putDoc("b_"+d,rec); setF({date:todayStr()}); };
  const del=r=>{ const keep=clone(S.data[r.id]); putDoc(r.id,undefined); toast({text:"Замер за "+dmy(r.date)+" удалён",action:"Вернуть",run:()=>putDoc(r.id,keep)}); };
  return html`<div>
    <nav class="navrow"><button class="navback" onClick=${()=>go("home")}><${Icon} n="left" size=${22}/>Сводка</button></nav>
    <header class="ttl"><h1>Вес и замеры</h1></header>
    <form class="form" onSubmit=${submit}>
      <label class="full">Дата<input type="date" value=${f.date} onChange=${ev=>setF(Object.assign({},f,{date:ev.target.value}))}/></label>
      ${BF.map(([k,l])=>html`<label key=${k}>${l}<input type="text" inputmode=${k==="bp"?"text":"decimal"} value=${f[k]||""} onChange=${ev=>setF(Object.assign({},f,{[k]:ev.target.value}))}/></label>`)}
      <button class="btn primary full" type="submit">Добавить замер</button>
    </form>
    <h3>Журнал</h3>
    ${rows.length?html`<div class="tbl"><table><thead><tr><th>Дата</th>${BF.map(([k,l])=>html`<th key=${k}>${l.replace(/, (кг|см)/,"")}</th>`)}<th></th></tr></thead>
      <tbody>${rows.map(r=>html`<tr key=${r.id}><td>${dmy(r.date)}</td>${BF.map(([k])=>html`<td key=${k}>${r[k]||"–"}</td>`)}<td><button class="ibtn danger" aria-label="Удалить замер" onClick=${()=>del(r)}><${Icon} n="trash" size=${16}/></button></td></tr>`)}</tbody></table></div>`
      :html`<div class="empty">Замеров нет. Мерь утром, натощак, в одинаковых условиях.</div>`}
  </div>`;
}

/* ---------- Спросить тренера (чат с действиями) ---------- */
function AskSheet({focus,onClose,date,day,toast}){
  const [turns,setTurns]=useState([]), [input,setInput]=useState(""), [live,setLive]=useState(""), [err,setErr]=useState("");
  const ctl=useRef(null), box=useRef(null);
  const s=getSession(date,day);
  useEffect(()=>{ if(focus!=null&&s.ex[focus]) setInput(`Подбери замену для «${xinfo(s,s.ex[focus]).name}» (упражнение ${focus+1}): `); },[]);
  useEffect(()=>{ const b=box.current&&box.current.parentNode; if(b) b.scrollTop=b.scrollHeight; },[turns,live]);
  const context=()=>{ const cur=getSession(date,day), prev=recent(date,3);
    return `Ты персональный тренер по гипертрофии внутри приложения-дневника тренировок. Отвечай по-русски, коротко и по делу (до 150 слов, если не просят подробнее), списками где уместно. Не называй себя ИИ или Claude, ты просто тренер в приложении. При боли в сухожилии советуй убрать упражнение и показаться спортивному врачу.
${PROFILE}

ТЕКУЩАЯ ТРЕНИРОВКА (упражнения пронумерованы):
${sessionBlock(cur,true)}
${prev.length?"ПОСЛЕДНИЕ ТРЕНИРОВКИ:\n"+prev.map(x=>sessionBlock(x)).join("\n"):""}
${S.tools?`У тебя есть инструменты replace_exercise и add_exercise, они меняют текущую тренировку пользователя. Вызывай их ТОЛЬКО если пользователь прямо просит заменить или добавить упражнение. Нагрузку на мышцы передавай в muscle_levels по шкале 1–10 (в тренажёрах вспомогательные мышцы ниже), мышцы только из списка: ${MUS.join(", ")}. После изменения кратко скажи, что сделал.`:"Менять тренировку сам ты не можешь: если предлагаешь замену, назови упражнение, и пользователь заменит его через «⋯ → Заменить упражнение»."}`; };
  const tools=()=>S.tools?[
    {name:"replace_exercise",description:"Заменяет упражнение в текущей тренировке на другое. Возвращает текст с результатом.",
     inputSchema:{type:"object",properties:{exercise_number:{type:"integer",description:"Номер упражнения в текущей тренировке, начиная с 1"},new_name:{type:"string"},muscle_levels:{type:"object",description:"Нагрузка на мышцы по шкале 1–10, ключи только из списка мышц",additionalProperties:{type:"integer"}},primary_muscles:{type:"array",items:{type:"string",enum:MUS}},secondary_muscles:{type:"array",items:{type:"string",enum:MUS}}},required:["exercise_number","new_name"]},
     execute:inp=>{ const cur=getSession(date,day), i=Math.round(Number(inp.exercise_number))-1, name=String(inp.new_name||"").trim();
       if(!(i>=0&&i<cur.ex.length)) throw new Error("Нет упражнения с таким номером"); if(!name) throw new Error("Пустое название");
       const before=clone(cur.ex[i]), old=xinfo(cur,before).name, m=lvFromTool(inp);
       editSession(date,day,ss=>{ const x=ss.ex.find(y=>y.uid===before.uid); if(!x) return; if(x.base>=0) x.alt=name; else x.name=name; if(Object.keys(m).length){ x.lv=m; delete x.mus; } });
       toast({text:`Заменено: «${old}» → «${name}»`,action:"Вернуть",run:()=>editSession(date,day,ss=>{ const k=ss.ex.findIndex(y=>y.uid===before.uid); if(k>=0) ss.ex[k]=before; })});
       return `Готово: «${old}» заменено на «${name}».`; }},
    {name:"add_exercise",description:"Добавляет упражнение в конец текущей тренировки. Возвращает текст с результатом.",
     inputSchema:{type:"object",properties:{name:{type:"string"},sets:{type:"integer"},reps_min:{type:"integer"},reps_max:{type:"integer"},muscle_levels:{type:"object",description:"Нагрузка на мышцы по шкале 1–10, ключи только из списка мышц",additionalProperties:{type:"integer"}},primary_muscles:{type:"array",items:{type:"string",enum:MUS}},secondary_muscles:{type:"array",items:{type:"string",enum:MUS}}},required:["name","sets","reps_min","reps_max"]},
     execute:inp=>{ const name=String(inp.name||"").trim(); if(!name) throw new Error("Пустое название");
       const n=Math.min(10,Math.max(1,Math.round(Number(inp.sets)||3))), lo=Math.max(1,Math.round(Number(inp.reps_min)||8)), hi=Math.max(lo,Math.round(Number(inp.reps_max)||12)), uid="c"+rid();
       editSession(date,day,ss=>{ ss.ex.push({uid,base:-1,name,n,plan:{ns:n,lo,hi,rir:"1",rest:120,note:""},lv:lvFromTool(inp),sets:Array.from({length:n},blankSet),note:""}); });
       toast({text:`Добавлено: «${name}»`,action:"Убрать",run:()=>editSession(date,day,ss=>{ ss.ex=ss.ex.filter(y=>y.uid!==uid); })});
       return `Готово: добавлено «${name}», ${n}×${lo}–${hi}.`; }}
  ]:undefined;
  const send=async(text)=>{
    const q=(text??input).trim(); if(!q||ctl.current) return;
    const next=[...turns,{role:"user",content:q}]; setTurns(next); setInput(""); setErr(""); setLive("…");
    ctl.current=new AbortController();
    try{ const opts={signal:ctl.current.signal,cache:false,onText:({text})=>setLive(text)}; const t=tools(); if(t) opts.tools=t;
      const r=await S.sample([{role:"user",content:context()},...next.slice(-12)],opts);
      setTurns([...next,{role:"assistant",content:r.text}]); }
    catch(e){ if(e&&e.text) setTurns([...next,{role:"assistant",content:e.text+"\n\n(Ответ прерван.)"}]); if(e&&e.code!=="cancelled") setErr(errText(e)); }
    setLive(""); ctl.current=null;
  };
  const chips=["Тренажёр занят, чем заменить?","Какой вес ставить сегодня?","Дискомфорт в суставе, что делать?","Как правильно делать первое упражнение?","Добавь упражнение на отстающую мышцу"];
  const foot=html`<textarea rows="2" value=${input} placeholder="Например: чем заменить жим лёжа, если болит плечо?" onChange=${ev=>setInput(ev.target.value)} onKeyDown=${ev=>{ if(ev.key==="Enter"&&!ev.shiftKey&&S.sample){ ev.preventDefault(); send(); } }}></textarea>
    ${live?html`<button class="btn" onClick=${()=>ctl.current&&ctl.current.abort()}>Стоп</button>`
      :S.sample?html`<button class="btn primary" aria-label="Отправить" onClick=${()=>send()}><${Icon} n="send" size=${18}/></button>`
      :html`<button class="btn" onClick=${()=>input.trim()&&copyText(context()+"\n\nВОПРОС: "+input.trim(),"Запрос скопирован, вставь его в чат")}>Скопировать</button>`}`;
  return html`<${Sheet} title="Спросить тренера" onClose=${onClose} foot=${foot}>
    <div class="chat" ref=${box}>
      ${!S.sample?html`<div class="st">Помощник недоступен на этой странице. Напиши вопрос и скопируй запрос, чтобы вставить его в чат.</div>`:null}
      ${!turns.length&&!live?html`<div class="st">Тренер видит текущую тренировку, программу и последние записи.${S.tools?" Может сам заменить или добавить упражнение, это отменяется кнопкой «Вернуть».":""}</div>
        <div class="menu">${chips.map(c=>html`<button key=${c} class="mitem" onClick=${()=>S.sample?send(c):setInput(c)}><${Icon} n="spark" size=${16}/><span>${c}</span></button>`)}</div>`:null}
      ${turns.map((t,k)=>html`<div key=${k} class=${"msg "+t.role}>${t.role==="assistant"?html`<${Rich} text=${t.content}/>`:t.content}</div>`)}
      ${live?html`<div class="msg assistant">${live==="…"?html`<span class="st">Думаю…</span>`:html`<${Rich} text=${live}/>`}</div>`:null}
      ${err?html`<div class="st bad">${err}</div>`:null}
      ${turns.length&&!live?html`<button class="btn quiet" onClick=${()=>{ setTurns([]); setErr(""); }}>Начать заново</button>`:null}
    </div>
  <//>`;
}

/* ---------- Таймер, всплывашка, нижние вкладки ---------- */
function Timer({t,onStop,onShift}){
  const [,tick]=useState(0);
  useEffect(()=>{ if(!t) return; const h=setInterval(()=>tick(x=>x+1),250); return ()=>clearInterval(h); },[t]);
  if(!t) return null;
  const left=Math.max(0,Math.round((t.end-Date.now())/1000));
  return html`<div class=${"timer"+(left===0?" done":"")} role="timer">
    <button onClick=${()=>onShift(-15)} aria-label="Минус 15 секунд">−15</button>
    <div class="t">${Math.floor(left/60)}:${String(left%60).padStart(2,"0")}</div>
    <div class="l">${left===0?"Отдых закончен":"Отдых · "+t.label}</div>
    <button onClick=${()=>onShift(15)} aria-label="Плюс 15 секунд">+15</button>
    <button onClick=${onStop} aria-label="Остановить таймер"><${Icon} n="close" size=${16}/></button>
  </div>`;
}
function Toast({t,onClose}){
  const ref=useRef(null);
  useEffect(()=>{ if(!t) return; anim(ref.current,{transform:["translateY(-8px)","translateY(0)"],opacity:[0,1]}); const h=setTimeout(onClose,5000); return ()=>clearTimeout(h); },[t]);
  if(!t) return null;
  return html`<div class="toast" role="status" ref=${ref}><span>${t.text}</span>${t.action?html`<button onClick=${()=>{ t.run(); onClose(); }}>${t.action}</button>`:null}</div>`;
}

function App(){
  useStore();
  const [view,setView]=useState("home");
  const [hist,setHist]=useState(null);
  const [date,setDateRaw]=useState(todayStr());
  const [auto,setAuto]=useState(true);
  const [picked,setPicked]=useState(null);
  const [timer,setTimer]=useState(null);
  const [toast,setToast]=useState(null);
  const [ask,setAsk]=useState(null);
  const [ui,setUiRaw]=useState(()=>{ try{ return localStorage.getItem("trainlog.ui")||"journal"; }catch(e){ return "journal"; } });
  const setUi=v=>{ setUiRaw(v); try{ localStorage.setItem("trainlog.ui",v); }catch(e){} window.scrollTo(0,0); };
  useEffect(()=>{ document.documentElement.dataset.ui=ui; },[ui]);
  const day=picked||defaultDay(date);
  const mainRef=useRef(null);
  useEffect(()=>{ document.documentElement.dataset.day=day; document.documentElement.lang="ru"; },[day]);
  useEffect(()=>{ anim(mainRef.current,{opacity:[0,1]},{type:"tween",duration:.2,ease:[.2,.8,.2,1]}); },[view,day]);
  const setDate=d=>{ setDateRaw(d); setAuto(d===todayStr()); setPicked(null); };
  useEffect(()=>{ const f=()=>{ if(document.visibilityState==="visible"&&auto&&date!==todayStr()){ setDateRaw(todayStr()); setPicked(null); } };
    document.addEventListener("visibilitychange",f); return ()=>document.removeEventListener("visibilitychange",f); },[auto,date]);
  const showToast=t=>setToast(Object.assign({id:rid()},t));
  // сигнал, когда отдых закончился (звук + вибрация, если устройство позволяет)
  useEffect(()=>{ if(!timer) return; const ms=timer.end-Date.now(); if(ms<=0) return;
    const h=setTimeout(()=>beep(),ms); return ()=>clearTimeout(h); },[timer&&timer.end]);
  const tabs=[["home","Сводка","summ"],["train","Тренировка","dumbbell"],["week","Неделя","bars"]];
  const go=v=>{ setView(v); window.scrollTo(0,0); };
  const restFull=ui==="focus"&&view==="train"&&timer&&!timer.hidden;
  useEffect(()=>{ document.documentElement.dataset.view=view; },[view]);
  return html`<${React.Fragment}>
    ${(timer&&!restFull)||toast?html`<div class="topbar">
      <${Timer} t=${restFull?null:timer} onStop=${()=>setTimer(null)} onShift=${d=>setTimer(t=>t&&({...t,end:Math.max(Date.now(),t.end)+d*1000}))}/>
      <${Toast} t=${toast} onClose=${()=>setToast(null)}/>
    </div>`:null}
    ${S.bad?html`<div class="save bad" role="status">${S.status}</div>`:null}
    <main ref=${mainRef}>
      ${view==="train"?html`<${ui==="focus"?FocusView:TrainView} date=${date} setDate=${setDate} day=${day} setDay=${setPicked} toast=${showToast} timer=${timer} setTimer=${setTimer} startTimer=${(sec,label)=>{ unlockSound(); setTimer({end:Date.now()+sec*1000,total:sec,label}); }} openAsk=${i=>setAsk({focus:i})} ui=${ui} setUi=${setUi} openHistory=${setHist} go=${go}/>`
        :view==="home"?html`<${HomeView} date=${date} day=${day} go=${go} openHistory=${setHist}/>`
        :view==="week"?html`<${WeekScreen} date=${date} toast=${showToast}/>`
        :view==="hist"?html`<${HistoryView} go=${go}/>`:html`<${BodyView} toast=${showToast} go=${go}/>`}
    </main>
    ${view==="train"?null:html`<nav class="tabbar" role="tablist">
      ${tabs.map(([k,l,ic])=>html`<button key=${k} role="tab" aria-selected=${String(view===k||(k==="home"&&(view==="body"||view==="hist")))} onClick=${()=>go(k)}><${Icon} n=${ic} size=${24}/><span>${l}</span></button>`)}
      <button class="tb-ask" onClick=${()=>setAsk({focus:null})} aria-label="Спросить тренера"><${Icon} n="star" size=${24}/><span>Тренер</span></button>
    </nav>`}
    ${hist?html`<${ExerciseHistory} name=${hist} onClose=${()=>setHist(null)}/>`:null}
    ${ask?html`<${AskSheet} focus=${ask.focus} date=${date} day=${day} toast=${showToast} onClose=${()=>setAsk(null)}/>`:null}
  <//>`;
}


