import worldCountries from "world-countries";

export type Nation = {
  id: string; name: string; capital: string; lat: number; lon: number;
  neighbors: string[]; color: string; population: number; budget: number;
  aggression: number; diplomacy: number; stability: number;
};
export type ArmyUnit = {
  id: string; nationId: string; name: string; branch: "Army" | "Air Force" | "Navy" | "Logistics";
  type: string; personnel: number; strength: number; level: number; readiness: number;
  x: number; y: number; destinationId?: string; status: "At capital" | "Moving to frontier" | "Crossing border" | "Advancing" | "In battle";
  progress: number; targetId?: string; warId?: string;
};
export type War = {
  id: string; attacker: string; defender: string; status: "Mobilizing" | "Active" | "Ceasefire";
  progress: number; started: number; frontline: [number, number]; log: string[];
};
export type NationUpgrade = { id: string; name: string; description: string; cost: number; level: number; effect: string };
export type SimState = { tick: number; nations: Nation[]; units: ArmyUnit[]; wars: War[]; upgrades: Record<string, number>; events: string[] };

const palette = ["#3977d5","#d94c4c","#a56bd6","#d99b3d","#4ca58b","#4eaa65","#df79a2","#c6a84a","#55a6a0","#b36c54"];
const seed = (s: string, n: number) => { let h = n + 2166136261; for (let i=0;i<s.length;i++) h = Math.imul(h ^ s.charCodeAt(i),16777619); return (h>>>0)/4294967295; };
const records: any[] = worldCountries as any[];
const topo: any = (await import("world-atlas/countries-110m.json")).default;
function flattenArcs(a: any, out: number[] = []): number[] {
  if (typeof a === "number") out.push(a < 0 ? ~a : a);
  else if (Array.isArray(a)) a.forEach(v => flattenArcs(v,out));
  return out;
}
const arcOwners = new Map<number,string[]>();
for (const g of topo.objects.countries.geometries) {
  const id = String(g.id).padStart(3,"0");
  for (const arc of new Set(flattenArcs(g.arcs ?? []))) {
    const list = arcOwners.get(arc) ?? []; list.push(id); arcOwners.set(arc,list);
  }
}
const adjacency = new Map<string,Set<string>>();
for (const [arc, ids] of arcOwners) for (const a of ids) for (const b of ids) if (a !== b) {
  if (!adjacency.has(a)) adjacency.set(a,new Set()); adjacency.get(a)!.add(b);
}
const valid = records.filter(c => c.ccn3 && c.name?.common && c.capitalInfo?.latlng?.length === 2 && c.ccn3 !== "010");
export const nationDatabase: Nation[] = valid.map((c:any,i:number) => ({
  id: String(c.ccn3).padStart(3,"0"), name:c.name.common, capital:c.capital?.[0] ?? "Capital unavailable",
  lat:Number(c.capitalInfo.latlng[0]), lon:Number(c.capitalInfo.latlng[1]),
  neighbors:[...(adjacency.get(String(c.ccn3).padStart(3,"0")) ?? [])],
  color:palette[i%palette.length], population:Number(c.population ?? 0),
  budget:Math.max(1,Math.round((Number(c.population ?? 0)/1e6)*0.012)),
  aggression:Math.round(seed(c.cca3,11)*70+15), diplomacy:Math.round(seed(c.cca3,23)*65+25),
  stability:Math.round(seed(c.cca3,37)*45+45)
}));
export const upgradeCatalog = [
  {id:"training",name:"Advanced training",description:"Improves unit readiness and combat effectiveness.",cost:12,effect:"+8% readiness"},
  {id:"logistics",name:"Supply network",description:"Improves supply capacity and reduces movement delays.",cost:16,effect:"+12% logistics"},
  {id:"industry",name:"Military industry",description:"Increases recruitment capacity and equipment output.",cost:20,effect:"+1 recruitment slot"},
  {id:"command",name:"Command systems",description:"Improves coordination between formations.",cost:18,effect:"+10% coordination"},
  {id:"research",name:"Defense research",description:"Unlocks higher unit technology tiers.",cost:24,effect:"Unlocks unit level 2"}
] as const;
const unitTypes = [
  {name:"Infantry brigade",branch:"Army" as const,personnel:4200,strength:42},
  {name:"Mechanized brigade",branch:"Army" as const,personnel:5600,strength:58},
  {name:"Armored brigade",branch:"Army" as const,personnel:3100,strength:68},
  {name:"Air defense group",branch:"Army" as const,personnel:900,strength:36},
  {name:"Fighter wing",branch:"Air Force" as const,personnel:700,strength:55},
  {name:"Transport wing",branch:"Air Force" as const,personnel:500,strength:28},
  {name:"Naval task group",branch:"Navy" as const,personnel:1800,strength:62},
  {name:"Logistics command",branch:"Logistics" as const,personnel:1200,strength:20}
];
function makeUnit(n:Nation,index:number):ArmyUnit {
  const t=unitTypes[index%unitTypes.length];
  return {id:n.id+"-"+index,nationId:n.id,name:t.name,branch:t.branch,type:t.name,personnel:t.personnel,
    strength:t.strength,level:1,readiness:65+Math.round(seed(n.id,index)*30),x:n.lat,y:n.lon,
    status:"At capital",progress:0};
}
export function createInitialState():SimState {
  const nations=nationDatabase;
  const units=nations.map((n,i)=>makeUnit(n,i%4));
  return {tick:0,nations,units,wars:[],upgrades:{},events:["World simulation initialized. All governments are autonomous.","National capital and border adjacency database loaded.","Military units assigned to national headquarters." ]};
}
export function nationName(s:SimState,id:string) { return s.nations.find(n=>n.id===id)?.name ?? id; }
export function addUnit(s:SimState,nationId:string,typeIndex:number):SimState {
  const n=s.nations.find(x=>x.id===nationId); if(!n) return s;
  const t=unitTypes[typeIndex]; const count=s.units.filter(u=>u.nationId===nationId).length;
  const unit:ArmyUnit={id:nationId+"-"+(count+1)+"-"+s.tick,nationId,name:t.name,branch:t.branch,type:t.name,
    personnel:t.personnel,strength:t.strength,level:1,readiness:75,x:n.lat,y:n.lon,status:"At capital",progress:0};
  return {...s,units:[...s.units,unit],events:[n.name+" recruited "+t.name+" at "+n.capital+".",...s.events].slice(0,30)};
}
export function upgradeNation(s:SimState,nationId:string,upgradeId:string):SimState {
  const key=nationId+":"+upgradeId; const level=s.upgrades[key]??0;
  return {...s,upgrades:{...s.upgrades,[key]:level+1},units:s.units.map(u=>u.nationId===nationId?{...u,level:u.level+1,readiness:Math.min(100,u.readiness+4)}:u),
    events:[nationName(s,nationId)+" upgraded "+upgradeId+" to level "+(level+1)+".",...s.events].slice(0,30)};
}
function borderPoint(a:Nation,b:Nation):[number,number] {
  let lat=(a.lat+b.lat)/2, lon=(a.lon+b.lon)/2;
  if(Math.abs(lon)>180) lon=((lon+540)%360)-180;
  return [lat,lon];
}
function pathToTarget(s:SimState,from:Nation,target:Nation):string[] {
  const q:[string,string[]][]=[[from.id,[from.id]]], seen=new Set([from.id]);
  while(q.length){const [id,path]=q.shift()!; if(id===target.id)return path;
    const n=s.nations.find(x=>x.id===id); for(const next of n?.neighbors??[]) if(!seen.has(next)){seen.add(next);q.push([next,[...path,next]])}
  } return [];
}
export function advanceWorld(s:SimState):SimState {
  const tick=s.tick+1; let units=s.units.map(u=>({...u})); let wars=s.wars.map(w=>({...w,log:[...w.log]})); const events:string[]=[];
  // AI governments consider only geographically adjacent countries; no teleporting across disconnected borders.
  if(tick%8===0 && wars.filter(w=>w.status!=="Ceasefire").length<3){
    const candidates=s.nations.filter(n=>n.neighbors.length>0 && n.aggression>67)
      .sort((a,b)=>seed(a.id,tick)-seed(b.id,tick));
    for(const attacker of candidates){
      const targetIds=attacker.neighbors.filter(id=>!wars.some(w=>(w.attacker===attacker.id&&w.defender===id)||(w.defender===attacker.id&&w.attacker===id)));
      const target=targetIds.map(id=>s.nations.find(n=>n.id===id)).filter(Boolean).sort((a,b)=>a!.stability-b!.stability)[0];
      if(!target)continue;
      const powerA=units.filter(u=>u.nationId===attacker.id).reduce((v,u)=>v+u.strength*u.readiness/100,0);
      const powerD=units.filter(u=>u.nationId===target.id).reduce((v,u)=>v+u.strength*u.readiness/100,0);
      if(powerA>powerD*.7 && seed(attacker.id+target.id,tick)>.45){
        const [lat,lon]=borderPoint(attacker,target);
        const id="WAR-"+attacker.id+"-"+target.id+"-"+tick;
        wars.push({id,attacker:attacker.id,defender:target.id,status:"Mobilizing",progress:0,started:tick,frontline:[lat,lon],log:["AI approved a conflict after evaluating adjacency, force balance and national priorities."]});
        const unit=units.find(u=>u.nationId===attacker.id);
        if(unit){unit.targetId=target.id;unit.warId=id;unit.status="Moving to frontier";unit.progress=0;unit.destinationId=target.id;}
        events.push(attacker.name+" declared a simulated war against "+target.name+". Troops are mobilizing from "+attacker.capital+".");
        break;
      }
    }
  }
  for(const war of wars.filter(w=>w.status!=="Ceasefire")){
    const a=s.nations.find(n=>n.id===war.attacker), d=s.nations.find(n=>n.id===war.defender); if(!a||!d)continue;
    const unit=units.find(u=>u.warId===war.id);
    if(war.status==="Mobilizing"){war.progress=Math.min(100,war.progress+12);if(war.progress>=100){war.status="Active";war.log.unshift("The first formation reached the frontier.");events.push(a.name+" reached the frontier with "+d.name+".");}}
    else if(unit){
      unit.progress=Math.min(100,unit.progress+7);
      const [lat,lon]=war.frontline;
      unit.x=a.lat+(lat-a.lat)*Math.min(1,unit.progress/100);
      unit.y=a.lon+(lon-a.lon)*Math.min(1,unit.progress/100);
      unit.status=unit.progress<100?"Moving to frontier":"In battle";
      if(unit.progress>=100){
        war.progress=Math.min(95,war.progress+Math.max(1,Math.round((unit.strength*unit.readiness/100)/14)));
        unit.readiness=Math.max(20,unit.readiness-1);
        if(war.progress>=95){war.status="Ceasefire";war.log.unshift("Campaign reached its current prototype resolution threshold; ceasefire recorded. No national border has been redrawn.");events.push("Ceasefire recorded between "+a.name+" and "+d.name+". Territorial transfer awaits province-level map data.");}
      }
    }
  }
  if(tick%5===0)events.push("National AI review completed: budgets, readiness, diplomacy and border security recalculated.");
  return {...s,tick,units,wars,events:[...events,...s.events].slice(0,30)};
}
