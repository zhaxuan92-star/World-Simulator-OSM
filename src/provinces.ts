import worldCountries from "world-countries";
import topologyData from "world-atlas/countries-110m.json";
import { feature } from "topojson-client";
import type { Nation } from "./simulation";

export type TerrainKind = "plain" | "coastal" | "hill" | "plateau" | "mountain" | "desert" | "pending";
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
};

const topology = topologyData as any;
const geo = feature(topology, topology.objects.countries) as any;
const featureById = new Map<string, any>((geo.features ?? []).map((f: any) => [String(f.id).padStart(3, "0"), f]));
const countryById = new Map<string, any>((worldCountries as any[]).map(c => [String(c.ccn3).padStart(3, "0"), c]));
const hash = (s: string) => { let h = 2166136261; for (let i=0;i<s.length;i++) h = Math.imul(h ^ s.charCodeAt(i),16777619); return h >>> 0; };
function insideRing(point: [number,number], ring: number[][]): boolean {
  const [x,y]=point; let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const xi=ring[i][0], yi=ring[i][1], xj=ring[j][0], yj=ring[j][1];
    const crosses=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi+1e-12)+xi);
    if(crosses)inside=!inside;
  }
  return inside;
}
function insideGeometry(point:[number,number], geometry:any):boolean {
  if(!geometry)return false;
  const polygons=geometry.type==="Polygon"?[geometry.coordinates]:geometry.coordinates??[];
  return polygons.some((poly:any[])=>poly.length>0&&insideRing(point,poly[0])&&!poly.slice(1).some((hole:any[])=>insideRing(point,hole)));
}
function geometryBounds(g:any):[number,number,number,number] {
  let minX=180,minY=90,maxX=-180,maxY=-90;
  const walk=(v:any):void=>{if(typeof v?.[0]==="number"&&typeof v?.[1]==="number"){minX=Math.min(minX,v[0]);maxX=Math.max(maxX,v[0]);minY=Math.min(minY,v[1]);maxY=Math.max(maxY,v[1]);}else if(Array.isArray(v))v.forEach(walk)};
  walk(g?.coordinates); return [minX,minY,maxX,maxY];
}
export function createProvinces(nations:Nation[]):Province[] {
  const output:Province[]=[];
  for(const nation of nations){
    const f=featureById.get(nation.id),country=countryById.get(nation.id);
    if(!f?.geometry)continue;
    const area=Math.max(100,Number(country?.area)||10000);
    const count=Math.max(3,Math.min(260,Math.round(area/60000)));
    const [minLon,minLat,maxLon,maxLat]=geometryBounds(f.geometry);
    const latStep=Math.sqrt(area/count)/111;
    const centerLat=(minLat+maxLat)/2;
    const lonStep=latStep/Math.max(.18,Math.cos(centerLat*Math.PI/180));
    const candidates:[number,number][]=[];
    for(let lat=minLat+latStep*.35;lat<=maxLat;lat+=latStep){
      for(let lon=minLon+lonStep*.35;lon<=maxLon;lon+=lonStep){
        if(insideGeometry([lon,lat],f.geometry))candidates.push([lat,lon]);
      }
    }
    if(candidates.length<count){
      const seed=hash(nation.id);let tries=0;
      while(candidates.length<count&&tries<count*100){
        const a=((seed+tries*2654435761)>>>0)/4294967295;
        const b=((seed+tries*2246822519+17)>>>0)/4294967295;
        const lat=minLat+(maxLat-minLat)*a,lon=minLon+(maxLon-minLon)*b;
        if(insideGeometry([lon,lat],f.geometry)&&!candidates.some(p=>Math.abs(p[0]-lat)<.03&&Math.abs(p[1]-lon)<.03))candidates.push([lat,lon]);
        tries++;
      }
    }
    if(!candidates.length)candidates.push([nation.lat,nation.lon]);
    const chosen=candidates.slice(0,count);
    const landlocked=Boolean(country?.landlocked);
    const weights=chosen.map(([lat,lon],i)=>{const coastal=!landlocked&&(i%4===0||Math.abs(lat)>55);const variation=.85+((hash(nation.id+":"+i)%31)/100);return coastal?variation*1.2:variation});
    const sum=weights.reduce((a,b)=>a+b,0);
    const totalPop=Math.max(1000,nation.population);
    const totalCapacity=Math.max(totalPop,nation.populationCapacity);
    chosen.forEach(([lat,lon],i)=>{
      const coastal=!landlocked&&(i%4===0||Math.abs(lat)>55);
      const suitability=coastal?1.2:1;
      const provinceArea=area/chosen.length;
      const capacity=Math.max(500,Math.round(totalCapacity*weights[i]/sum));
      const population=Math.max(100,Math.round(totalPop*weights[i]/sum));
      output.push({
        id:nation.id+"-P"+String(i+1).padStart(3,"0"),nationId:nation.id,
        name:nation.name+" · Tỉnh "+(i+1),lat,lon,areaKm2:provinceArea,
        population,capacity,elevationMeters:null,terrain:"pending",coastal,suitability,
        development:Math.max(1,Math.min(100,Math.round(22+suitability*18+(hash(nation.id+":"+i)%35))))
      });
    });
  }
  return output;
}
export function applyProvinceElevation(provinces:Province[],nationId:string,values:number[]):Province[]{
  let index=0;
  return provinces.map(p=>{
    if(p.nationId!==nationId||p.elevationMeters!==null)return p;
    const elevation=Number(values[index++]);
    if(!Number.isFinite(elevation))return p;
    let terrain:TerrainKind="plain",suitability=1;
    if(elevation>=2200){terrain="mountain";suitability=.2}
    else if(elevation>=1000){terrain="plateau";suitability=.48}
    else if(elevation>=450){terrain="hill";suitability=.72}
    else if(p.coastal){terrain="coastal";suitability=1.2}
    else if(elevation<80){terrain="plain";suitability=1.12}
    return {...p,elevationMeters:elevation,terrain,suitability,capacity:Math.max(100,Math.round(p.capacity*suitability))};
  });
}
export function rebalanceProvincePopulation(provinces:Province[],nationId:string,total:number):Province[]{
  const rows=provinces.filter(p=>p.nationId===nationId);
  if(!rows.length)return provinces;
  const weights=rows.map(p=>Math.max(.05,p.suitability)*(1+p.development/200));
  const sum=weights.reduce((a,b)=>a+b,0);
  const assigned=new Map(rows.map((p,i)=>[p.id,Math.round(total*weights[i]/sum)]));
  let difference=total-[...assigned.values()].reduce((a,b)=>a+b,0);
  if(difference)assigned.set(rows[0].id,(assigned.get(rows[0].id)??0)+difference);
  return provinces.map(p=>assigned.has(p.id)?{...p,population:Math.max(0,assigned.get(p.id)??0)}:p);
}
