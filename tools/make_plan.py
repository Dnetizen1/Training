"""План на 10 недель: Верх A / Низ A (по скринам), +2 упражнения на предплечья в день верха.
Запуск: python3 tools/make_plan.py -> plan/plan_10w.json, plan/plan_10w.csv"""
import csv, json, datetime
# (название, [(вес кг, повторы)...], RIR, отдых с)
UP=[("Жим штанги лёжа на наклонной скамье (Barbell Incline Bench Press)",[(50,8)]*3,"0,5",180),
("Тяга верхнего блока (Cable Pulldown)",[(14,10),(14,10),(14,9)],"",120),
("Тяга сидя на блоке с канатом (Cable Rope Crossover Seated Row)",[(0,10)]*3,"",120),
("Рычажное разведение на бабочке (Lever Pec Deck Fly)",[(100,11),(100,12),(100,12)],"",90),
("Рычажное обратное разведение сидя (Lever Seated Reverse Fly)",[(90,12)]*3,"",90),
("Подъём на бицепс одной рукой через блок (Cable One Arm Curl)",[(34,9)]*3,"",90),
("Разгибание на трицепс над головой через верхний блок (Cable High Pulley Overhead Tricep Extension)",[(52,12)]*3,"",90),
("Сгибание запястий со штангой сидя, ладони вверх (Barbell Wrist Curl)",[(0,15)]*3,"0–1",60),
("Разгибание запястий со штангой сидя, ладони вниз (Barbell Reverse Wrist Curl)",[(0,15)]*3,"0–1",60)]
LO=[("Жим ногами под углом в рычажном тренажёре (Lever Angled Leg Press)",[(100,16),(125,14),(150,11)],"",150),
("Румынская тяга со штангой (Barbell Romanian Deadlift)",[(100,10),(120,7),(120,6)],"0–0,5",150),
("Разгибание ног на рычажном тренажёре (Lever Leg Extension)",[(62,12),(74,9),(74,8)],"",90),
("Рычажное сгибание ног сидя (Lever Seated Leg Curl)",[(55,11)]*3,"",90),
("Махи одной рукой в сторону через блок (Cable One Arm Lateral Raise)",[(16,8),(16,7),(16,6)],"0",60),
("Рычажный жим над головой сидя (Lever Seated Shoulder Press)",[(10,12),(10,11),(10,11)],"0",120),
("Жим носками на рычажном тренажёре (Lever Calf Press)",[(100,16),(125,12),(150,10),(150,10)],"",75),
("Рычажное отведение бёдер сидя (Lever Seated Hip Abduction)",[(64,12)]*3,"",60)]
WEEK=[("Верх A",0,UP),("Низ A",1,LO),("Верх A",3,UP),("Низ A",4,LO)]  # Пн Вт Чт Пт
start=datetime.date(2026,10,19)  # понедельник
plan={"name":"Верх/Низ 10 недель","weeks":10,"days":[]}
rows=[]
for w in range(10):
  for name,off,exs in WEEK:
    d=start+datetime.timedelta(days=7*w+off)
    plan["days"].append({"week":w+1,"date":d.isoformat(),"name":name,"exercises":[
      {"name":n,"rest_s":r,"rir":rir,"sets":[{"kg":k,"reps":p} for k,p in s]} for n,s,rir,r in exs]})
    for n,s,rir,r in exs:
      for i,(k,p) in enumerate(s,1):
        rows.append([d.isoformat(),f"{name} (нед. {w+1})",n,i,k,p,rir,r])
json.dump(plan,open("plan/plan_10w.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
with open("plan/plan_10w.csv","w",encoding="utf-8-sig",newline="") as f:
  c=csv.writer(f); c.writerow(["Date","Workout Name","Exercise Name","Set Order","Weight","Reps","RIR","Rest Seconds"]); c.writerows(rows)
print(len(plan["days"]),"тренировок,",len(rows),"подходов")
