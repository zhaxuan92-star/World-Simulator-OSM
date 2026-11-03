import worldCountries from "world-countries";
import topoData from "world-atlas/countries-110m.json";

export type Nation={id:string;name:string;capital:string;lat:number;lon:number;neighbors:string[];color:string;flag:string;population:number;budget:number;aggression:number;diplomacy:number;stability:number};
export type ArmyUnit={id:string;nationId:string;name:string;branch:"Army"|"Air Force"|"Navy"|"Logistics";type:string;personnel:number;strength:number;level:number;readiness:number;supply:number;x:number;y:number;status:"At capital"|"Moving to frontier"|"Advancing"|"In battle"|"Patrolling";progress:number;targetId?:string;warId?:string;targetX?:number;targetY?:number;nextMoveTick?:number};
export type War={id:string;attacker:string;defender:string;status:"Mobilizing"|"Active"|"Ceasefire";stage:"Mobilizing"|"Border approach"|"Advance"|"Battle"|"Occupation";progress:number;started:number;frontline:[number,number];sector:number;log:string[]};
export type Treaty={id:string;a:string;b:string;type:"Non-aggression"|"Alliance"|"Trade";created:number;active:boolean};
export type SimState={tick:number;nations:Nation[];units:ArmyUnit[];wars:War[];upgrades:Record<string,number>;credits:Record<string,number>;control:Record<string,string>;relations:Record<string,number>;treaties:Treaty[];events:string[]};
const palette=["#3977d5","#d94c4c","#a56bd6","#d99b3d","#4ca58b","#4eaa65","#df79a2","#c6a84a","#55a6a0","#b36c54"];
const seed=(s:string,n:number)=>{let h=n+2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0)/4294967295};
const topo:any=topoData;const records:any[]=worldCountries as any[];
function flattenArcs(a:any,out:number[]=[]):number[]{if(typeof a==="number")out.push(a<0?~a:a);else if(Array.isArray(a))a.forEach(v=>flattenArcs(v,out));return out}
const arcOwners=new Map<number,string[]>();
for(const g of topo.objects.countries.geometries){const id=String(g.id).padStart(3,"0");for(const arc of new Set(flattenArcs(g.arcs??[]))){const list=arcOwners.get(arc)??[];list.push(id);arcOwners.set(arc,list)}}
const adjacency=new Map<string,Set<string>>();
for(const ids of arcOwners.values())for(const a of ids)for(const b of ids)if(a!==b){if(!adjacency.has(a))adjacency.set(a,new Set());adjacency.get(a)!.add(b)}
const valid=records.filter(c=>c.ccn3&&c.name?.common&&c.latlng?.length===2&&c.ccn3!=="010");
export const nationDatabase:Nation[]=valid.map((c:any,i:number)=>({id:String(c.ccn3).padStart(3,"0"),name:c.name.common,capital:c.capital?.[0]??"Capital unavailable",lat:Number(c.latlng[0]),lon:Number(c.latlng[1]),neighbors:[...(adjacency.get(String(c.ccn3).padStart(3,"0"))??[])],color:palette[i%palette.length],flag:typeof c.flag==="string"&&c.flag?c.flag:"🏳️",population:Number(c.population??0),budget:Math.max(1,Math.round(Number(c.population??0)/1e6*.012)),aggression:Math.round(seed(c.cca3,11)*70+15),diplomacy:Math.round(seed(c.cca3,23)*65+25),stability:Math.round(seed(c.cca3,37)*45+45)}));
export const upgradeCatalog=[
{id:"training",name:"Advanced training",description:"Improves readiness and combat performance.",cost:18,effect:"+8 readiness"},
{id:"logistics",name:"Supply network",description:"Reduces supply loss during campaigns.",cost:22,effect:"+1 supply / tick"},
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
export function createInitialState():SimState{const nations=nationDatabase;const control:Record<string,string>={},credits:Record<string,number>={},relations:Record<string,number>={};nations.forEach(n=>{control[n.id]=n.id;credits[n.id]=100});return{tick:0,nations,units:nations.map((n,i)=>makeUnit(n,i)),wars:[],upgrades:{},credits,control,relations,treaties:[],events:["BETA 0.1 initialized: country and capital database loaded.","Land-border adjacency generated from Natural Earth topology.","Each country starts with a national headquarters and one formation."]}}
export function nationName(s:SimState,id:string){return s.nations.find(n=>n.id===id)?.name??id}
export function relationKey(a:string,b:string){return[a,b].sort().join(":")}
export function addUnit(s:SimState,nationId:string,typeIndex:number):SimState{const n=s.nations.find(x=>x.id===nationId),t=unitTypes[typeIndex];if(!n||!t)return s;const cost=t.cost-(s.upgrades[nationId+":industry"]??0)*2;if((s.credits[nationId]??0)<cost)return{...s,events:["Recruitment failed: insufficient national credits.",...s.events].slice(0,30)};const count=s.units.filter(u=>u.nationId===nationId).length;const unit:ArmyUnit={id:nationId+"-"+(count+1)+"-"+s.tick,nationId,name:t.name,branch:t.branch,type:t.name,personnel:t.personnel,strength:t.strength,level:1,readiness:75,supply:100,x:n.lat,y:n.lon,status:"At capital",progress:0};return{...s,credits:{...s.credits,[nationId]:s.credits[nationId]-cost},units:[...s.units,unit],events:[n.name+" recruited "+t.name+" at "+n.capital+".",...s.events].slice(0,30)}}
export function upgradeNation(s:SimState,nationId:string,upgradeId:string):SimState{const item=upgradeCatalog.find(x=>x.id===upgradeId);if(!item)return s;const key=nationId+":"+upgradeId,level=s.upgrades[key]??0;if((s.credits[nationId]??0)<item.cost)return{...s,events:["Upgrade failed: insufficient national credits.",...s.events].slice(0,30)};return{...s,credits:{...s.credits,[nationId]:s.credits[nationId]-item.cost},upgrades:{...s.upgrades,[key]:level+1},units:s.units.map(u=>u.nationId===nationId?{...u,level:u.level+1,readiness:Math.min(100,u.readiness+(upgradeId==="training"?8:3))}:u),events:[nationName(s,nationId)+" completed "+item.name+" level "+(level+1)+".",...s.events].slice(0,30)}}
function borderPoint(a:Nation,b:Nation):[number,number]{const ga=topo.objects.countries.geometries.find((g:any)=>String(g.id).padStart(3,"0")===a.id),gb=topo.objects.countries.geometries.find((g:any)=>String(g.id).padStart(3,"0")===b.id);const aa=new Set(flattenArcs(ga?.arcs??[]));const shared=flattenArcs(gb?.arcs??[]).filter(i=>aa.has(i));const best=shared.map(index=>({index,length:(topo.arcs[index]??[]).length})).sort((x,y)=>y.length-x.length)[0];if(best&&topo.transform){const arc=topo.arcs[best.index];let x=0,y=0;const coords=arc.map((d:number[])=>{x+=d[0];y+=d[1];return[y*topo.transform.scale[1]+topo.transform.translate[1],x*topo.transform.scale[0]+topo.transform.translate[0]] as [number,number]});if(coords.length)return coords[Math.floor(coords.length/2)]}return[(a.lat+b.lat)/2,(a.lon+b.lon)/2]}
function totalPower(units:ArmyUnit[],id:string){return units.filter(u=>u.nationId===id).reduce((v,u)=>v+u.strength*u.level*(u.readiness/100)*(u.supply/100),0)}
export function signTreaty(s:SimState,a:string,b:string,type:Treaty["type"]):SimState{if(a===b||s.control[a]!==a||s.control[b]!==b)return s;const key=relationKey(a,b);if(s.treaties.some(t=>t.active&&relationKey(t.a,t.b)===key&&t.type===type))return s;const treaty:Treaty={id:key+":"+type+":"+s.tick,a,b,type,created:s.tick,active:true};const delta=type==="Alliance"?25:type==="Non-aggression"?18:12;return{...s,treaties:[...s.treaties,treaty],relations:{...s.relations,[key]:Math.min(100,(s.relations[key]??0)+delta)},events:[type+" treaty signed: "+nationName(s,a)+" and "+nationName(s,b)+".",...s.events].slice(0,30)}}
export function advanceWorld(s:SimState):SimState{const tick=s.tick+1,units=s.units.map(u=>({...u})),wars=s.wars.map(w=>({...w,log:[...w.log]})),control={...s.control},credits={...s.credits},events:string[]=[];
  // Passive economy and supply recovery: group units once to avoid repeated full-array scans.
  const unitsByNation=new Map<string,ArmyUnit[]>();for(const u of units){const group=unitsByNation.get(u.nationId);if(group)group.push(u);else unitsByNation.set(u.nationId,[u])}
  for(const n of s.nations){credits[n.id]=Math.min(500,(credits[n.id]??0)+Math.max(1,Math.round(n.budget/30)));for(const u of unitsByNation.get(n.id)??[])if(u.status==="At capital")u.supply=Math.min(100,u.supply+2+(s.upgrades[n.id+":logistics"]??0))}
  // Independent AI patrol: every formation chooses its own destination without player orders.
  for(const u of units){
    if(u.warId)continue;
    if(!Number.isFinite(u.targetX)||!Number.isFinite(u.targetY)){
      if(tick<(u.nextMoveTick??0))continue;
      const home=s.nations.find(n=>n.id===u.nationId),destinations=home?.neighbors.map(id=>s.nations.find(n=>n.id===id)).filter((n):n is Nation=>!!n)??[];
      if(!destinations.length)continue;
      const target=destinations[Math.floor(seed(u.id,Math.floor(tick/35))*destinations.length)];
      u.targetX=target.lat;u.targetY=target.lon;u.status="Patrolling";u.nextMoveTick=tick+1;
    }
    const dx=(u.targetX??u.x)-u.x,dy=(u.targetY??u.y)-u.y,distance=Math.hypot(dx,dy);
    if(distance<0.22){
      u.x=u.targetX??u.x;u.y=u.targetY??u.y;u.targetX=undefined;u.targetY=undefined;u.status="At capital";u.nextMoveTick=tick+35;
    }else{
      const step=Math.min(0.42,distance),ratio=step/distance;
      u.x+=dx*ratio;u.y+=dy*ratio;u.status="Patrolling";
    }
  }
  // Autonomous governments can initiate only adjacent, independent and non-treaty conflicts.
  if(tick%10===0&&wars.filter(w=>w.status!=="Ceasefire").length<4){const candidates=s.nations.filter(n=>n.neighbors.length&&n.aggression>68&&control[n.id]===n.id).sort((a,b)=>seed(a.id,tick)-seed(b.id,tick));for(const attacker of candidates){const targets=attacker.neighbors.map(id=>s.nations.find(n=>n.id===id)).filter((n):n is Nation=>!!n&&control[n.id]===n.id&&!wars.some(w=>w.status!=="Ceasefire"&&((w.attacker===attacker.id&&w.defender===n.id)||(w.defender===attacker.id&&w.attacker===n.id)))&&!s.treaties.some(t=>t.active&&t.type!=="Trade"&&relationKey(t.a,t.b)===relationKey(attacker.id,n.id))).sort((a,b)=>a.stability-b.stability);const target=targets[0];if(!target)continue;const powerA=totalPower(units,attacker.id),powerD=totalPower(units,target.id);if(powerA>powerD*.7&&seed(attacker.id+target.id,tick)>.48){const id="WAR-"+attacker.id+"-"+target.id+"-"+tick;const [lat,lon]=borderPoint(attacker,target);const unit=units.filter(u=>u.nationId===attacker.id&&u.branch==="Army"&&u.status==="At capital").sort((a,b)=>b.strength-a.strength)[0];if(!unit)continue;unit.warId=id;unit.targetId=target.id;unit.status="Moving to frontier";unit.progress=0;wars.push({id,attacker:attacker.id,defender:target.id,status:"Mobilizing",stage:"Mobilizing",progress:0,started:tick,frontline:[lat,lon],sector:0,log:["AI approved a border-adjacent campaign after checking readiness, force balance and diplomacy."]});events.push(attacker.name+" declared a simulated war against "+target.name+". The formation departed "+attacker.capital+".");break}}}
  for(const w of wars.filter(x=>x.status!=="Ceasefire")){const a=s.nations.find(n=>n.id===w.attacker),d=s.nations.find(n=>n.id===w.defender),u=units.find(x=>x.warId===w.id);if(!a||!d||!u)continue;u.supply=Math.max(0,u.supply-(s.upgrades[a.id+":logistics"]?0.5:1.2));if(u.supply<15)u.readiness=Math.max(15,u.readiness-1);
    if(w.stage==="Mobilizing"){w.progress=Math.min(100,w.progress+20);if(w.progress>=100){w.stage="Border approach";w.progress=0;w.status="Active";w.log.unshift("Mobilization complete. Formation begins the capital-to-frontier route.");events.push(a.name+" mobilized forces from "+a.capital+".")}}
    else if(w.stage==="Border approach"){w.progress=Math.min(100,w.progress+10);u.x=a.lat+(w.frontline[0]-a.lat)*w.progress/100;u.y=a.lon+(w.frontline[1]-a.lon)*w.progress/100;u.status="Moving to frontier";if(w.progress>=100){w.stage="Advance";w.progress=0;u.status="Advancing";w.log.unshift("Formation reached the shared land border.")}
    }else if(w.stage==="Advance"){w.progress=Math.min(100,w.progress+7);u.x=w.frontline[0]+(d.lat-w.frontline[0])*w.progress/100;u.y=w.frontline[1]+(d.lon-w.frontline[1])*w.progress/100;u.status="Advancing";if(w.progress>=100){w.stage="Battle";w.progress=0;u.status="In battle";w.log.unshift("The formation advanced from the border toward the defender's capital region.");events.push(a.name+" entered "+d.name+" in the campaign simulation.")}}
    else if(w.stage==="Battle"){const attack=totalPower(units,a.id),defense=totalPower(units,d.id);const ratio=attack/Math.max(1,defense);w.progress=Math.min(100,w.progress+Math.max(2,Math.round(3+ratio*2)));u.readiness=Math.max(10,u.readiness-(u.supply<25?3:1));if(w.progress>=100){w.stage="Occupation";w.sector=3;w.status="Ceasefire";control[d.id]=a.id;u.status="At capital";u.x=a.lat;u.y=a.lon;u.warId=undefined;u.targetId=undefined;u.progress=0;w.log.unshift("Campaign resolved: the simulated territory controller changed. The country-level map is recolored; no province boundaries are represented in Beta 0.1.");events.push(a.name+" captured control of "+d.name+" in the abstract campaign model. A ceasefire was recorded.")}}
  }
  if(tick%20===0)events.push("AI world review: national budgets, supply, diplomatic treaties and border security updated.");
  return{...s,tick,units,wars,control,credits,events:[...events,...s.events].slice(0,40)}
}
