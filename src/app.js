/* Дневник тренировок — React 18 + htm (без сборки). Данные программы — в data.js. */
const {useState,useEffect,useRef,useSyncExternalStore}=React;
const html=htm.bind(React.createElement);

/* ---------- Утилиты ---------- */
const todayStr=()=>new Date().toLocaleDateString("sv-SE");
const num=v=>{ const x=parseFloat(String(v??"").replace(",",".")); return isFinite(x)?x:null; };
const fmt=x=>String(Math.round(x*100)/100).replace(".",",");
const rid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const dmy=d=>d.split("-").reverse().join(".");
const dm=d=>d.slice(5).split("-").reverse().join(".");
const clone=o=>JSON.parse(JSON.stringify(o));
function weekStart(d){ const t=new Date(d+"T00:00:00"); t.setDate(t.getDate()-(t.getDay()+6)%7); return t.toLocaleDateString("sv-SE"); }
function weekEnd(d){ const t=new Date(weekStart(d)+"T00:00:00"); t.setDate(t.getDate()+6); return t.toLocaleDateString("sv-SE"); }
const restTxt=r=>r>=60?fmt(r/60)+" мин":r+" с";

// Безопасный мини-markdown: сначала экранируем, потом заголовки, списки, жирный
function md(src){
  const inl=t=>t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`(.+?)`/g,"<code>$1</code>");
  let out="",list=null; const close=()=>{ if(list){ out+="</"+list+">"; list=null; } };
  for(const raw of esc(src).split("\n")){
    const l=raw.trimEnd(); let m;
    if(!l.trim()){ close(); continue; }
    if((m=l.match(/^#{1,4}\s+(.*)/))){ close(); out+="<h4>"+inl(m[1])+"</h4>"; }
    else if((m=l.match(/^\s*[-*•]\s+(.*)/))){ if(list!=="ul"){ close(); out+="<ul>"; list="ul"; } out+="<li>"+inl(m[1])+"</li>"; }
    else if((m=l.match(/^\s*\d+[.)]\s+(.*)/))){ if(list!=="ol"){ close(); out+="<ol>"; list="ol"; } out+="<li>"+inl(m[1])+"</li>"; }
    else { close(); out+="<p>"+inl(l)+"</p>"; }
  }
  close(); return out;
}

/* ---------- Модель упражнения ---------- */
// base>=0 — упражнение программы; base=-1 — добавлено вручную
function xinfo(s,e){
  const row=e.base>=0&&P[s.day]?P[s.day].ex[e.base]:null;
  const plan=row?{ns:row[1],lo:row[2],hi:row[3],rir:row[4],rest:row[5],note:row[6]}:Object.assign({ns:3,lo:8,hi:12,rir:"1",rest:120,note:""},e.plan||{});
  const base=row?row[0]:(e.name||"Упражнение");
  return {row,custom:!row,base,name:row?(e.alt||base):base,plan,mus:e.mus||(row?MAP[s.day][e.base]:null)||{}};
}
const musLists=m=>({prim:Object.keys(m).filter(k=>m[k]===1).map(k=>MUS[k]),sec:Object.keys(m).filter(k=>m[k]&&m[k]<1).map(k=>MUS[k])});
// setsAt(e) -> число подходов; результат по мышцам: d — прямые, f — дробные
function muscleCount(s,setsAt){
  const r=MUS.map(()=>({d:0,f:0}));
  (s.ex||[]).forEach(e=>{ const n=setsAt(e), m=xinfo(s,e).mus; for(const k in m){ if(m[k]===1) r[k].d+=n; r[k].f+=n*m[k]; } });
  return r;
}
const blankSet=()=>({w:"",r:"",ok:false});
const setDone=x=>x.ok||num(x.r)!==null;           // подход засчитан: отмечен или есть повторы (вес не обязателен)
const doneOf=e=>e.sets.filter(setDone).length;
const hasData=s=>s.ex&&s.ex.some(e=>e.sets.some(x=>x.w||x.r||x.ok));
const defSession=k=>({day:k,ex:P[k].ex.map((_,i)=>({base:i,uid:"p"+i,sets:[]}))});
function blankSession(date,day){
  const wk=weekFromDate(date);
  return {kind:"session",date,day,week:wk,bw:"",note:"",done:false,
    ex:P[day].ex.map((e,i)=>({base:i,uid:"p"+i,sets:Array.from({length:setsFor(e[1],wk)},blankSet),note:""}))};
}
function normDoc(v){
  if(v&&v.kind==="session"&&Array.isArray(v.ex)) v.ex.forEach((e,i)=>{
    if(e.base===undefined) e.base=(P[v.day]&&i<P[v.day].ex.length)?i:-1;
    if(!e.uid) e.uid=e.base>=0?"p"+e.base:"c"+i;
    if(!Array.isArray(e.sets)) e.sets=[];
  });
  return v;
}

/* ---------- Хранилище (db артефакта, иначе localStorage) ---------- */
const S={data:{},ver:0,status:"Подключаюсь…",bad:false,db:null,uid:null,connected:false,sample:null,tools:false};
const subs=new Set();
const emit=()=>{ S.ver++; subs.forEach(f=>f()); };
const useStore=()=>useSyncExternalStore(f=>{ subs.add(f); return ()=>subs.delete(f); },()=>S.ver);
const setStatus=(t,bad)=>{ S.status=t; S.bad=!!bad; emit(); };
const LS="trainlog.v1";
const lsRead=()=>{ try{ return JSON.parse(localStorage.getItem(LS)||"{}"); }catch(e){ return {}; } };
const lsWrite=()=>{ try{ localStorage.setItem(LS,JSON.stringify(S.data)); }catch(e){} };
const timers={}, chains={}, pending=new Set(), vers={};
function persist(id){
  clearTimeout(timers[id]); pending.add(id); const v=vers[id]=(vers[id]||0)+1;
  S.status="Сохраняю…"; S.bad=false;
  timers[id]=setTimeout(()=>{
    if(!S.connected) return;                       // допишем после подключения
    if(!S.db){ pending.delete(id); lsWrite(); setStatus("Сохранено на этом устройстве"); return; }
    const data=S.data[id];
    chains[id]=(chains[id]||Promise.resolve()).then(()=>data===undefined
      ? S.db.collection("data/users/"+S.uid).doc(id).delete()
      : S.db.collection("data/users/"+S.uid).doc(id).set(clone(data))
    ).then(()=>{ if(vers[id]===v) pending.delete(id); setStatus("Сохранено"); },()=>setStatus("Не сохранилось. Проверь доступ",true));
  },700);
}
const sessions=()=>Object.entries(S.data).filter(([k,v])=>v&&v.kind==="session").map(([k,v])=>Object.assign({id:k},v));
const sid=(date,day)=>"s_"+date+"_"+day;
function getSession(date,day){ return S.data[sid(date,day)]||blankSession(date,day); }
function editSession(date,day,fn){
  const id=sid(date,day);
  if(!S.data[id]) S.data[id]=blankSession(date,day);
  fn(S.data[id]); persist(id); emit();
}
function putDoc(id,doc){ if(doc===undefined) delete S.data[id]; else S.data[id]=doc; persist(id); emit(); }

function lastTime(name,before){
  let best=null;
  for(const s of sessions()){
    if(s.date>=before||!s.ex) continue;
    for(const e of s.ex){
      if(xinfo(s,e).name!==name||!e.sets.some(x=>num(x.r)!==null)) continue;
      if(!best||s.date>best.date) best={date:s.date,e};
    }
  }
  return best;
}
function defaultDay(date){
  const ss=sessions().filter(hasData);
  const todays=ss.filter(s=>s.date===date);
  if(todays.length) return todays[0].day;
  const prev=ss.filter(s=>s.date<date).sort((a,b)=>b.date.localeCompare(a.date));
  return prev.length?ORDER[(ORDER.indexOf(prev[0].day)+1)%4]:"UA";
}

/* подключение к платформе */
(async()=>{
  const c=window.claude;
  try{
    S.sample=c?await c.use("sample"):null;
    if(S.sample&&S.sample.limits){ const l=await S.sample.limits().catch(()=>null); S.tools=!!(l&&l.tools); }
  }catch(e){ S.sample=null; }
  emit();
})();
(async()=>{
  const c=window.claude;
  try{
    const user=c?await c.use("user"):null;
    S.uid=user&&user.id?await user.id():null;
    S.db=S.uid&&c?await c.use("db"):null;
  }catch(e){ S.db=null; }
  const flush=()=>{ for(const id of [...pending]) persist(id); };
  if(!S.db){
    const local=lsRead(); for(const id in local) if(!pending.has(id)) S.data[id]=normDoc(local[id]);
    S.connected=true; setStatus("Сохранение на этом устройстве"); flush(); return;
  }
  S.db.collection("data/users/"+S.uid).onSnapshot(snap=>{
    const next={};
    snap.docs.forEach(d=>{ next[d.id]=normDoc(clone(d.data())); });   // данные снапшота заморожены — копируем
    for(const id of pending){ if(S.data[id]) next[id]=S.data[id]; else delete next[id]; }
    S.data=next;
    if(!S.connected){ S.connected=true; S.status="Синхронизировано"; flush(); }
    emit();
  },()=>{ S.db=null; S.connected=true; setStatus("Нет синхронизации, пишу на устройство",true); });
})();

/* ---------- Промпты для Клода ---------- */
const PROFILE=`Профиль: мужчина 26 лет, 177 см, ~83 кг, ~20% жира, стаж ~6 месяцев, цель — гипертрофия. Принимает ААС под наблюдением врача, поэтому особое внимание сухожилиям (грудь, дистальный бицепс, надколенник, ахилл) и давлению. Препараты не обсуждай и не советуй.
Программа: верх/низ 4 дня (Верх A, Низ A, Верх B, Низ B), мезоцикл 6 недель: нед.1 RIR 3, нед.2 RIR 2, нед.3 RIR 1–2, нед.4–5 изоляция 0–1 RIR, нед.6 разгрузка (½ подходов, RIR 3–4). Жимы 1–3 RIR, без отказа и отбива; прибавка в базе не более ~5% в неделю. Двойная прогрессия: все подходы на верхней границе повторов при целевом RIR → вес +2,5–5% (изоляция +1–2 кг). Объём 10–16 дробных подходов на мышцу в неделю (прямой = 1, косвенный = 0,5).
Питание: лёгкий дефицит ~2400 ккал, белок ~180 г.`;
function sessionBlock(s,numbered){
  const d=P[s.day]; let t=`${s.date} · ${d.name} · неделя ${s.week}`+(s.bw?` · вес утром ${s.bw} кг`:"")+(s.dur?` · ${s.dur} мин`:"")+"\n";
  s.ex.forEach((e,i)=>{
    const inf=xinfo(s,e), {ns,lo,hi,rir}=inf.plan, {prim,sec}=musLists(inf.mus);
    const sets=e.sets.filter(x=>x.w||x.r).map(x=>`${x.w||"б/в"}×${x.r||"?"}${x.ok?"":" (не отмечен)"}`).join(", ");
    t+=`${numbered?(i+1)+".":"-"} ${inf.name}${e.alt&&!inf.custom?` [замена для «${inf.base}»]`:""}${inf.custom?" [добавлено]":""} · план ${setsFor(ns,s.week)}×${lo}–${hi}, RIR ${rirFor(rir,s.week)}`+
      `${prim.length||sec.length?` · мышцы: ${prim.join(", ")}${sec.length?" (косв.: "+sec.join(", ")+")":""}`:""} · факт: ${sets||"не выполнено"}${e.rir?` · реальный RIR: ${e.rir}`:""}${e.note?` · заметка: ${e.note}`:""}\n`;
  });
  if(s.note) t+=`Самочувствие/сон/боли: ${s.note}\n`;
  return t;
}
const recent=(before,n)=>sessions().filter(x=>x.date<before&&hasData(x)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,n);
function reviewPrompt(s){
  const prev=recent(s.date,4);
  return `Ты опытный тренер по гипертрофии. Разбери мою тренировку и дай конкретные рекомендации.

${PROFILE}

ТРЕНИРОВКА ДЛЯ РАЗБОРА:
${sessionBlock(s)}
${prev.length?"ПРЕДЫДУЩИЕ ТРЕНИРОВКИ:\n"+prev.map(x=>sessionBlock(x)).join("\n"):"Предыдущих тренировок в дневнике нет."}
Ответь по-русски, коротко (до 250 слов), без воды, в структуре:
## Оценка
Одна-две фразы и оценка из 10 за выполнение плана.
## Что хорошо
## На что обратить внимание
(объём, близость к отказу, техника по заметкам, сигналы по сухожилиям и самочувствию)
## Следующая тренировка
Конкретные веса и повторы по ключевым упражнениям этого дня.
Если данных мало или они неполные, так и скажи, не выдумывай.`;
}
function weekPrompt(rows,ws,we,list){
  return `Ты опытный тренер по гипертрофии. Разбери мою тренировочную неделю ${dmy(ws)}–${dmy(we)}.

${PROFILE}

ОБЪЁМ ПО МЫШЦАМ (дробные подходы: план / факт):
${rows.map(r=>`- ${r.m}: ${fmt(r.plan)} / ${fmt(r.fact)}`).join("\n")}

ТРЕНИРОВКИ НЕДЕЛИ:
${list.length?list.map(x=>sessionBlock(x)).join("\n"):"Тренировок не записано."}
Ответь по-русски, до 220 слов, в структуре:
## Итог недели
## Недобор и перебор по мышцам
## Прогресс в ключевых упражнениях
## План на следующую неделю
Не выдумывай данные, которых нет.`;
}
const ERR={not_granted:"Доступ к Клоду не разрешён на этой странице.",rate_limited:"Слишком много запросов или исчерпан лимит. Попробуй позже.",session_expired:"Нужно заново войти в аккаунт.",refused:"Клод не стал отвечать на этот запрос.",sampling_disabled:"Клод недоступен для этого аккаунта."};
const errText=e=>ERR[e&&e.code]||"Не получилось получить ответ. Попробуй ещё раз.";
async function copyText(t,ok){ try{ await navigator.clipboard.writeText(t); setStatus(ok||"Скопировано"); }catch(e){ setStatus("Копирование недоступно",true); } }

async function detectMuscles(name){
  const r=await S.sample.json(`Определи, какие мышцы работают в силовом упражнении «${name}».
Выбирай ТОЛЬКО из списка: ${MUS.join(", ")}.
primary — основные мышцы, ради которых делают упражнение (подход считается за 1), не больше 2.
secondary — заметно работающие вспомогательные (подход за 0,5), не больше 3.
Ответь только JSON вида {"primary":["Грудь"],"secondary":["Трицепс","Передняя дельта"]}`,{modelTier:"quick"});
  return musFromNames(r&&r.primary,r&&r.secondary);
}
function musFromNames(p,s){
  const idx=a=>(Array.isArray(a)?a:[]).map(n=>MUS.indexOf(String(n).trim())).filter(k=>k>=0);
  const prim=idx(p), sec=idx(s).filter(k=>!prim.includes(k));
  const m={}; sec.forEach(k=>m[k]=.5); prim.forEach(k=>m[k]=1); return m;
}
const cycle=v=>v===0?.5:v<1?1:0;

/* ---------- Иконки ---------- */
const I={
  spark:"M12 2.5l1.8 5.2 5.2 1.8-5.2 1.8L12 16.5l-1.8-5.2L5 9.5l5.2-1.8zM18.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z",
  trash:"M4 7h16M9 7V4.5h6V7M18 7l-.8 12.5H6.8L6 7M10 11v5.5M14 11v5.5",
  up:"M6 15l6-6 6 6", down:"M6 9l6 6 6-6", close:"M6 6l12 12M18 6L6 18", send:"M4 12l16-8-6 16-2.5-6.5z",
  check:"M5 12.5l4.5 4.5L19 7.5", arrowUp:"M12 19V5M6 11l6-6 6 6"
};
const PC={UA:"var(--p-blue)",LA:"var(--p-red)",UB:"var(--p-yellow)",LB:"var(--p-green)"};
const Plate=({k})=>html`<i class="plate" style=${{"--c":PC[k]}} aria-hidden="true"></i>`;
// Motion (motion.dev): пружинные анимации; без библиотеки или при reduced motion — просто без анимации
const calm=()=>{ try{ return matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };
function anim(el,kf,o){ try{ if(el&&window.Motion&&!calm()) window.Motion.animate(el,kf,Object.assign({type:"spring",bounce:.22,duration:.45},o||{})); }catch(e){} }
const Icon=({n,size=20})=>n==="spark"
  ? html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d=${I.spark}/></svg>`
  : html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d=${I[n]}/></svg>`;
const Rich=({text})=>html`<div class="rich" dangerouslySetInnerHTML=${{__html:md(text)}}></div>`;

/* ---------- Выбор мышц ---------- */
function MusclePicker({value,onChange}){
  return html`<div class="mus">${MUS.map((m,k)=>{ const v=value[k]||0; return html`<button key=${k} type="button" class=${v===1?"p":v?"s":""} onClick=${()=>{ const n=Object.assign({},value), c=cycle(v); if(c) n[k]=c; else delete n[k]; onChange(n); }}>${m}<small>${v===1?"основная":v?"косвенно":"нет"}</small></button>`; })}</div>`;
}

/* ---------- Карточка упражнения ---------- */
function ExerciseCard({s,i,date,day,edit,onRemove,onAsk,startTimer}){
  const e=s.ex[i], inf=xinfo(s,e), {ns,lo,hi,rir,rest,note}=inf.plan, wk=s.week;
  const [panel,setPanel]=useState(null);
  const [own,setOwn]=useState("");
  const [auto,setAuto]=useState(true);
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(false);
  const planned=setsFor(ns,wk), rows=Math.max(planned,e.sets.length);
  const lt=lastTime(inf.name,date);
  const up=lt&&lt.e.sets.length&&lt.e.sets.every(x=>num(x.r)!==null&&num(x.r)>=hi);
  const {prim,sec}=musLists(inf.mus);
  const done=e.sets.length&&e.sets.slice(0,planned).every(x=>x.ok);
  const upd=fn=>edit(ss=>{ const x=ss.ex.find(y=>y.uid===e.uid); if(x) fn(x,ss); });
  const runDetect=async(name)=>{
    if(!S.sample) return;
    setBusy(true); setMsg(""); setPanel("mus");
    try{
      const m=await detectMuscles(name);
      if(!Object.keys(m).length) throw {};
      upd(x=>{ x.mus=m; });
      const l=musLists(m); setMsg("Клод определил. Основные: "+(l.prim.join(", ")||"нет")+(l.sec.length?". Косвенно: "+l.sec.join(", "):"")+". Можно поправить.");
    }catch(err){ setMsg(err&&err.code==="not_granted"?ERR.not_granted+" Отметь мышцы вручную.":"Не получилось определить. Отметь мышцы вручную."); }
    setBusy(false);
  };
  const rename=nm=>{
    upd(x=>{ if(inf.custom) x.name=nm; else if(nm) x.alt=nm; else { delete x.alt; delete x.mus; } });
    if(nm&&auto&&S.sample) runDetect(nm); else if(nm){ setPanel("mus"); setMsg("Отметь мышцы вручную или нажми «Определить через Клода»."); } else setPanel(null);
    setOwn("");
  };
  const tick=j=>{
    let started=false;
    upd(x=>{ while(x.sets.length<=j) x.sets.push(blankSet()); const st=x.sets[j]; st.ok=!st.ok;
      if(st.ok){ const lp=lt&&lt.e.sets[j]; if(!st.w&&lp&&lp.w) st.w=lp.w; if(!st.r) st.r=String(lp&&lp.r||lo); started=true; } });
    if(started) startTimer(rest,inf.name);
  };
  const setField=(j,f,v)=>upd(x=>{ while(x.sets.length<=j) x.sets.push(blankSet()); x.sets[j][f]=v; });

  return html`<section class=${"ex"+(done?" complete":"")}>
    <div class="ex-head">
      <span class="idx">${String(i+1).padStart(2,"0")}</span>
      <div class="ex-title">
        <h2>${inf.name}</h2>
        ${inf.custom?html`<div class="sub">добавлено вручную</div>`:e.alt?html`<div class="sub">вместо: ${inf.base}</div>`:null}
      </div>
      <div class="mv">
        <button class="ibtn" disabled=${i===0} aria-label="Поднять выше" onClick=${()=>edit(ss=>{ [ss.ex[i-1],ss.ex[i]]=[ss.ex[i],ss.ex[i-1]]; })}><${Icon} n="up"/></button>
        <button class="ibtn" disabled=${i===s.ex.length-1} aria-label="Опустить ниже" onClick=${()=>edit(ss=>{ [ss.ex[i+1],ss.ex[i]]=[ss.ex[i],ss.ex[i+1]]; })}><${Icon} n="down"/></button>
        <button class="ibtn ai" aria-label="Спросить Клода про это упражнение" onClick=${()=>onAsk(i)}><${Icon} n="spark" size=${18}/></button>
        <button class="ibtn danger" aria-label="Убрать упражнение" onClick=${()=>onRemove(i)}><${Icon} n="trash"/></button>
      </div>
    </div>
    <div class="plan spec"><span><b>${planned}×${lo}–${hi}</b></span><span>RIR <b>${rirFor(rir,wk)}</b></span><span>отдых <b>${restTxt(rest)}</b></span></div>
    <div class="plan">${prim.length||sec.length?html`<span>Основные: <b>${prim.join(", ")||"–"}</b></span>${sec.length?html`<span>Косвенно: ${sec.join(", ")}</span>`:null}`:html`<span>Мышцы не указаны. Нажми «Мышцы»</span>`}</div>
    ${note?html`<div class="plan">${note}</div>`:null}
    ${lt?html`<div class=${"hint"+(up?" up":"")}>${up?html`<${Icon} n="arrowUp" size=${16}/>`:null}<span>${up?"Все подходы на верхней границе, добавь вес. ":""}${dm(lt.date)}: ${lt.e.sets.filter(x=>num(x.r)!==null).map(x=>(x.w||"б/в")+"×"+x.r).join(", ")}</span></div>`:null}
    <div class="sets">
      <div class="set head"><span>№</span><span>Прошлый</span><span>кг</span><span>повт</span><span>✓</span></div>
      ${Array.from({length:rows},(_,j)=>{ const x=e.sets[j]||blankSet(), lp=lt&&lt.e.sets[j]||{}; return html`<div class="set" key=${j}>
        <span class="n">${j+1}</span>
        <span class="prev">${lp.r?(lp.w||"б/в")+"×"+lp.r:"–"}</span>
        <input type="text" inputmode="decimal" value=${x.w} placeholder=${lp.w||""} aria-label=${"Вес, подход "+(j+1)} onChange=${ev=>setField(j,"w",ev.target.value)}/>
        <input type="text" inputmode="numeric" value=${x.r} placeholder=${String(lp.r||lo)} aria-label=${"Повторы, подход "+(j+1)} onChange=${ev=>setField(j,"r",ev.target.value)}/>
        <button class="tick" aria-pressed=${String(!!x.ok)} aria-label="Подход выполнен" onClick=${ev=>{ const el=ev.currentTarget; if(!x.ok) anim(el,{transform:["scale(.82)","scale(1)"]},{bounce:.5,duration:.4}); tick(j); }}><${Icon} n="check" size=${22}/></button>
      </div>`; })}
    </div>
    <div class="row-actions">
      <button class="btn" onClick=${()=>upd(x=>{ x.sets.push(blankSet()); })}>+ подход</button>
      ${rows>1?html`<button class="btn quiet" onClick=${()=>upd(x=>{ if(x.sets.length<rows) while(x.sets.length<rows) x.sets.push(blankSet()); x.sets.pop(); })}>− подход</button>`:null}
      ${lt?html`<button class="btn quiet" onClick=${()=>upd(x=>{ x.sets=lt.e.sets.map(y=>({w:y.w,r:y.r,ok:false})); })}>Как в прошлый раз</button>`:null}
      <button class="btn quiet" onClick=${()=>setPanel(panel==="swap"?null:"swap")}>${inf.custom?"Переименовать":"Заменить"}</button>
      <button class="btn quiet" onClick=${()=>{ setPanel(panel==="mus"?null:"mus"); setMsg(""); }}>Мышцы</button>
    </div>
    ${panel==="swap"?html`<div class="swap">
      ${!inf.custom?html`<div class="opts">${(ALT[inf.base]||[]).filter(a=>a!==inf.name).map(a=>html`<button key=${a} onClick=${()=>rename(a)}>${a}</button>`)}${e.alt?html`<button onClick=${()=>rename("")}>↩ ${inf.base}</button>`:null}</div>`:null}
      <div class="own"><input type="text" value=${own} onChange=${ev=>setOwn(ev.target.value)} placeholder=${inf.custom?"Новое название":"Своё упражнение"} aria-label="Название упражнения"/><button class="btn" onClick=${()=>own.trim()&&rename(own.trim())}>Взять</button></div>
      <label class="chk"><input type="checkbox" checked=${auto&&!!S.sample} disabled=${!S.sample} onChange=${ev=>setAuto(ev.target.checked)}/> Мышцы определит Клод (иначе отмечу вручную)</label>
    </div>`:null}
    ${panel==="mus"?html`<div class="swap">
      <${MusclePicker} value=${inf.mus} onChange=${m=>upd(x=>{ x.mus=m; })}/>
      <div class="st">Нажимай на мышцу: нет → косвенно (0,5) → основная (1).</div>
      ${S.sample?html`<div class="row-actions"><button class="btn primary" disabled=${busy} onClick=${()=>runDetect(inf.name)}><${Icon} n="spark" size=${16}/> ${busy?"Клод определяет…":"Определить через Клода"}</button></div>`:null}
      ${msg?html`<div class="st">${msg}</div>`:null}
    </div>`:null}
    <input class="ririn" type="text" value=${e.rir||""} placeholder="Реальный RIR в последнем подходе" aria-label="Реальный RIR" onChange=${ev=>upd(x=>{ x.rir=ev.target.value; })}/>
    <textarea rows="1" value=${e.note||""} placeholder="Заметка (техника, боль, ощущения)" aria-label="Заметка к упражнению" onChange=${ev=>upd(x=>{ x.note=ev.target.value; })}></textarea>
  </section>`;
}

/* ---------- Добавление упражнения ---------- */
function AddExercise({edit}){
  const [open,setOpen]=useState(false);
  const [f,setF]=useState({name:"",n:"3",lo:"8",hi:"12"});
  const [mode,setMode]=useState("ai");
  const [mus,setMus]=useState({});
  const [msg,setMsg]=useState("");
  const m=S.sample?mode:"manual";
  if(!open) return html`<div class="addbox"><button class="btn" onClick=${()=>setOpen(true)}>+ Добавить упражнение</button>${msg?html`<div class="st">${msg}</div>`:null}</div>`;
  const add=async()=>{
    const name=f.name.trim(); if(!name) return;
    const cl=(v,a,z,d)=>Math.min(z,Math.max(a,Math.round(num(v)??d)));
    const n=cl(f.n,1,10,3), lo=cl(f.lo,1,100,8), hi=Math.max(lo,cl(f.hi,1,100,12)), uid="c"+rid();
    edit(ss=>{ ss.ex.push({uid,base:-1,name,plan:{ns:n,lo,hi,rir:"1",rest:120,note:""},mus:m==="manual"?mus:{},sets:Array.from({length:n},blankSet),note:""}); });
    setOpen(false); setF({name:"",n:"3",lo:"8",hi:"12"}); setMus({});
    if(m==="ai"){
      setMsg("Клод определяет мышцы для «"+name+"»…");
      try{ const r=await detectMuscles(name); edit(ss=>{ const x=ss.ex.find(y=>y.uid===uid); if(x) x.mus=r; }); const l=musLists(r); setMsg("«"+name+"». Основные: "+(l.prim.join(", ")||"нет")+(l.sec.length?". Косвенно: "+l.sec.join(", "):"")+"."); }
      catch(e){ setMsg("Клод не смог определить мышцы для «"+name+"». Отметь их кнопкой «Мышцы»."); }
    } else setMsg("");
  };
  const inp=(k,label,mode_)=>html`<label class=${k==="name"?"full":""}>${label}<input type="text" inputmode=${mode_} value=${f[k]} onChange=${ev=>setF(Object.assign({},f,{[k]:ev.target.value}))} placeholder=${k==="name"?"Например, Жим Свенда":""}/></label>`;
  return html`<div class="addbox"><div class="adform">
    ${inp("name","Название","text")}${inp("n","Подходы","numeric")}${inp("lo","Повт. от","numeric")}${inp("hi","Повт. до","numeric")}
    <div class="full st">Мышцы:</div>
    <div class="full seg" role="group" aria-label="Как заполнить мышцы">
      <button aria-pressed=${String(m==="ai")} disabled=${!S.sample} onClick=${()=>setMode("ai")}>Через Клода</button>
      <button aria-pressed=${String(m==="manual")} onClick=${()=>setMode("manual")}>Вручную</button>
    </div>
    ${m==="manual"?html`<div class="full"><${MusclePicker} value=${mus} onChange=${setMus}/></div>`:html`<div class="full st">После добавления Клод сам отметит основные и косвенные мышцы. Поправить можно в «Мышцы».</div>`}
    <div class="row-actions full"><button class="btn primary" onClick=${add}>Добавить в тренировку</button><button class="btn quiet" onClick=${()=>setOpen(false)}>Отмена</button></div>
  </div></div>`;
}

/* ---------- Разбор (тренировки или недели) ---------- */
function Review({label,stored,build,onSave,disabledMsg}){
  const [live,setLive]=useState("");
  const [err,setErr]=useState("");
  const ctl=useRef(null);
  const run=async()=>{
    const p=build(); if(!p){ setErr(disabledMsg); return; }
    ctl.current=new AbortController(); setErr(""); setLive("…");
    try{
      const r=await S.sample(p,{signal:ctl.current.signal,cache:false,onText:({text})=>setLive(text)});
      onSave(r.text+(r.truncated?"\n\n(Ответ оборван, запроси ещё раз.)":"")); setLive("");
    }catch(e){ setLive(""); if(e&&e.code!=="cancelled") setErr(e&&e.text?"":errText(e)); if(e&&e.text) onSave(e.text+"\n\n(Ответ прерван.)"); }
    ctl.current=null;
  };
  return html`<div class="review">
    <div class="row-actions">
      ${S.sample?html`<button class="btn primary" disabled=${!!live} onClick=${run}><${Icon} n="spark" size=${16}/> ${stored?label+" заново":label}</button>`:null}
      <button class="btn" onClick=${()=>{ const p=build(); p?copyText(p,"Запрос скопирован. Вставь его в чат с Клодом"):setErr(disabledMsg); }}>Скопировать запрос</button>
    </div>
    ${live?html`<div class="sum">${live==="…"?html`<div class="st">Клод думает… Ответ может прийти через полминуты.</div>`:html`<${Rich} text=${live}/>`}<div class="row-actions"><button class="btn" onClick=${()=>ctl.current&&ctl.current.abort()}>Стоп</button></div></div>`
      :stored?html`<div class="sum"><${Rich} text=${stored}/></div>`:null}
    ${err?html`<div class="st">${err}</div>`:null}
  </div>`;
}

/* ---------- Тренировка ---------- */
function TrainView({date,setDate,day,setDay,toast,startTimer,openAsk}){
  const s=getSession(date,day), wk=s.week;
  const edit=fn=>editSession(date,day,fn);
  const counts=muscleCount(s,e=>Math.max(e.sets.length,setsFor(xinfo(s,e).plan.ns,wk)));
  const remove=i=>{
    const entry=clone(s.ex[i]), name=xinfo(s,entry).name;
    edit(ss=>{ ss.ex.splice(i,1); });
    toast({text:`«${name}» убрано`,action:"Вернуть",run:()=>edit(ss=>{ ss.ex.splice(Math.min(i,ss.ex.length),0,entry); })});
  };
  const setWeek=d=>edit(ss=>{ ss.week=Math.min(6,Math.max(1,ss.week+d));
    ss.ex.forEach(e=>{ if(e.sets.some(x=>x.w||x.r||x.ok)) return; const want=setsFor(xinfo(ss,e).plan.ns,ss.week); e.sets=Array.from({length:want},blankSet); }); });
  return html`<div>
    <div class="days" role="group" aria-label="День программы">${ORDER.map(k=>html`<button key=${k} aria-pressed=${String(k===day)} onClick=${()=>setDay(k)}><${Plate} k=${k}/><b>${P[k].name}</b><small>${P[k].sub}</small></button>`)}</div>
    <div class="mchips" aria-label="Подходы по мышцам в этой тренировке">${counts.map((c,k)=>c.d?html`<span key=${k} title=${MUS[k]+": "+fmt(c.d)+" прямых, "+fmt(c.f)+" дробных"}><b>${c.d}</b> ${MUS[k]}</span>`:c.f?html`<span key=${k} class="ind" title=${MUS[k]+": только косвенная нагрузка"}>+${fmt(c.f)} ${MUS[k]}</span>`:null)}</div>
    <div class="meta" style=${{marginTop:"10px"}}>
      <input type="date" value=${date} aria-label="Дата" onChange=${ev=>ev.target.value&&setDate(ev.target.value)}/>
      ${date!==todayStr()?html`<button class="btn" onClick=${()=>setDate(todayStr())}>Сегодня</button>`:null}
      <div class="stepper"><button aria-label="Неделя назад" onClick=${()=>setWeek(-1)}>−</button><span>Неделя ${wk}</span><button aria-label="Неделя вперёд" onClick=${()=>setWeek(1)}>+</button></div>
      <span class=${"chip"+(wk===6?" warn":"")}>${WEEKS[wk]}</span>
    </div>
    <div class="cards">
      ${s.ex.map((e,i)=>html`<${ExerciseCard} key=${e.uid} s=${s} i=${i} date=${date} day=${day} edit=${edit} onRemove=${remove} onAsk=${openAsk} startTimer=${startTimer}/>`)}
      ${!s.ex.length?html`<div class="empty">В тренировке нет упражнений. Добавь их ниже.</div>`:null}
      <${AddExercise} edit=${edit}/>
    </div>
    <div class="foot">
      <div class="form" style=${{margin:0}}>
        <label>Вес утром, кг<input type="text" inputmode="decimal" value=${s.bw||""} onChange=${ev=>edit(ss=>{ ss.bw=ev.target.value; })}/></label>
        <label>Длительность, мин<input type="text" inputmode="numeric" value=${s.dur||""} onChange=${ev=>edit(ss=>{ ss.dur=ev.target.value; })}/></label>
        <label class="full">Самочувствие, сон, боли<textarea rows="2" value=${s.note||""} onChange=${ev=>edit(ss=>{ ss.note=ev.target.value; })}></textarea></label>
      </div>
      <div class="row-actions">
        <button class=${"btn "+(s.done?"ok":"primary")} onClick=${()=>edit(ss=>{ ss.done=!ss.done; })}>${s.done?"Тренировка завершена ✓":"Завершить тренировку"}</button>
        <button class="btn" onClick=${()=>copyText(textLog(s))}>Копировать как текст</button>
      </div>
      <h3>Разбор тренировки</h3>
      <${Review} label="Разобрать тренировку" stored=${s.summary} disabledMsg="Сначала впиши хотя бы один подход."
        build=${()=>hasData(s)?reviewPrompt(s):""} onSave=${t=>edit(ss=>{ ss.summary=t; })}/>
    </div>
  </div>`;
}
function textLog(s){
  let t=`## ${s.date} · ${P[s.day].name} · нед. ${s.week}\n`;
  if(s.bw) t+=`Вес утром: ${s.bw} кг`+(s.dur?` · ${s.dur} мин`:"")+"\n";
  s.ex.forEach(e=>{ const sets=e.sets.filter(x=>x.w||x.r).map(x=>`${x.w||"б/в"}×${x.r||"?"}`).join(", ");
    if(sets||e.note) t+=`- ${xinfo(s,e).name}: ${sets}${e.rir?" · RIR "+e.rir:""}${e.note?" ("+e.note+")":""}\n`; });
  if(s.note) t+=`Итог: ${s.note}\n`;
  return t;
}

/* ---------- Неделя ---------- */
function WeekView({date}){
  const [pw,setPw]=useState(null);
  const wk=pw||weekFromDate(date), ws=weekStart(date), we=weekEnd(date);
  const inWeek=sessions().filter(x=>x.date>=ws&&x.date<=we);
  // столбец дня: тренировка этого дня на этой неделе (с заменами и добавленными), иначе программа
  const cols=ORDER.map(k=>{ const real=inWeek.filter(x=>x.day===k).sort((a,b)=>b.date.localeCompare(a.date))[0]; return {k,s:real||defSession(k),real:!!real}; });
  const pd=cols.map(c=>muscleCount(c.s,e=>c.real?Math.max(e.sets.length,setsFor(xinfo(c.s,e).plan.ns,wk)):setsFor(xinfo(c.s,e).plan.ns,wk)));
  const perDay=cols.map(c=>c.s.ex.reduce((a,e)=>a+(c.real?Math.max(e.sets.length,setsFor(xinfo(c.s,e).plan.ns,wk)):setsFor(xinfo(c.s,e).plan.ns,wk)),0));
  const fact=MUS.map(()=>0); inWeek.forEach(x=>muscleCount(x,doneOf).forEach((c,k)=>{ fact[k]+=c.f; }));
  const totD=MUS.map((_,k)=>pd.reduce((a,d)=>a+d[k].d,0)), totF=MUS.map((_,k)=>pd.reduce((a,d)=>a+d[k].f,0));
  const hasFact=fact.some(v=>v>0);
  const wid="w_"+ws, wdoc=S.data[wid];
  return html`<div>
    <div class="meta" style=${{marginTop:"6px"}}>
      <div class="stepper"><button aria-label="Неделя назад" onClick=${()=>setPw(Math.max(1,wk-1))}>−</button><span>Неделя ${wk}</span><button aria-label="Неделя вперёд" onClick=${()=>setPw(Math.min(6,wk+1))}>+</button></div>
      <span class=${"chip"+(wk===6?" warn":"")}>${WEEKS[wk]}</span>
      <span class="st">${dmy(ws).slice(0,5)}–${dmy(we).slice(0,5)}</span>
    </div>
    <div class="tbl"><table>
      <thead><tr><th>Мышца</th>${cols.map(c=>html`<th key=${c.k}><${Plate} k=${c.k}/>${P[c.k].name}${c.real?" •":""}</th>`)}<th>Всего</th><th>Дроб.</th><th>Факт</th></tr></thead>
      <tbody>${MUS.map((m,k)=>html`<tr key=${k}><td>${m}</td>
        ${pd.map((d,j)=>d[k].d?html`<td key=${j} class="dir">${d[k].d}</td>`:d[k].f?html`<td key=${j} class="mute">+${fmt(d[k].f)}</td>`:html`<td key=${j} class="mute">–</td>`)}
        <td class="dir">${totD[k]||"–"}</td><td>${fmt(totF[k])}</td>
        <td class=${!hasFact?"":fact[k]>=totF[k]-0.01?"ok":"low"}>${hasFact?fmt(fact[k]):"–"}</td></tr>`)}</tbody>
      <tfoot><tr><td>Подходов за тренировку</td>${perDay.map((n,j)=>html`<td key=${j}>${n}</td>`)}<td>${perDay.reduce((a,b)=>a+b,0)}</td><td></td><td></td></tr></tfoot>
    </table></div>
    <p class="note"><b>Верх A … Низ B</b>: прямые подходы на мышцу. «•» значит, что тренировка этого дня на этой неделе уже начата и столбец считается по ней, с заменами и добавленными упражнениями. Без «•» столбец по программе. «+1,5» значит только косвенную нагрузку. <b>Дроб.</b>: прямой подход = 1, косвенный = 0,5, ориентир 10–16 в неделю. <b>Факт</b>: подходы с галочкой или с записанными повторами (вес не обязателен) за ${dmy(ws).slice(0,5)}–${dmy(we).slice(0,5)}. Зелёный значит, что план выполнен.</p>
    <h3>Разбор недели</h3>
    <${Review} label="Разобрать неделю" stored=${wdoc&&wdoc.summary} disabledMsg="На этой неделе ещё нет записанных тренировок."
      build=${()=>inWeek.some(hasData)?weekPrompt(MUS.map((m,k)=>({m,plan:totF[k],fact:fact[k]})),ws,we,inWeek.filter(hasData).sort((a,b)=>a.date.localeCompare(b.date))):""}
      onSave=${t=>putDoc(wid,{kind:"week",start:ws,summary:t})}/>
  </div>`;
}

/* ---------- История ---------- */
function HistoryView(){
  const list=sessions().filter(hasData).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  if(!list.length) return html`<div class="empty">Пока нет записей. Заполни первую тренировку, и она появится здесь.</div>`;
  return html`<div class="list">${list.map(s=>{
    let vol=0,cnt=0; s.ex.forEach(e=>e.sets.forEach(x=>{ const w=num(x.w),r=num(x.r); if(r!==null){ cnt++; if(w!==null) vol+=w*r; } }));
    return html`<details class="sess" key=${s.id}><summary><span class="d"><${Plate} k=${s.day}/>${dmy(s.date)} · ${P[s.day].name}</span><span class="s">нед. ${s.week} · ${cnt} подх. · ${Math.round(vol).toLocaleString("ru")} кг${s.done?" · ✓":""}</span></summary>
      <div class="body">
        ${s.bw?html`<div class="mono">Вес утром: ${s.bw} кг${s.dur?" · "+s.dur+" мин":""}</div>`:null}
        ${s.ex.map(e=>{ const sets=e.sets.filter(x=>x.w||x.r).map(x=>`${x.w||"б/в"}×${x.r||"?"}`).join(", "); return sets||e.note?html`<div key=${e.uid}><b>${xinfo(s,e).name}</b><br/><span class="mono">${sets}</span>${e.note?html`<br/>${e.note}`:null}</div>`:null; })}
        ${s.note?html`<div>${s.note}</div>`:null}
        ${s.summary?html`<div class="sum"><${Rich} text=${s.summary}/></div>`:null}
      </div></details>`;
  })}</div>`;
}

/* ---------- Замеры ---------- */
const BF=[["w","Вес, кг"],["waist","Талия, см"],["arm","Рука, см"],["thigh","Бедро, см"],["bp","Давление"],["hr","Пульс покоя"]];
function BodyView({toast}){
  const [f,setF]=useState({date:todayStr()});
  const rows=Object.entries(S.data).filter(([k,v])=>v&&v.kind==="body").map(([k,v])=>Object.assign({id:k},v)).sort((a,b)=>b.date.localeCompare(a.date));
  const submit=ev=>{ ev.preventDefault(); const d=f.date||todayStr(); const rec={kind:"body",date:d}; BF.forEach(([k])=>rec[k]=(f[k]||"").trim()); putDoc("b_"+d,rec); setF({date:todayStr()}); };
  const del=r=>{ const keep=clone(S.data[r.id]); putDoc(r.id,undefined); toast({text:"Замер за "+dmy(r.date)+" удалён",action:"Вернуть",run:()=>putDoc(r.id,keep)}); };
  return html`<div>
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

/* ---------- Спросить Клода (чат с действиями) ---------- */
function AskSheet({open,onClose,date,day,focus,toast}){
  const [turns,setTurns]=useState([]);
  const [input,setInput]=useState("");
  const [live,setLive]=useState("");
  const [err,setErr]=useState("");
  const ctl=useRef(null), box=useRef(null), ta=useRef(null), sheet=useRef(null);
  useEffect(()=>{ if(open) anim(sheet.current,{transform:["translateY(60px)","translateY(0)"]},{bounce:.18,duration:.5}); },[open]);
  const s=getSession(date,day);
  useEffect(()=>{ if(open&&focus!=null&&s.ex[focus]) setInput(`Подбери замену для «${xinfo(s,s.ex[focus]).name}» (упражнение ${focus+1}): `); if(open) setTimeout(()=>ta.current&&ta.current.focus(),50); },[open,focus]);
  useEffect(()=>{ if(box.current) box.current.scrollTop=box.current.scrollHeight; },[turns,live]);
  if(!open) return null;

  const context=()=>{ const cur=getSession(date,day), prev=recent(date,3);
    return `Ты персональный тренер по гипертрофии внутри приложения-дневника тренировок. Отвечай по-русски, коротко и по делу (до 150 слов, если не просят подробнее), списками где уместно. При боли в сухожилии советуй убрать упражнение и показаться спортивному врачу.
${PROFILE}

ТЕКУЩАЯ ТРЕНИРОВКА (упражнения пронумерованы):
${sessionBlock(cur,true)}
${prev.length?"ПОСЛЕДНИЕ ТРЕНИРОВКИ:\n"+prev.map(x=>sessionBlock(x)).join("\n"):""}
${S.tools?`У тебя есть инструменты replace_exercise и add_exercise, они меняют текущую тренировку пользователя. Вызывай их ТОЛЬКО если пользователь прямо просит заменить или добавить упражнение. Мышцы выбирай только из списка: ${MUS.join(", ")}. После изменения кратко скажи, что сделал.`:"Изменять тренировку сам ты не можешь: если предлагаешь замену, назови упражнение, и пользователь заменит его кнопкой «Заменить»."}`; };

  const tools=()=>S.tools?[
    {name:"replace_exercise",description:"Заменяет упражнение в текущей тренировке на другое. Возвращает текст с результатом.",
     inputSchema:{type:"object",properties:{exercise_number:{type:"integer",description:"Номер упражнения в текущей тренировке, начиная с 1"},new_name:{type:"string"},primary_muscles:{type:"array",items:{type:"string",enum:MUS}},secondary_muscles:{type:"array",items:{type:"string",enum:MUS}}},required:["exercise_number","new_name"]},
     execute:inp=>{ const cur=getSession(date,day), i=Math.round(Number(inp.exercise_number))-1, name=String(inp.new_name||"").trim();
       if(!(i>=0&&i<cur.ex.length)) throw new Error("Нет упражнения с таким номером"); if(!name) throw new Error("Пустое название");
       const before=clone(cur.ex[i]), old=xinfo(cur,before).name, m=musFromNames(inp.primary_muscles,inp.secondary_muscles);
       editSession(date,day,ss=>{ const x=ss.ex.find(y=>y.uid===before.uid); if(!x) return; if(x.base>=0) x.alt=name; else x.name=name; if(Object.keys(m).length) x.mus=m; });
       toast({text:`Клод заменил «${old}» на «${name}»`,action:"Вернуть",run:()=>editSession(date,day,ss=>{ const k=ss.ex.findIndex(y=>y.uid===before.uid); if(k>=0) ss.ex[k]=before; })});
       return `Готово: «${old}» заменено на «${name}».`; }},
    {name:"add_exercise",description:"Добавляет упражнение в конец текущей тренировки. Возвращает текст с результатом.",
     inputSchema:{type:"object",properties:{name:{type:"string"},sets:{type:"integer"},reps_min:{type:"integer"},reps_max:{type:"integer"},primary_muscles:{type:"array",items:{type:"string",enum:MUS}},secondary_muscles:{type:"array",items:{type:"string",enum:MUS}}},required:["name","sets","reps_min","reps_max"]},
     execute:inp=>{ const name=String(inp.name||"").trim(); if(!name) throw new Error("Пустое название");
       const n=Math.min(10,Math.max(1,Math.round(Number(inp.sets)||3))), lo=Math.max(1,Math.round(Number(inp.reps_min)||8)), hi=Math.max(lo,Math.round(Number(inp.reps_max)||12)), uid="c"+rid();
       editSession(date,day,ss=>{ ss.ex.push({uid,base:-1,name,plan:{ns:n,lo,hi,rir:"1",rest:120,note:""},mus:musFromNames(inp.primary_muscles,inp.secondary_muscles),sets:Array.from({length:n},blankSet),note:""}); });
       toast({text:`Клод добавил «${name}»`,action:"Убрать",run:()=>editSession(date,day,ss=>{ ss.ex=ss.ex.filter(y=>y.uid!==uid); })});
       return `Готово: добавлено «${name}», ${n}×${lo}–${hi}.`; }}
  ]:undefined;

  const send=async(text)=>{
    const q=(text??input).trim(); if(!q||ctl.current) return;
    const next=[...turns,{role:"user",content:q}]; setTurns(next); setInput(""); setErr(""); setLive("…");
    ctl.current=new AbortController();
    try{
      const opts={signal:ctl.current.signal,cache:false,onText:({text})=>setLive(text)}; const t=tools(); if(t) opts.tools=t;
      const r=await S.sample([{role:"user",content:context()},...next.slice(-12)],opts);
      setTurns([...next,{role:"assistant",content:r.text}]);
    }catch(e){
      if(e&&e.text) setTurns([...next,{role:"assistant",content:e.text+"\n\n(Ответ прерван.)"}]);
      if(e&&e.code!=="cancelled") setErr(errText(e));
    }
    setLive(""); ctl.current=null;
  };
  const chips=["Подбери замену упражнению: тренажёр занят","Какой вес ставить сегодня по ключевым упражнениям?","Чувствую дискомфорт в суставе. Что делать?","Как правильно выполнять первое упражнение?","Добавь упражнение на отстающую мышцу"];
  return html`<div class="sheet-wrap" onClick=${ev=>{ if(ev.target.classList.contains("sheet-wrap")) onClose(); }}>
    <div class="sheet" role="dialog" aria-label="Спросить Клода" ref=${sheet}>
      <div class="sheet-head"><b><${Icon} n="spark" size=${18}/> Спросить Клода</b>
        ${turns.length?html`<button class="btn quiet" onClick=${()=>{ setTurns([]); setErr(""); }}>Новый чат</button>`:null}
        <button class="ibtn" aria-label="Закрыть" onClick=${onClose}><${Icon} n="close"/></button></div>
      <div class="sheet-body" ref=${box}>
        ${!S.sample?html`<div class="st">Клод недоступен на этой странице. Напиши вопрос и нажми «Скопировать запрос», затем вставь его в чат с Клодом.</div>`:null}
        ${!turns.length&&!live?html`<div class="st">Клод видит текущую тренировку, программу и последние записи.${S.tools?" Может сам заменить или добавить упражнение. Всё отменяется кнопкой «Вернуть».":""}</div>
          <div class="opts">${chips.map(c=>html`<button key=${c} onClick=${()=>S.sample?send(c):setInput(c)}>${c}</button>`)}</div>`:null}
        ${turns.map((t,k)=>html`<div key=${k} class=${"msg "+t.role}>${t.role==="assistant"?html`<${Rich} text=${t.content}/>`:t.content}</div>`)}
        ${live?html`<div class="msg assistant">${live==="…"?html`<span class="st">Клод думает…</span>`:html`<${Rich} text=${live}/>`}</div>`:null}
        ${err?html`<div class="st bad">${err}</div>`:null}
      </div>
      <div class="sheet-foot">
        <textarea ref=${ta} rows="2" value=${input} placeholder="Например: чем заменить жим лёжа, если болит плечо?" onChange=${ev=>setInput(ev.target.value)} onKeyDown=${ev=>{ if(ev.key==="Enter"&&!ev.shiftKey&&S.sample){ ev.preventDefault(); send(); } }}></textarea>
        ${live?html`<button class="btn" onClick=${()=>ctl.current&&ctl.current.abort()}>Стоп</button>`
          :S.sample?html`<button class="btn primary" aria-label="Отправить" onClick=${()=>send()}><${Icon} n="send" size=${18}/></button>`
          :html`<button class="btn" onClick=${()=>input.trim()&&copyText(context()+"\n\nВОПРОС: "+input.trim(),"Запрос скопирован. Вставь его в чат с Клодом")}>Скопировать запрос</button>`}
      </div>
    </div>
  </div>`;
}

/* ---------- Таймер отдыха и всплывашка ---------- */
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
    <button onClick=${onStop}>Стоп</button>
  </div>`;
}
function Toast({t,onClose,raised}){
  const ref=useRef(null);
  useEffect(()=>{ if(!t) return; anim(ref.current,{transform:["translateY(24px)","translateY(0)"],opacity:[0,1]}); const h=setTimeout(onClose,5000); return ()=>clearTimeout(h); },[t]);
  if(!t) return null;
  return html`<div class=${"toast"+(raised?" raised":"")} role="status" ref=${ref}><span>${t.text}</span>${t.action?html`<button onClick=${()=>{ t.run(); onClose(); }}>${t.action}</button>`:null}</div>`;
}

/* ---------- Приложение ---------- */
function App(){
  useStore();
  const [view,setView]=useState("train");
  const [date,setDateRaw]=useState(todayStr());
  const [auto,setAuto]=useState(true);
  const [picked,setPicked]=useState(null);
  const [timer,setTimer]=useState(null);
  const [toast,setToast]=useState(null);
  const [ask,setAsk]=useState({open:false,focus:null});
  const day=picked||defaultDay(date);
  const mainRef=useRef(null);
  useEffect(()=>{ document.documentElement.dataset.day=day; document.documentElement.lang="ru"; },[day]);
  useEffect(()=>{ anim(mainRef.current,{opacity:[0,1],transform:["translateY(6px)","translateY(0)"]},{type:"tween",duration:.22,ease:[.2,.8,.2,1]}); },[view,day]);
  const setDate=d=>{ setDateRaw(d); setAuto(d===todayStr()); setPicked(null); };
  useEffect(()=>{ const f=()=>{ if(document.visibilityState==="visible"&&auto&&date!==todayStr()){ setDateRaw(todayStr()); setPicked(null); } };
    document.addEventListener("visibilitychange",f); return ()=>document.removeEventListener("visibilitychange",f); },[auto,date]);
  const startTimer=(sec,label)=>setTimer({end:Date.now()+sec*1000,label});
  const showToast=t=>setToast(Object.assign({id:rid()},t));
  const tabs=[["train","Тренировка"],["week","Неделя"],["hist","История"],["body","Замеры"]];
  return html`<${React.Fragment}>
    <div class="top">
      <div class="brand"><h1>Дневник тренировок</h1><span class=${"save"+(S.bad?" bad":"")} role="status">${S.status}</span></div>
      <div class="nav" role="tablist">${tabs.map(([k,l])=>html`<button key=${k} role="tab" aria-selected=${String(view===k)} onClick=${()=>{ setView(k); window.scrollTo(0,0); }}>${l}</button>`)}</div>
    </div>
    <main ref=${mainRef}>
      ${view==="train"?html`<${TrainView} date=${date} setDate=${setDate} day=${day} setDay=${setPicked} toast=${showToast} startTimer=${startTimer} openAsk=${i=>setAsk({open:true,focus:i})}/>`
        :view==="week"?html`<${WeekView} date=${date}/>`
        :view==="hist"?html`<${HistoryView}/>`:html`<${BodyView} toast=${showToast}/>`}
    </main>
    <button class=${"fab"+(timer?" raised":"")} onClick=${()=>setAsk({open:true,focus:null})} aria-label="Спросить Клода"><${Icon} n="spark" size=${26}/></button>
    <${Toast} t=${toast} raised=${!!timer} onClose=${()=>setToast(null)}/>
    <${Timer} t=${timer} onStop=${()=>setTimer(null)} onShift=${d=>setTimer(t=>t&&({...t,end:Math.max(Date.now(),t.end)+d*1000}))}/>
    <${AskSheet} open=${ask.open} focus=${ask.focus} date=${date} day=${day} toast=${showToast} onClose=${()=>setAsk({open:false,focus:null})}/>
  <//>`;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${App}/>`);
