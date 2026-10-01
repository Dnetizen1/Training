/* Дневник тренировок: ядро (утилиты, модель, хранилище, промпты, иконки). React 18 + htm, без сборки. */
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
const restTxt=r=>r>=60?Math.floor(r/60)+":"+String(r%60).padStart(2,"0"):r+" с";

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
  const lv=e.lv||(e.mus?lvFromOld(e.mus):null)||(row?LV[s.day][e.base]:null)||{};
  return {row,custom:!row,base,name:row?(e.alt||base):base,plan,lv,mus:lvWeights(lv)};
}
const musKeys=m=>MUS_ORDER.filter(k=>m[k]);
// нагрузка 0–10 → доля подхода в объёме: высокая (7–10) = 1, средняя (4–6) = 0,5, низкая (1–3) = 0,25
const lvW=v=>v>=7?1:v>=4?.5:v>=1?.25:0;
const lvCat=v=>v>=7?"высокая":v>=4?"средняя":v>=1?"низкая":"";
function lvWeights(lv){ const m={}; for(const k in lv){ const w=lvW(+lv[k]); if(w) m[k]=w; } return m; }
function lvFromOld(m){ const o={}; for(const k in m){ const v=+m[k]; if(v) o[k]=v>=1?9:v>=.5?5:Math.max(1,Math.round(v*10)); } return o; }
// «Широчайшие 8, Середина спины 6, Бицепс 4» по убыванию
const lvSorted=lv=>Object.keys(lv).filter(k=>+lv[k]>0&&MUS[k]).sort((a,b)=>lv[b]-lv[a]||MUS_ORDER.indexOf(+a)-MUS_ORDER.indexOf(+b));
const lvText=lv=>lvSorted(lv).map(k=>MUS[k]+" "+lv[k]).join(", ");
// setsAt(e) -> число подходов; результат по мышцам: d — прямые, f — дробные
function muscleCount(s,setsAt){
  const r=MUS.map(()=>({d:0,f:0}));
  (s.ex||[]).forEach(e=>{ const n=setsAt(e), m=xinfo(s,e).mus; for(const k in m){ if(m[k]===1) r[k].d+=n; r[k].f+=n*m[k]; } });
  return r;
}
const blankSet=()=>({w:"",r:"",ok:false,q:""});
// сколько строк-подходов у упражнения: явное число (e.n), иначе план недели или уже записанные
const rowsOf=(s,e)=>e.n!=null?e.n:Math.max(setsFor(xinfo(s,e).plan.ns,s.week),e.sets.length);
const musName=k=>MUS[k];
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
/* Корректировки плана: после разбора тренировки изменения для следующих тренировок копятся в m_<день>
   и применяются, когда открываешь новую тренировку этого дня (дата позже тренировки-источника). */
