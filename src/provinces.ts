import worldCountries from "world-countries";
import topologyData from "world-atlas/countries-110m.json";
import { feature } from "topojson-client";
import polygonClipping from "polygon-clipping";
import type { Nation } from "./simulation";

export type TerrainKind = "plain" | "coastal" | "hill" | "plateau" | "mountain" | "desert" | "pending";
export type ProvinceGeometry = { type: "MultiPolygon"; coordinates: number[][][][] };
export type Province = {
  id: string;
  nationId: string;
  name: string;
  lat: number;
  lon: number;
  areaKm2: number;
  population: number;
  capacity: number;
  elevationMeters: number | null;
  terrain: TerrainKind;
  coastal: boolean;
  suitability: number;
  development: number;
  geometry?: ProvinceGeometry;
};

const topology = topologyData as any;
const geo = feature(topology, topology.objects.countries) as any;
const featureById = new Map<string, any>((geo.features ?? []).map((f: any) => [String(f.id).padStart(3, "0"), f]));
const countryById = new Map<string, any>((worldCountries as any[]).map(c => [String(c.ccn3).padStart(3, "0"), c]));
const hash = (s: string) => { let h = 2166136261; for (let i=0;i<s.length;i++) h = Math.imul(h ^ s.charCodeAt(i),16777619); return h >>> 0; };

function boundsOf(rings: number[][][]): [number, number, number, number] {
  let minX=180,minY=90,maxX=-180,maxY=-90;
  for (const ring of rings) for (const point of ring) {
    minX=Math.min(minX,point[0]); maxX=Math.max(maxX,point[0]);
    minY=Math.min(minY,point[1]); maxY=Math.max(maxY,point[1]);
  }
  return [minX,minY,maxX,maxY];
}
function polygonWeight(multi: number[][][][]): number {
  let total=0;
  for(const polygon of multi) for(const ring of polygon) {
    let area=0;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) area+=ring[j][0]*ring[i][1]-ring[i][0]*ring[j][1];
    total+=(ring===polygon[0]?1:-1)*Math.abs(area/2);
  }
  return Math.max(0,total);
}
function polygonCenter(multi: number[][][][]): [number,number] {
  let x=0,y=0,n=0;
  for(const polygon of multi) for(const ring of polygon) for(const point of ring) {x+=point[0];y+=point[1];n++;}
  return n?[y/n,x/n]:[0,0];
}
function makeCountryCells(nation:Nation, area:number, count:number): {geometry:ProvinceGeometry;lat:number;lon:number;weight:number}[] {
  const f=featureById.get(nation.id);
  if(!f?.geometry)return [];
  const polygons:number[][][][]=f.geometry.type==="Polygon"?[f.geometry.coordinates]:f.geometry.coordinates;
  const cellKm=Math.sqrt(area/count);
  const latStep=cellKm/111.0;
  const output:{geometry:ProvinceGeometry;lat:number;lon:number;weight:number}[]=[];
  for(const polygon of polygons) {
    const [minLon,minLat,maxLon,maxLat]=boundsOf(polygon);
    const centerLat=(minLat+maxLat)/2;
    const lonStep=latStep/Math.max(.12,Math.cos(centerLat*Math.PI/180));
    // Align cells to each polygon's own bounds. Every point in the polygon is
    // inside one of these squares; clipping makes the outer cells follow borders.
    const cols=Math.max(1,Math.ceil((maxLon-minLon)/lonStep));
    const rows=Math.max(1,Math.ceil((maxLat-minLat)/latStep));
    for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
      const west=minLon+col*lonStep, east=Math.min(maxLon,west+lonStep);
      const south=minLat+row*latStep, north=Math.min(maxLat,south+latStep);
      if(east<=west||north<=south)continue;
      const square=[[[west,south],[east,south],[east,north],[west,north],[west,south]]];
      try {
        const clipped=polygonClipping.intersection(square as any, [polygon] as any) as number[][][][];
        if(!clipped?.length)continue;
        const weight=polygonWeight(clipped);
        if(weight<1e-12)continue;
        const [lat,lon]=polygonCenter(clipped);
        output.push({geometry:{type:"MultiPolygon",coordinates:clipped},lat,lon,weight:weight*Math.max(.08,Math.cos(lat*Math.PI/180))});
      } catch { /* Ignore only invalid/degenerate clipping fragments. */ }
    }
  }
  return output;
}

export function createProvinces(nations:Nation[]):Province[] {
  const output:Province[]=[];
  for(const nation of nations){
    const country=countryById.get(nation.id);
    const area=Math.max(1,Number(country?.area)||10000);
    const count=Math.max(3,Math.min(260,Math.round(area/60000)));
    const cells=makeCountryCells(nation,area,count);
    if(!cells.length)continue;
    const totalWeight=cells.reduce((sum,c)=>sum+c.weight,0)||1;
    const totalPop=Math.max(1000,nation.population);
    const totalCapacity=Math.max(totalPop,nation.populationCapacity);
    cells.forEach((cell,i)=>{
      const share=cell.weight/totalWeight;
      const capacity=Math.max(100,Math.round(totalCapacity*share));
      const population=Math.max(0,Math.round(totalPop*share));
      const coastalCandidate=!Boolean(country?.landlocked);
      const suitability=1;
      output.push({
        id:nation.id+"-P"+String(i+1).padStart(4,"0"),nationId:nation.id,
        name:nation.name+" · Ô "+(i+1),lat:cell.lat,lon:cell.lon,
        areaKm2:area*share,population,capacity,elevationMeters:null,
        terrain:"pending",coastal:coastalCandidate,suitability,geometry:cell.geometry,
        development:Math.max(1,Math.min(100,Math.round(22+suitability*18+(hash(nation.id+":"+i)%35))))
      });
    });
  }
  return output;
}

