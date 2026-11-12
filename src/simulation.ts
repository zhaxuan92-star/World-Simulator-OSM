import worldCountries from "world-countries";
import topoData from "world-atlas/countries-110m.json";
import { createProvinces, rebalanceProvincePopulation } from "./provinces";
import type { Province } from "./provinces";

export type Nation={id:string;name:string;capital:string;lat:number;lon:number;neighbors:string[];color:string;flag:string;flagCode:string;population:number;populationCapacity:number;budget:number;aggression:number;diplomacy:number;stability:number};
export type ArmyUnit={recruitedAt?:number;id:string;nationId:string;name:string;branch:"Army"|"Air Force"|"Navy"|"Logistics";type:string;personnel:number;strength:number;level:number;readiness:number;supply:number;x:number;y:number;status:"At capital"|"Moving to frontier"|"Advancing"|"In battle"|"Patrolling";progress:number;targetId?:string;warId?:string;targetX?:number;targetY?:number;nextMoveAt?:number};
export type War={id:string;attacker:string;defender:string;doctrine?:"conventional"|"guerrilla"|"blitzkrieg"|"attrition"|"deep-defense"|"amphibious";origin?:[number,number];status:"Mobilizing"|"Active"|"Ceasefire";stage:"Mobilizing"|"Border approach"|"Advance"|"Battle"|"Occupation";progress:number;started:number;frontline:[number,number];sector:number;log:string[]};
export type Treaty={id:string;a:string;b:string;type:"Non-aggression"|"Alliance"|"Trade";created:number;active:boolean};
export type AIStrategy={id:string;name:string;generation:number;aggression:number;defense:number;logistics:number;diplomacy:number;risk:number;score:number;wins:number;losses:number;games:number};
export type SimState={elapsedSeconds:number;nations:Nation[];provinces?:Province[];units:ArmyUnit[];wars:War[];upgrades:Record<string,number>;credits:Record<string,number>;control:Record<string,string>;sectorControl:Record<string,string>;relations:Record<string,number>;treaties:Treaty[];events:string[];aiProfiles:Record<string,AIStrategy>;aiChampion:AIStrategy;aiCandidates:AIStrategy[];aiLastTrainingAt:number};
const palette=["#3977d5","#d94c4c","#a56bd6","#d99b3d","#4ca58b","#4eaa65","#df79a2","#c6a84a","#55a6a0","#b36c54"];
const seed=(s:string,n:number)=>{let h=n+2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0)/4294967295};
const topo:any=topoData;const records:any[]=worldCountries as any[];
function flattenArcs(a:any,out:number[]=[]):number[]{if(typeof a==="number")out.push(a<0?~a:a);else if(Array.isArray(a))a.forEach(v=>flattenArcs(v,out));return out}
const arcOwners=new Map<number,string[]>();
for(const g of topo.objects.countries.geometries){const id=String(g.id).padStart(3,"0");for(const arc of new Set(flattenArcs(g.arcs??[]))){const list=arcOwners.get(arc)??[];list.push(id);arcOwners.set(arc,list)}}
const adjacency=new Map<string,Set<string>>();
for(const ids of arcOwners.values())for(const a of ids)for(const b of ids)if(a!==b){if(!adjacency.has(a))adjacency.set(a,new Set());adjacency.get(a)!.add(b)}
const valid=records.filter(c=>c.ccn3&&c.name?.common&&c.latlng?.length===2&&c.ccn3!=="010");
export const nationDatabase:Nation[]=valid.map((c:any,i:number)=>({id:String(c.ccn3).padStart(3,"0"),name:c.name.common,capital:c.capital?.[0]??"Capital unavailable",lat:Number(c.latlng[0]),lon:Number(c.latlng[1]),neighbors:[...(adjacency.get(String(c.ccn3).padStart(3,"0"))??[])],color:palette[i%palette.length],flag:typeof c.flag==="string"&&c.flag?c.flag:"🏳️",flagCode:String(c.cca2??"").toLowerCase(),population:1_000_000,populationCapacity:Math.max(1_500_000,Math.round(1_000_000+Math.max(0,Number(c.area??10000))*42*(Math.abs(Number(c.latlng[0]))<25?0.82:Math.abs(Number(c.latlng[0]))<55?1:0.58)*(c.landlocked?0.9:1.08))),budget:12,aggression:Math.round(seed(c.cca3,11)*70+15),diplomacy:Math.round(seed(c.cca3,23)*65+25),stability:Math.round(seed(c.cca3,37)*45+45)}));
const aiNames=["Sentinel","Strategist","Diplomat","Logistics Core","Vanguard","Balanced"];
function makeStrategy(id:string,index:number,generation=1):AIStrategy{return{id,name:aiNames[index%aiNames.length],generation,aggression:25+Math.round(seed(id,11)*65),defense:35+Math.round(seed(id,22)*60),logistics:30+Math.round(seed(id,33)*65),diplomacy:20+Math.round(seed(id,44)*75),risk:15+Math.round(seed(id,55)*75),score:0,wins:0,losses:0,games:0}}
function initialAI(nations:Nation[]){const aiProfiles:Record<string,AIStrategy>={};nations.forEach((n,i)=>aiProfiles[n.id]=makeStrategy(n.id,i));const aiCandidates=Array.from({length:6},(_,i)=>makeStrategy("candidate-"+i,i));return{aiProfiles,aiCandidates,aiChampion:{...aiCandidates[0],id:"global-champion",name:"Global Champion"}}}
function trainAI(s:SimState):Pick<SimState,"aiProfiles"|"aiCandidates"|"aiChampion"|"aiLastTrainingAt"|"events">{
 const profiles={...s.aiProfiles},candidates=s.aiCandidates.map(x=>({...x})),events=[...s.events];
 // Evaluate every national agent using completed campaign outcomes and strategic survival metrics.
 for(const w of s.wars.filter(x=>x.status==="Ceasefire"&&x.log[0]?.includes("champion-evaluated")===false)){
   const winner=s.control[w.defender]===w.attacker?w.attacker:w.defender;
   for(const id of [w.attacker,w.defender]){const p=profiles[id];if(!p)continue;const won=id===winner;p.games++;if(won)p.wins++;else p.losses++;p.score=Math.round((p.wins*12-p.losses*8)/Math.max(1,p.games)*100)/100;}
   w.log.unshift("champion-evaluated");
 }
 const ranked=Object.values(profiles).sort((a,b)=>b.score-a.score||b.wins-a.wins||a.losses-b.losses);
 const leader=ranked[0];
 let champion={...s.aiChampion};
 if(leader&&leader.games>0&&(leader.score>champion.score||champion.games===0)){
   champion={...leader,id:"global-champion",name:"Global Champion"};
   events.unshift("AI TRAINING: "+leader.name+" ("+nationName(s,Object.keys(profiles).find(id=>profiles[id]===leader)??"")+") became the new global champion. Its strategy is now shared across all nations.");
 }
 // Evolution: candidates inherit the best-performing national profile, then mutate one or more strategic traits.
 if(s.elapsedSeconds-s.aiLastTrainingAt>=3600){
   const parent=leader??champion;
   const next=candidates.map((c,i)=>{const mutate=(v:number,offset:number)=>Math.max(0,Math.min(100,Math.round(v+(seed(c.id,Math.floor(s.elapsedSeconds)+offset)-.5)*36)));return{...c,generation:c.generation+1,aggression:mutate(parent.aggression,i+1),defense:mutate(parent.defense,i+7),logistics:mutate(parent.logistics,i+13),diplomacy:mutate(parent.diplomacy,i+19),risk:mutate(parent.risk,i+25),score:Math.round((parent.defense*.28+parent.logistics*.24+parent.diplomacy*.18+(100-Math.abs(parent.aggression-52))*.12+(100-Math.abs(parent.risk-45))*.18)*100)/100,wins:0,losses:0,games:1}});
   next[0]={...parent,id:"candidate-elite-"+Math.floor(s.elapsedSeconds),name:"Elite Inheritance",generation:parent.generation+1,score:Math.round((parent.defense*.28+parent.logistics*.24+parent.diplomacy*.18+(100-Math.abs(parent.aggression-52))*.12+(100-Math.abs(parent.risk-45))*.18)*100)/100,wins:parent.wins,losses:parent.losses,games:Math.max(1,parent.games)};
   const candidateChampion=next.slice().sort((a,b)=>b.score-a.score)[0];
   if(candidateChampion&&candidateChampion.score>champion.score){champion={...candidateChampion,id:"global-champion",name:"Global Champion"};events.unshift("AI LAB: evolved candidate "+candidateChampion.name+" became the shared global champion.");}
   events.unshift("AI LAB: generation "+(Math.max(...candidates.map(c=>c.generation))+1)+" evolved; candidates were ranked for defense, logistics, diplomacy and risk control.");
   return{aiProfiles:profiles,aiCandidates:next,aiChampion:champion,aiLastTrainingAt:s.elapsedSeconds,events:events.slice(0,40)};
 }
 return{aiProfiles:profiles,aiCandidates:candidates,aiChampion:champion,aiLastTrainingAt:s.aiLastTrainingAt,events:events.slice(0,40)};
}
export const upgradeCatalog=[
{id:"training",name:"Advanced training",description:"Improves readiness and combat performance.",cost:18,effect:"+8 readiness"},
{id:"logistics",name:"Supply network",description:"Reduces supply loss during campaigns.",cost:22,effect:"+1 supply / simulated day"},
{id:"industry",name:"Military industry",description:"Raises national recruitment capacity.",cost:25,effect:"Recruitment discount"},
{id:"command",name:"Command systems",description:"Improves formation coordination.",cost:24,effect:"+10% campaign power"},
{id:"research",name:"Defense research",description:"Unlocks higher equipment levels.",cost:30,effect:"Unit technology upgrade"}
] as const;
export const unitTypes=[
{name:"Infantry brigade",branch:"Army" as const,personnel:4200,strength:42,cost:20},
{name:"Mechanized brigade",branch:"Army" as const,personnel:5600,strength:58,cost:30},
{name:"Armored brigade",branch:"Army" as const,personnel:3100,strength:68,cost:36},
{name:"Air defense group",branch:"Army" as const,personnel:900,strength:36,cost:18},
{name:"Fighter wing",branch:"Air Force" as const,personnel:700,strength:55,cost:32},
{name:"Transport wing",branch:"Air Force" as const,personnel:500,strength:28,cost:22},
{name:"Naval task group",branch:"Navy" as const,personnel:1800,strength:62,cost:35},
{name:"Logistics command",branch:"Logistics" as const,personnel:1200,strength:20,cost:15}
];
function makeUnit(n:Nation,index:number):ArmyUnit{const t=unitTypes[index%4];return{id:n.id+"-"+index,nationId:n.id,name:t.name,branch:t.branch,type:t.name,personnel:t.personnel,strength:t.strength,level:1,readiness:65+Math.round(seed(n.id,index)*30),supply:100,x:n.lat,y:n.lon,status:"At capital",progress:0}}
export function ensureAIState(s:SimState):SimState{
 const knownNations=new Map(nationDatabase.map(n=>[n.id,n]));
 const nations=(s.nations??[]).map(n=>({...n,flagCode:typeof n.flagCode==="string"?n.flagCode:(knownNations.get(n.id)?.flagCode??"")}));
 const base=initialAI(nations),seen=new Set<string>(),wars:War[]=[],legacy=s as SimState & {tick?:number;aiLastTrainingTick?:number};
 for(const w of [...(s.wars??[])].sort((a,b)=>a.started-b.started)){
   const key=[w.attacker,w.defender].sort().join(":");
   if(w.status!=="Ceasefire"&&seen.has(key))continue;
   if(w.status!=="Ceasefire")seen.add(key);
   wars.push({...w,origin:w.origin??w.frontline,progress:Math.max(0,Math.min(99,Number(w.progress)||0)),log:Array.isArray(w.log)?w.log:[]});
 }
 const {tick:_oldTick,aiLastTrainingTick:_oldTraining,...clean}=legacy;return{...clean,elapsedSeconds:Number.isFinite(s.elapsedSeconds)?s.elapsedSeconds:Math.max(0,Number(_oldTick)||0),nations,provinces:Array.isArray(s.provinces)&&s.provinces.length?s.provinces:createProvinces(nations),sectorControl:s.sectorControl??{},wars,aiProfiles:s.aiProfiles??base.aiProfiles,aiCandidates:s.aiCandidates??base.aiCandidates,aiChampion:s.aiChampion??{...base.aiChampion},aiLastTrainingAt:Number.isFinite(s.aiLastTrainingAt)?s.aiLastTrainingAt:Math.max(0,Number(_oldTraining)||0)};
}
export function createInitialState():SimState{const nations=nationDatabase;const control:Record<string,string>={},credits:Record<string,number>={},relations:Record<string,number>={};nations.forEach(n=>{control[n.id]=n.id;credits[n.id]=100});return{elapsedSeconds:0,nations,provinces:createProvinces(nations),units:nations.map((n,i)=>makeUnit(n,i)),wars:[],upgrades:{},credits,control,sectorControl:{},relations,treaties:[],...initialAI(nations),aiLastTrainingAt:0,events:["OFFICIAL WORLD INITIALIZED: country and capital database loaded.","Provincial grid generated from country geometry; cell count scales with national land area.","Population is simulated per province using terrain suitability and local development."]}}
export function nationName(s:SimState,id:string){return s.nations.find(n=>n.id===id)?.name??id}
export function relationKey(a:string,b:string){return[a,b].sort().join(":")}
export function addUnit(s:SimState,nationId:string,typeIndex:number):SimState{const n=s.nations.find(x=>x.id===nationId),t=unitTypes[typeIndex];if(!n||!t)return s;const cost=t.cost-(s.upgrades[nationId+":industry"]??0)*2;if((s.credits[nationId]??0)<cost)return{...s,events:["Recruitment failed: insufficient national credits.",...s.events].slice(0,30)};const count=s.units.filter(u=>u.nationId===nationId).length;const unit:ArmyUnit={id:nationId+"-"+(count+1)+"-"+Math.floor(s.elapsedSeconds),nationId,name:t.name,branch:t.branch,type:t.name,personnel:t.personnel,strength:t.strength,level:1,readiness:75,supply:100,x:n.lat,y:n.lon,status:"At capital",progress:0};return{...s,credits:{...s.credits,[nationId]:s.credits[nationId]-cost},units:[...s.units,unit],events:[n.name+" recruited "+t.name+" at "+n.capital+".",...s.events].slice(0,30)}}
export function upgradeNation(s:SimState,nationId:string,upgradeId:string):SimState{const item=upgradeCatalog.find(x=>x.id===upgradeId);if(!item)return s;const key=nationId+":"+upgradeId,level=s.upgrades[key]??0;if((s.credits[nationId]??0)<item.cost)return{...s,events:["Upgrade failed: insufficient national credits.",...s.events].slice(0,30)};return{...s,credits:{...s.credits,[nationId]:s.credits[nationId]-item.cost},upgrades:{...s.upgrades,[key]:level+1},units:s.units.map(u=>u.nationId===nationId?{...u,level:u.level+1,readiness:Math.min(100,u.readiness+(upgradeId==="training"?8:3))}:u),events:[nationName(s,nationId)+" completed "+item.name+" level "+(level+1)+".",...s.events].slice(0,30)}}
function borderPoint(a:Nation,b:Nation):[number,number]{const ga=topo.objects.countries.geometries.find((g:any)=>String(g.id).padStart(3,"0")===a.id),gb=topo.objects.countries.geometries.find((g:any)=>String(g.id).padStart(3,"0")===b.id);const aa=new Set(flattenArcs(ga?.arcs??[]));const shared=flattenArcs(gb?.arcs??[]).filter(i=>aa.has(i));const best=shared.map(index=>({index,length:(topo.arcs[index]??[]).length})).sort((x,y)=>y.length-x.length)[0];if(best&&topo.transform){const arc=topo.arcs[best.index];let x=0,y=0;const coords=arc.map((d:number[])=>{x+=d[0];y+=d[1];return[y*topo.transform.scale[1]+topo.transform.translate[1],x*topo.transform.scale[0]+topo.transform.translate[0]] as [number,number]});if(coords.length)return coords[Math.floor(coords.length/2)]}return[(a.lat+b.lat)/2,(a.lon+b.lon)/2]}
function totalPower(units:ArmyUnit[],id:string){return units.filter(u=>u.nationId===id).reduce((v,u)=>v+u.strength*u.level*(u.readiness/100)*(u.supply/100),0)}
export function declareWar(s:SimState,attackerId:string,defenderId:string,godMode=false,doctrine:War["doctrine"]="conventional"):SimState{
 const a=s.nations.find(n=>n.id===attackerId),d=s.nations.find(n=>n.id===defenderId);
 if(!a||!d||a.id===d.id||s.control[a.id]!==a.id||s.control[d.id]!==d.id)return s;
 if(!godMode&&!a.neighbors.includes(d.id))return{...s,events:["War declaration rejected: choose a neighboring independent country.",...s.events].slice(0,30)};
 if(s.wars.some(w=>w.status!=="Ceasefire"&&((w.attacker===a.id&&w.defender===d.id)||(w.attacker===d.id&&w.defender===a.id))))return s;
 if(!godMode&&s.treaties.some(t=>t.active&&t.type!=="Trade"&&relationKey(t.a,t.b)===relationKey(a.id,d.id)))return{...s,events:["War declaration blocked by an active diplomatic treaty.",...s.events].slice(0,30)};
 const id="PLAYER-WAR-"+a.id+"-"+d.id+"-"+Math.floor(s.elapsedSeconds+1),[lat,lon]=borderPoint(a,d);
 const units=s.units.map(u=>({...u}));
 let unit=units.filter(u=>u.nationId===a.id&&u.branch==="Army"&&!u.warId).sort((x,y)=>y.strength-x.strength)[0];
 if(!unit){unit=makeUnit(a,units.filter(u=>u.nationId===a.id).length+1);units.push(unit)}
 unit.warId=id;unit.targetId=d.id;unit.status="Moving to frontier";unit.progress=0;unit.targetX=undefined;unit.targetY=undefined;
 const war:War={id,attacker:a.id,defender:d.id,doctrine:doctrine??"conventional",origin:[lat,lon],status:"Mobilizing",stage:"Mobilizing",progress:0,started:s.elapsedSeconds+1,frontline:[lat,lon],sector:0,log:[godMode?"GOD MODE: player-forced war declaration.":"Player declared a border war."]};
 return{...s,units,wars:[...s.wars,war],events:[a.name+" declared war on "+d.name+(godMode?" (GOD MODE).":"."),...s.events].slice(0,40)};
}
export function signTreaty(s:SimState,a:string,b:string,type:Treaty["type"]):SimState{if(a===b||s.control[a]!==a||s.control[b]!==b)return s;const key=relationKey(a,b);if(s.treaties.some(t=>t.active&&relationKey(t.a,t.b)===key&&t.type===type))return s;const treaty:Treaty={id:key+":"+type+":"+Math.floor(s.elapsedSeconds),a,b,type,created:s.elapsedSeconds,active:true};const delta=type==="Alliance"?25:type==="Non-aggression"?18:12;return{...s,treaties:[...s.treaties,treaty],relations:{...s.relations,[key]:Math.min(100,(s.relations[key]??0)+delta)},events:[type+" treaty signed: "+nationName(s,a)+" and "+nationName(s,b)+".",...s.events].slice(0,30)}}
export function advanceWorld(s:SimState,deltaSeconds=1):SimState{
 const dt=Math.max(0,Math.min(5,Number.isFinite(deltaSeconds)?deltaSeconds:1)),elapsedSeconds=s.elapsedSeconds+dt,clock=elapsedSeconds,units=s.units.map(u=>({...u})),wars=s.wars.map(w=>({...w,log:[...w.log]})),control={...s.control},sectorControl={...(s.sectorControl??{})},credits={...s.credits},events:string[]=[];
 let provinces=(s.provinces?.length?s.provinces:createProvinces(s.nations)).map(p=>{
  const nation=s.nations.find(n=>n.id===p.nationId);
  if(!nation)return p;
  const terrainRate=p.terrain==="mountain"?.22:p.terrain==="plateau"?.48:p.terrain==="hill"?.72:p.terrain==="desert"?.18:p.terrain==="coastal"?1.2:1.05;
  const developmentFactor=.72+p.development/180;
  const pressure=Math.max(.35,Math.min(1.25,nation.stability/70));
  const rate=.00008*terrainRate*developmentFactor*pressure;
  const growth=p.population<p.capacity?Math.max(0,Math.round(p.population*rate*dt)):0;
  return {...p,population:Math.min(p.capacity,p.population+growth)};
 });
 let nations=s.nations.map(n=>{
  const rows=provinces.filter(p=>p.nationId===n.id);
  const population=rows.length?rows.reduce((sum,p)=>sum+p.population,0):n.population;
  const capacity=rows.length?rows.reduce((sum,p)=>sum+p.capacity,0):n.populationCapacity;
  return {...n,population:Math.max(1000,population),populationCapacity:Math.max(population,capacity),budget:Math.max(1,Math.round(population/1_000_000*.012))};
 });
  // Peaceful migration: small population flows toward stable neighboring countries with spare capacity.
  const atWar=new Set(wars.filter(w=>w.status!=="Ceasefire").flatMap(w=>[w.attacker,w.defender]));
  const migration:Record<string,number>={};
  for(const origin of nations){
    if(atWar.has(origin.id))continue;
    const destination=origin.neighbors.map(id=>nations.find(n=>n.id===id))
      .filter((n):n is Nation=>!!n&&!atWar.has(n.id)&&n.stability>=origin.stability+8&&n.population<n.populationCapacity)
      .sort((a,b)=>b.stability-a.stability)[0];
    if(!destination)continue;
    const people=Math.min(Math.max(1,Math.floor(origin.population*0.0000005)),Math.max(0,destination.populationCapacity-destination.population));
    if(people<=0)continue;
    migration[origin.id]=(migration[origin.id]??0)-people;
    migration[destination.id]=(migration[destination.id]??0)+people;
  }
  for(const n of nations){
    n.population=Math.max(1000,Math.min(n.populationCapacity,n.population+(migration[n.id]??0)));
    n.budget=Math.max(1,Math.round(n.population/1_000_000*0.012));
    provinces=rebalanceProvincePopulation(provinces,n.id,n.population);
  }
  nations=nations.map(n=>{const rows=provinces.filter(p=>p.nationId===n.id);if(!rows.length)return n;const population=rows.reduce((sum,p)=>sum+p.population,0),capacity=rows.reduce((sum,p)=>sum+p.capacity,0);return{...n,population,populationCapacity:Math.max(population,capacity),budget:Math.max(1,Math.round(population/1_000_000*.012))}});
  // Autonomous force generation: recruit a formation when manpower, treasury and infrastructure permit.
  for(const n of nations){const owned=units.filter(u=>u.nationId===n.id);const cap=Math.max(1,Math.min(40,Math.floor(n.population/250000)));const last=owned.reduce((v,u)=>Math.max(v,Number(u.recruitedAt??0)),0);if(owned.length<cap&&clock-last>=30&&(credits[n.id]??0)>=20&&n.population>100000){const fresh=makeUnit(n,owned.length+Math.floor(clock/30));fresh.id=n.id+"-auto-"+Math.floor(clock);fresh.recruitedAt=clock;units.push(fresh);credits[n.id]-=20;events.push(n.name+" raised a new formation through its standing recruitment system.");}}
  // Passive economy and supply recovery: group units once to avoid repeated full-array scans.
  const unitsByNation=new Map<string,ArmyUnit[]>();for(const u of units){const group=unitsByNation.get(u.nationId);if(group)group.push(u);else unitsByNation.set(u.nationId,[u])}
  for(const n of nations){credits[n.id]=Math.min(500,(credits[n.id]??0)+Math.max(0.05,n.budget/30)*dt);for(const u of unitsByNation.get(n.id)??[])if(u.status==="At capital")u.supply=Math.min(100,u.supply+(2+(s.upgrades[n.id+":logistics"]??0))*dt)}
  // Peacetime patrols stay on home territory: they move toward a border staging point, never a foreign capital.
  for(const u of units){
    if(u.warId||u.status==="In battle")continue;
    if(!Number.isFinite(u.targetX)||!Number.isFinite(u.targetY)){
      if(clock<(u.nextMoveAt??0))continue;
      const home=s.nations.find(n=>n.id===u.nationId);
      const destinations=home?.neighbors.map(id=>s.nations.find(n=>n.id===id)).filter((n):n is Nation=>!!n&&control[n.id]===n.id)??[];
      if(!home||!destinations.length)continue;
      const target=destinations[Math.floor(seed(u.id,Math.floor(clock/35))*destinations.length)];
      const [borderLat,borderLon]=borderPoint(home,target);
      u.targetX=home.lat+(borderLat-home.lat)*0.72;
      u.targetY=home.lon+(borderLon-home.lon)*0.72;
      u.status="Patrolling";u.nextMoveAt=clock+1;
    }
    const dx=(u.targetX??u.x)-u.x,dy=(u.targetY??u.y)-u.y,distance=Math.hypot(dx,dy);
    if(distance<0.22){
      u.x=u.targetX??u.x;u.y=u.targetY??u.y;u.targetX=undefined;u.targetY=undefined;
      u.status="At capital";u.nextMoveAt=clock+35;
    }else{
      const step=Math.min(0.42*dt,distance),ratio=step/distance;
      u.x+=dx*ratio;u.y+=dy*ratio;u.status="Patrolling";
    }
  }
  // Border violations trigger an immediate defensive response; no army can simply ignore an enemy formation.
  const activeWars=wars.filter(w=>w.status!=="Ceasefire");
  for(const intruder of units){
    if(intruder.warId||intruder.status==="In battle")continue;
    const host=s.nations.find(n=>n.id!==intruder.nationId&&control[n.id]===intruder.nationId);
    if(!host)continue;
    const defender=units.filter(u=>u.nationId===host.id&&!u.warId).sort((a,b)=>Math.hypot(a.x-intruder.x,a.y-intruder.y)-Math.hypot(b.x-intruder.x,b.y-intruder.y))[0];
    if(!defender)continue;
    const distance=Math.hypot(defender.x-intruder.x,intruder.y-defender.y);
    if(distance>2.5)continue;
    const already=wars.find(w=>w.status!=="Ceasefire"&&((w.attacker===intruder.nationId&&w.defender===host.id)||(w.attacker===host.id&&w.defender===intruder.nationId)));
    if(already)continue;
    const id="DEF-"+intruder.nationId+"-"+host.id+"-"+clock;
    intruder.warId=id;intruder.targetId=host.id;intruder.status="In battle";intruder.targetX=undefined;intruder.targetY=undefined;
    defender.status="In battle";defender.targetX=undefined;defender.targetY=undefined;
    const attackerNation=s.nations.find(n=>n.id===intruder.nationId);
    const frontline:[number,number]=[(intruder.x+defender.x)/2,(intruder.y+defender.y)/2];
    wars.push({id,attacker:intruder.nationId,defender:host.id,status:"Active",stage:"Battle",progress:0,started:clock,frontline,origin:frontline,sector:0,log:["Defensive interception: the territorial owner engaged the invading formation immediately."]});
    events.push(host.name+" scrambled its defense forces to intercept an invading "+attackerNation?.name+" formation.");
  }
  // Autonomous governments can initiate only adjacent, independent and non-treaty conflicts.
  if(Math.floor(clock/10)>Math.floor(s.elapsedSeconds/10)&&activeWars.length<4){const candidates=s.nations.filter(n=>n.neighbors.length&&((s.aiProfiles[n.id]?.aggression??n.aggression)*.65+s.aiChampion.aggression*.35)>68&&control[n.id]===n.id).sort((a,b)=>seed(a.id,clock)-seed(b.id,clock));for(const attacker of candidates){const targets=attacker.neighbors.map(id=>s.nations.find(n=>n.id===id)).filter((n):n is Nation=>!!n&&control[n.id]===n.id&&!wars.some(w=>w.status!=="Ceasefire"&&((w.attacker===attacker.id&&w.defender===n.id)||(w.defender===attacker.id&&w.attacker===n.id)))&&(s.relations[relationKey(attacker.id,n.id)]??0)<s.aiChampion.diplomacy*.65&&!s.treaties.some(t=>t.active&&t.type!=="Trade"&&relationKey(t.a,t.b)===relationKey(attacker.id,n.id))).sort((a,b)=>a.stability-b.stability);const target=targets[0];if(!target)continue;const powerA=totalPower(units,attacker.id),powerD=totalPower(units,target.id);if(powerA>powerD*(.55+(s.aiChampion.defense/100)*.5)&&seed(attacker.id+target.id,clock)>(.65-(s.aiChampion.risk/100)*.35)){const id="WAR-"+attacker.id+"-"+target.id+"-"+clock;const [lat,lon]=borderPoint(attacker,target);const unit=units.filter(u=>u.nationId===attacker.id&&u.branch==="Army"&&u.status==="At capital"&&!u.warId).sort((a,b)=>b.strength-a.strength)[0];if(!unit)continue;unit.warId=id;unit.targetId=target.id;unit.status="Moving to frontier";unit.progress=0;wars.push({id,attacker:attacker.id,defender:target.id,status:"Mobilizing",stage:"Mobilizing",progress:0,started:clock,frontline:[lat,lon],origin:[lat,lon],sector:0,log:["AI approved a border-adjacent campaign after checking readiness, force balance and diplomacy."]});events.push(attacker.name+" declared a simulated war against "+target.name+". The formation departed "+attacker.capital+".");break}}}
  // Tactical contact: opposing formations must engage before an advancing army can pass them.
  for(const w of wars.filter(x=>x.status!=="Ceasefire"&&x.stage!=="Battle")){
    const a=s.nations.find(n=>n.id===w.attacker),d=s.nations.find(n=>n.id===w.defender);
    const attacker=units.find(u=>u.warId===w.id);
    if(!attacker)continue;
    const defender=units.filter(u=>u.nationId===w.defender&&(!u.warId||u.warId===w.id))
      .sort((a,b)=>Math.hypot(a.x-attacker.x,a.y-attacker.y)-Math.hypot(b.x-attacker.x,b.y-attacker.y))[0];
    if(!defender)continue;
    const contact=Math.hypot((defender.x-attacker.x)*Math.cos(attacker.x*Math.PI/180),defender.y-attacker.y);
    if(contact<=2.2){
      defender.warId=w.id;defender.targetId=w.attacker;defender.status="In battle";
      attacker.status="In battle";attacker.targetX=undefined;attacker.targetY=undefined;
      w.frontline=[(attacker.x+defender.x)/2,(attacker.y+defender.y)/2];
      w.stage="Battle";w.progress=0;w.log.unshift("Tactical contact: defending formation intercepted the advancing enemy before it could pass.");
      events.push(d.name+" intercepted "+a.name+"'s formation. A direct battle has begun.");
    }
  }
  // Active defense alliances dispatch one available allied army to reinforce the defender.
  for(const w of wars.filter(x=>x.status!=="Ceasefire")){
    const alliedIds=s.treaties.filter(t=>t.active&&t.type==="Alliance"&&(t.a===w.defender||t.b===w.defender)).map(t=>t.a===w.defender?t.b:t.a);
    for(const allyId of alliedIds){
      if(control[allyId]!==allyId||units.some(u=>u.warId===w.id&&u.nationId===allyId))continue;
      const reinforcement=units.filter(u=>u.nationId===allyId&&u.branch==="Army"&&!u.warId).sort((a,b)=>b.strength-a.strength)[0];
      if(!reinforcement)continue;
      reinforcement.warId=w.id;reinforcement.targetId=w.attacker;reinforcement.status="In battle";reinforcement.x=w.frontline[0];reinforcement.y=w.frontline[1];reinforcement.targetX=undefined;reinforcement.targetY=undefined;
      w.log.unshift(nationName(s,allyId)+" entered the conflict under its active defensive alliance with "+nationName(s,w.defender)+".");
      events.push(nationName(s,allyId)+" sent an allied army to reinforce "+nationName(s,w.defender)+".");
    }
  }
  for(const w of wars.filter(x=>x.status!=="Ceasefire")){const a=s.nations.find(n=>n.id===w.attacker),d=s.nations.find(n=>n.id===w.defender),u=units.find(x=>x.warId===w.id);if(!a||!d||!u)continue;u.supply=Math.max(0,u.supply-(Math.max(.35,1.5-s.aiChampion.logistics/100)*(w.doctrine==="blitzkrieg"?1.35:w.doctrine==="guerrilla"?.72:w.doctrine==="attrition"?1.12:1))*dt);if(u.supply<35)u.readiness=Math.max(10,u.readiness-(u.supply<15?1.4:.35));
    if(w.stage==="Mobilizing"){w.progress=Math.min(100,w.progress+20*dt);if(w.progress>=100){w.stage="Border approach";w.progress=0;w.status="Active";w.log.unshift("Mobilization complete. Formation begins the capital-to-frontier route.");events.push(a.name+" mobilized forces from "+a.capital+".")}}
    else if(w.stage==="Border approach"){w.progress=Math.min(100,w.progress+10*dt);u.x=a.lat+(w.frontline[0]-a.lat)*w.progress/100;u.y=a.lon+(w.frontline[1]-a.lon)*w.progress/100;u.status="Moving to frontier";if(w.progress>=100){w.stage="Advance";w.progress=0;u.status="Advancing";w.log.unshift("Formation reached the shared land border.")}
    }else if(w.stage==="Advance"){const doctrine=w.doctrine??"conventional";const pace=doctrine==="blitzkrieg"?1.65:doctrine==="guerrilla"?0.72:doctrine==="deep-defense"?0.55:1;w.progress=Math.min(100,w.progress+Math.max(1,3.2*pace)*dt);const dx=d.lat-u.x,dy=d.lon-u.y,dist=Math.hypot(dx,dy),step=Math.min(dist,0.16*pace);if(dist>0){u.x+=dx/dist*step;u.y+=dy/dist*step;}w.frontline=[u.x,u.y];u.status="Advancing";if(w.progress>=100||dist<1.2){w.stage="Battle";w.progress=0;u.status="In battle";w.log.unshift("The front advanced continuously toward the defender capital; no fixed territorial sectors are used.");events.push(a.name+" pushed the frontline deeper into "+d.name+".")}}
    else if(w.stage==="Battle"){const attacker=units.find(x=>x.warId===w.id&&x.nationId===a.id),attack=units.filter(x=>x.warId===w.id&&x.nationId===a.id).reduce((v,x)=>v+x.strength*x.level*(x.readiness/100)*(x.supply/100),0),defenderIds=[d.id,...s.treaties.filter(t=>t.active&&t.type==="Alliance"&&(t.a===d.id||t.b===d.id)).map(t=>t.a===d.id?t.b:t.a)],defense=units.filter(x=>x.warId===w.id&&defenderIds.includes(x.nationId)).reduce((v,x)=>v+x.strength*x.level*(x.readiness/100)*(x.supply/100),0),doctrineMultiplier=w.doctrine==="blitzkrieg"?1.22:w.doctrine==="guerrilla"?.94:w.doctrine==="attrition"?1.02:w.doctrine==="deep-defense"?.78:w.doctrine==="amphibious"?.92:1,ratio=(attack*doctrineMultiplier)/Math.max(1,defense);w.progress=Math.min(100,w.progress+Math.max(0,6+Math.min(4,ratio*2))*dt);for(const fighter of units.filter(x=>x.warId===w.id)){if(fighter.status==="In battle"){const isAttacker=fighter.nationId===w.attacker;const pressure=w.doctrine==="attrition"&&!isAttacker?1.35:1;fighter.readiness=Math.max(5,fighter.readiness-(fighter.supply<25?4:2)*pressure*dt);fighter.personnel=Math.max(0,Math.round(fighter.personnel-(fighter.supply<20?fighter.personnel*.004:fighter.personnel*.0015)*dt));}}if(w.progress>=100||clock-w.started>=80){w.progress=100;const attackerWins=ratio>=1.0;if(attackerWins){const distanceToCapital=attacker?Math.hypot((attacker.x-d.lat)*Math.cos(d.lat*Math.PI/180),attacker.y-d.lon):99;if(distanceToCapital<1.35){w.stage="Occupation";w.status="Ceasefire";control[d.id]=a.id;events.push(a.name+" captured the capital and established control over "+d.name+".");}else{w.stage="Advance";w.progress=0;w.frontline=attacker?[attacker.x,attacker.y]:w.frontline;events.push(a.name+" won the engagement and continued its gradual advance in "+d.name+".");}}else{w.stage="Occupation";w.status="Ceasefire";events.push(d.name+" stopped the offensive and forced a ceasefire.");}if(w.status==="Ceasefire"){for(const fighter of units.filter(x=>x.warId===w.id)){fighter.status="At capital";fighter.x=fighter.nationId===a.id?a.lat:d.lat;fighter.y=fighter.nationId===a.id?a.lon:d.lon;fighter.warId=undefined;fighter.targetId=undefined;fighter.targetX=undefined;fighter.targetY=undefined;fighter.progress=0;}w.log.unshift(attackerWins?"Capital captured; territorial control transferred.":"Defenders held the line; invading force repelled and ceasefire recorded.");}else{if(attacker){attacker.status="Advancing";attacker.targetId=d.id;}w.log.unshift("Defensive line broken. The frontline continues advancing toward the capital.");}}}
  }
  if(Math.floor(clock/20)>Math.floor(s.elapsedSeconds/20))events.push("AI world review: national budgets, supply, diplomatic treaties and border security updated.");
  const uniqueWars:War[]=[];const activePairs=new Set<string>();for(const w of wars){const key=[w.attacker,w.defender].sort().join(":");if(w.status!=="Ceasefire"&&activePairs.has(key))continue;if(w.status!=="Ceasefire")activePairs.add(key);uniqueWars.push(w)}
  const trained=trainAI({...s,elapsedSeconds,nations,units,wars:uniqueWars,control,credits});
  return{...s,...trained,elapsedSeconds,nations,provinces,units,wars:uniqueWars,control,sectorControl:{},credits,events:[...events,...trained.events].slice(0,40)}
}