const modsId=day=>"m_"+day;
const modsList=day=>{ const d=S.data[modsId(day)]; return d&&Array.isArray(d.list)?d.list:[]; };
const pendingMods=(day,date)=>modsList(day).filter(m=>m.from<date);
function modText(m){
  const row=m.base>=0&&P[m.day]?P[m.day].ex[m.base]:null;
  return m.type==="add_sets"?`+${m.n} подх. «${row?row[0]:"?"}»`
    :m.type==="replace"?`«${row?row[0]:"?"}» → «${m.name}»`
    :`добавить «${m.name}» ${m.n}×${m.lo}–${m.hi}`;
}
function applyMods(s,mods){
  const info=[];
  mods.forEach(m=>{
    if(m.type==="add_sets"){ const e=s.ex.find(x=>x.base===m.base); if(!e) return; const n=rowsOf(s,e)+m.n; e.n=n; while(e.sets.length<n) e.sets.push(blankSet()); }
    else if(m.type==="replace"){ const e=s.ex.find(x=>x.base===m.base); if(!e) return; e.alt=m.name; if(m.lv&&Object.keys(m.lv).length) e.lv=m.lv; }
    else if(m.type==="add"){ s.ex.push({uid:"m"+m.id,base:-1,name:m.name,n:m.n,plan:{ns:m.n,lo:m.lo,hi:m.hi,rir:"1",rest:120,note:""},lv:m.lv||{},sets:Array.from({length:m.n},blankSet),note:""}); }
    else return;
    info.push({text:modText(m),reason:m.reason||"",from:m.from});
  });
  if(info.length) s.applied=info;
  return s;
}
function getSession(date,day){ return S.data[sid(date,day)]||applyMods(blankSession(date,day),pendingMods(day,date)); }
function editSession(date,day,fn){
  const id=sid(date,day);
  if(!S.data[id]){
    const mods=pendingMods(day,date);
    S.data[id]=applyMods(blankSession(date,day),mods);
    if(mods.length){ const left=modsList(day).filter(m=>!mods.includes(m)); putDoc(modsId(day),left.length?{kind:"mods",day,list:left}:undefined); }
  }
  const s=S.data[id]; fn(s);
  if(!s.start&&hasData(s)) s.start=Date.now();
  persist(id); emit();
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

/* Что не доделано относительно программы и куда это перенести */
const upcomingDays=day=>[1,2,3].map(k=>ORDER[(ORDER.indexOf(day)+k)%4]);
function deficits(s){
  const out=[];
  P[s.day].ex.forEach((row,bi)=>{
    const e=s.ex.find(x=>x.base===bi), plan=setsFor(row[1],s.week), done=e?doneOf(e):0;
    if(done<plan) out.push({bi,name:e?xinfo(s,e).name:row[0],missed:plan-done,lv:e?xinfo(s,e).lv:LV[s.day][bi],removed:!e});
  });
  return out;
}
// Простой перенос: недобор идёт в ближайшую тренировку с упражнением, где эта мышца нагружена высоко.
// Лимит на тренировку: +4 подхода и одно новое упражнение (только в день того же типа); остальное дальше по неделе или не переносится.
const CAP_SETS=4, CAP_NEW=1;
function suggestMods(s){
  const res=[], after=upcomingDays(s.day), load={}, added={};
  deficits(s).forEach(d=>{   // порядок программы: базовые раньше изоляции
    const top=+lvSorted(d.lv)[0]; if(isNaN(top)) return;
    const why=`недобор ${d.missed} подх. «${d.name}» (${MUS[top]})`;
    for(const day of after){
      const room=CAP_SETS-(load[day]||0); if(room<=0) continue;
      const bi=P[day].ex.findIndex((r,i)=>(LV[day][i][top]||0)>=7); if(bi<0) continue;
      const n=Math.min(2,d.missed,room), same=res.find(m=>m.day===day&&m.type==="add_sets"&&m.base===bi);
      if(same){ same.n+=n; same.reason+="; "+why; } else res.push({id:rid(),day,type:"add_sets",base:bi,n,from:s.date,reason:why});
      load[day]=(load[day]||0)+n; return;
    }
    const day=after.find(k=>(added[k]||0)<CAP_NEW&&(load[k]||0)<CAP_SETS&&k[0]===s.day[0]);   // новое упражнение — только в день того же типа
    if(!day) return;
    const row=P[s.day].ex[d.bi], n=Math.min(2,d.missed,CAP_SETS-(load[day]||0));
    res.push({id:rid(),day,type:"add",name:d.name,n,lo:row[2],hi:row[3],lv:d.lv,from:s.date,reason:why});
    load[day]=(load[day]||0)+n; added[day]=(added[day]||0)+1;
  });
  return res;
}
async function suggestModsAuto(s){
  const after=upcomingDays(s.day), defs=deficits(s);
  const prog=after.map(day=>`${day} (${P[day].name}):\n`+P[day].ex.map((r,i)=>`  ${i}. ${r[0]} ${r[1]}×${r[2]}–${r[3]}; нагрузка: ${lvText(LV[day][i])}`).join("\n")).join("\n");
  const r=await S.sample.json(`Ты тренер по гипертрофии. Тренировка ${s.date} (${P[s.day].name}) завершена с отклонениями от программы. Перенеси недобор в ближайшие тренировки так, чтобы недельный объём по мышцам сохранился, но тренировки не раздулись (не больше +3 подходов на тренировку). Можно: добавить подходы к упражнению (add_sets), заменить упражнение (replace), добавить упражнение (add).
${PROFILE}

ЧТО ПРОИЗОШЛО:
${sessionBlock(s)}
НЕДОБОР ПО ПРОГРАММЕ:
${defs.length?defs.map(d=>`- ${d.name}: не сделано ${d.missed} подх.${d.removed?" (упражнение убрано)":""}; нагрузка: ${lvText(d.lv)}`).join("\n"):"нет"}

БЛИЖАЙШИЕ ТРЕНИРОВКИ (индексы упражнений с 0):
${prog}

Ответь только JSON: {"changes":[{"day":"UB","type":"add_sets","exercise_index":0,"sets":2,"reason":"коротко почему"},{"day":"LB","type":"add","name":"…","sets":2,"reps_min":10,"reps_max":15,"levels":{"Грудь":8},"reason":"…"},{"day":"UB","type":"replace","exercise_index":3,"name":"…","levels":{"Грудь":9},"reason":"…"}]}. Если переносить нечего, верни {"changes":[]}.`);
  const out=[];
  (r&&Array.isArray(r.changes)?r.changes:[]).forEach(c=>{
    const day=String(c.day), type=String(c.type); if(!after.includes(day)) return;
    const bi=Math.round(Number(c.exercise_index)), n=Math.min(4,Math.max(1,Math.round(Number(c.sets)||2))), reason=String(c.reason||"").slice(0,160);
    if((type==="add_sets"||type==="replace")&&!(bi>=0&&bi<P[day].ex.length)) return;
    if(type==="add_sets") out.push({id:rid(),day,type,base:bi,n,from:s.date,reason});
    else if(type==="replace"&&c.name) out.push({id:rid(),day,type,base:bi,name:String(c.name).slice(0,80),lv:lvFromObj(c.levels),from:s.date,reason});
    else if(type==="add"&&c.name){ const lo=Math.max(1,Math.round(Number(c.reps_min)||8)); out.push({id:rid(),day,type,name:String(c.name).slice(0,80),n,lo,hi:Math.max(lo,Math.round(Number(c.reps_max)||12)),lv:lvFromObj(c.levels),from:s.date,reason}); }
  });
  return out;
}
function addMods(mods){
  const byDay={}; mods.forEach(m=>{ (byDay[m.day]=byDay[m.day]||[]).push(m); });
  for(const day in byDay) putDoc(modsId(day),{kind:"mods",day,list:[...modsList(day),...byDay[day]]});
}
function dropMod(day,id){ const left=modsList(day).filter(m=>m.id!==id); putDoc(modsId(day),left.length?{kind:"mods",day,list:left}:undefined); }

/* ---------- Промпты для Клода ---------- */
const PROFILE=`Профиль: мужчина 26 лет, 177 см, ~83 кг, ~20% жира, стаж ~6 месяцев, цель — гипертрофия. Принимает ААС под наблюдением врача, поэтому особое внимание сухожилиям (грудь, дистальный бицепс, надколенник, ахилл) и давлению. Препараты не обсуждай и не советуй.
Программа: верх/низ 4 дня (Верх A, Низ A, Верх B, Низ B), мезоцикл 6 недель: нед.1 RIR 3, нед.2 RIR 2, нед.3 RIR 1–2, нед.4–5 изоляция 0–1 RIR, нед.6 разгрузка (½ подходов, RIR 3–4). Жимы 1–3 RIR, без отказа и отбива; прибавка в базе не более ~5% в неделю. Двойная прогрессия: все подходы на верхней границе повторов при целевом RIR → вес +2,5–5% (изоляция +1–2 кг). Объём 10–16 эффективных подходов на мышцу в неделю. Нагрузка на мышцу в упражнении задана по шкале 0–10; в объём идёт: 7–10 = 1 подход, 4–6 = 0,5, 1–3 = 0,25.
Питание: лёгкий дефицит ~2400 ккал, белок ~180 г.`;
function sessionBlock(s,numbered){
  const d=P[s.day]; let t=`${s.date} · ${d.name} · неделя ${s.week}`+(s.bw?` · вес утром ${s.bw} кг`:"")+(s.dur?` · ${s.dur} мин`:"")+"\n";
  s.ex.forEach((e,i)=>{
    const inf=xinfo(s,e), {ns,lo,hi,rir}=inf.plan, mt=lvText(inf.lv);
    const sets=e.sets.filter(x=>x.w||x.r).map(x=>`${x.w||"б/в"}×${x.r||"?"}${x.q?" (запас "+x.q+")":""}${x.ok?"":" (не отмечен)"}`).join(", ");
    t+=`${numbered?(i+1)+".":"-"} ${inf.name}${e.alt&&!inf.custom?` [замена для «${inf.base}»]`:""}${inf.custom?" [добавлено]":""} · план ${rowsOf(s,e)}×${lo}–${hi}, RIR ${rirFor(rir,s.week)}`+
      `${mt?` · нагрузка на мышцы (0–10): ${mt}`:""} · факт: ${sets||"не выполнено"}${e.rir?` · реальный RIR: ${e.rir}`:""}${e.note?` · заметка: ${e.note}`:""}\n`;
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
const ERR={not_granted:"Помощник не включён: доступ не разрешён.",rate_limited:"Слишком много запросов или исчерпан лимит. Попробуй позже.",session_expired:"Нужно заново войти в аккаунт.",refused:"Помощник не стал отвечать на этот запрос.",sampling_disabled:"Помощник недоступен для этого аккаунта."};
const errText=e=>ERR[e&&e.code]||"Не получилось получить ответ. Попробуй ещё раз.";
async function copyText(t,ok){ try{ await navigator.clipboard.writeText(t); setStatus(ok||"Скопировано"); }catch(e){ setStatus("Копирование недоступно",true); } }

async function detectMuscles(name){
  const r=await S.sample.json(`Оцени нагрузку на мышцы в силовом упражнении «${name}» по шкале от 0 до 10, как в справочниках упражнений (7–10 высокая, 4–6 средняя, 1–3 низкая, 0 не работает).
Учитывай, что в тренажёрах вспомогательные мышцы работают слабее, чем со свободным весом.
Используй ТОЛЬКО эти мышцы: ${MUS.join(", ")}. Указывай только мышцы с нагрузкой от 1.
Ответь только JSON вида {"levels":{"Широчайшие":8,"Середина спины":5,"Бицепс":4}}`,{modelTier:"quick"});
  return lvFromObj(r&&r.levels);
}
const musIndex=n=>{ const t=String(n).trim(); return t==="Спина"?1:MUS.indexOf(t); };
function lvFromObj(o){ const lv={}; if(o&&typeof o==="object") for(const n in o){ const k=musIndex(n), v=Math.round(Number(o[n])); if(k>=0&&v>=1) lv[k]=Math.min(10,v); } return lv; }
// для инструментов чата: уровни, а если их нет, списки основных/вспомогательных
function lvFromTool(inp){ const lv=lvFromObj(inp&&inp.muscle_levels); if(Object.keys(lv).length) return lv;
  (Array.isArray(inp&&inp.secondary_muscles)?inp.secondary_muscles:[]).forEach(n=>{ const k=musIndex(n); if(k>=0) lv[k]=4; });
  (Array.isArray(inp&&inp.primary_muscles)?inp.primary_muscles:[]).forEach(n=>{ const k=musIndex(n); if(k>=0) lv[k]=8; });
  return lv; }

/* ---------- Иконки ---------- */
const I={
  spark:"M12 2.5l1.8 5.2 5.2 1.8-5.2 1.8L12 16.5l-1.8-5.2L5 9.5l5.2-1.8zM18.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z",
  trash:"M4 7h16M9 7V4.5h6V7M18 7l-.8 12.5H6.8L6 7M10 11v5.5M14 11v5.5",
  up:"M6 15l6-6 6 6", down:"M6 9l6 6 6-6", close:"M6 6l12 12M18 6L6 18", send:"M4 12l16-8-6 16-2.5-6.5z",
  check:"M5 12.5l4.5 4.5L19 7.5", arrowUp:"M12 19V5M6 11l6-6 6 6",
  more:"M5 12h.01M12 12h.01M19 12h.01", plus:"M12 5v14M5 12h14", minus:"M5 12h14",
  dumbbell:"M3 12h2M19 12h2M7 7v10M17 7v10M5 9v6M19 9v6M7 12h10", bars:"M5 20V11M12 20V4M19 20v-6",
  clock:"M12 7v5l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4", ruler:"M4 16L16 4l4 4L8 20zM8 12l2 2M11 9l2 2M14 6l2 2",
  swap:"M7 7h12l-3-3M17 17H5l3 3", pen:"M4 20h4L19 9l-4-4L4 16zM14 6l4 4", list:"M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01", target:"M12 3v4M12 17v4M3 12h4M17 12h4M12 12h.01", info:"M12 11v6M12 7h.01"
};
const PC={UA:"var(--p-blue)",LA:"var(--p-red)",UB:"var(--p-yellow)",LB:"var(--p-green)"};
const Plate=({k})=>html`<i class="plate" style=${{"--c":PC[k]}} aria-hidden="true"></i>`;
// Motion (motion.dev): пружинные анимации; без библиотеки или при reduced motion — просто без анимации
const calm=()=>{ try{ return matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };
function anim(el,kf,o){ try{ if(el&&window.Motion&&!calm()) window.Motion.animate(el,kf,Object.assign({type:"spring",bounce:.22,duration:.45},o||{})); }catch(e){} }
const Icon=({n,size=20})=>n==="spark"
  ? html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d=${I.spark}/></svg>`
  : html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${n==="more"?3.5:2.25} stroke-linecap=${n==="more"?"round":"square"} stroke-linejoin="miter" aria-hidden="true"><path d=${I[n]}/></svg>`;
const Rich=({text})=>html`<div class="rich" dangerouslySetInnerHTML=${{__html:md(text)}}></div>`;