/** Rebuild old rectangular province records as exact boundary-clipped cells,
 * retaining their existing population, capacity, elevation and development. */
export function ensureProvinceGeometry(existing:Province[]|undefined,nations:Nation[]):Province[] {
  if(existing?.length&&existing.every(p=>p.geometry?.type==="MultiPolygon"&&p.geometry.coordinates?.length))return existing;
  const rebuilt=createProvinces(nations);
  if(!existing?.length)return rebuilt;
  const byNation=new Map<string,Province[]>();
  for(const p of existing){const list=byNation.get(p.nationId)??[];list.push(p);byNation.set(p.nationId,list);}
  const groups=new Map<string,Province[]>();
  for(const p of rebuilt){const list=groups.get(p.nationId)??[];list.push(p);groups.set(p.nationId,list);}
  for(const [nationId,next] of groups){
    const old=byNation.get(nationId)??[];
    if(!old.length)continue;
    const oldPop=old.reduce((sum,p)=>sum+p.population,0);
    const oldCapacity=old.reduce((sum,p)=>sum+p.capacity,0);
    const weights=next.map(p=>Math.max(0,p.areaKm2));
    const total=weights.reduce((a,b)=>a+b,0)||1;
    next.forEach((p,i)=>{
      const source=old[Math.min(old.length-1,Math.floor(i*old.length/next.length))];
      p.population=Math.round(oldPop*weights[i]/total);
      p.capacity=Math.max(p.population,Math.round(oldCapacity*weights[i]/total));
      p.elevationMeters=source?.elevationMeters??null;
      p.terrain=source?.terrain??"pending";
      p.coastal=source?.coastal??p.coastal;
      p.suitability=source?.suitability??1;
      p.development=source?.development??p.development;
    });
  }
  return rebuilt;
}

export function applyProvinceElevation(provinces:Province[],nationId:string,values:number[]):Province[]{
  let index=0;
  return provinces.map(p=>{
    if(p.nationId!==nationId||p.elevationMeters!==null)return p;
    const elevation=Number(values[index++]);
    if(!Number.isFinite(elevation))return p;
    let terrain:TerrainKind="plain",suitability=1,coastal=false;
    if(elevation>=2200){terrain="mountain";suitability=.2}
    else if(elevation>=1000){terrain="plateau";suitability=.48}
    else if(elevation>=450){terrain="hill";suitability=.72}
    else if(p.coastal&&elevation<35){terrain="coastal";suitability=1.2;coastal=true}
    else if(elevation<80){terrain="plain";suitability=1.12}
    return {...p,coastal,elevationMeters:elevation,terrain,suitability,capacity:Math.max(100,Math.round(p.capacity*suitability))};
  });
}
export function rebalanceProvincePopulation(provinces:Province[],nationId:string,total:number):Province[]{
  const rows=provinces.filter(p=>p.nationId===nationId);
  if(!rows.length)return provinces;
  const current=rows.reduce((sum,p)=>sum+p.population,0);
  let delta=Math.round(total-current);
  const assigned=new Map(rows.map(p=>[p.id,p.population]));
  if(delta>0){
    const room=rows.reduce((sum,p)=>sum+Math.max(0,p.capacity-p.population),0);
    let remaining=Math.min(delta,room);
    const weights=rows.map(p=>Math.max(0,p.capacity-p.population)*Math.max(.05,p.suitability)*(1+p.development/200));
    const weightTotal=weights.reduce((a,b)=>a+b,0)||1;
    rows.forEach((p,i)=>{const amount=Math.min(Math.max(0,p.capacity-p.population),Math.round(remaining*weights[i]/weightTotal));assigned.set(p.id,(assigned.get(p.id)??0)+amount)});
    let used=[...assigned.entries()].reduce((sum,[id,value])=>sum+value,0)-current;
    for(const p of rows){if(used>=remaining)break;const roomLeft=Math.max(0,p.capacity-(assigned.get(p.id)??0));if(roomLeft){const amount=Math.min(roomLeft,remaining-used);assigned.set(p.id,(assigned.get(p.id)??0)+amount);used+=amount}}
  }else if(delta<0){
    let remaining=Math.min(-delta,current);
    const weights=rows.map(p=>p.population);
    const weightTotal=weights.reduce((a,b)=>a+b,0)||1;
    rows.forEach((p,i)=>{const amount=Math.min(p.population,Math.round(remaining*weights[i]/weightTotal));assigned.set(p.id,Math.max(0,p.population-amount))});
    let removed=current-[...assigned.values()].reduce((a,b)=>a+b,0);
    for(const p of rows){if(removed>=remaining)break;const available=assigned.get(p.id)??0;if(available){const amount=Math.min(available,remaining-removed);assigned.set(p.id,available-amount);removed+=amount}}
  }
  return provinces.map(p=>assigned.has(p.id)?{...p,population:Math.max(0,assigned.get(p.id)??0)}:p);
}
