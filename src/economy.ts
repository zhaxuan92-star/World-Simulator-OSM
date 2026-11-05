import type { Nation, SimState } from "./simulation";

export type ResourceKey = "food" | "energy" | "materials" | "technology";
export type NationalEconomy = {
  population: number;
  treasury: number;
  taxRate: number;
  gdp: number;
  productivity: number;
  resources: Record<ResourceKey, number>;
  production: Record<ResourceKey, number>;
  consumption: Record<ResourceKey, number>;
  tradeBalance: number;
};
export type EconomyState = Record<string, NationalEconomy>;

const clamp = (n:number,min:number,max:number) => Math.max(min,Math.min(max,n));
const finite = (n:unknown,fallback=0) => typeof n==="number"&&Number.isFinite(n)?n:fallback;
const round2 = (n:number) => Math.round(n*100)/100;
const resourceKeys: ResourceKey[] = ["food","energy","materials","technology"];

function normalizeNationalEconomy(value:unknown,population:number,treasury:number):NationalEconomy {
  const raw=(value&&typeof value==="object"?value:{}) as Partial<NationalEconomy>;
  const resources=(raw.resources??{}) as Partial<Record<ResourceKey,number>>;
  const production=(raw.production??{}) as Partial<Record<ResourceKey,number>>;
  const consumption=(raw.consumption??{}) as Partial<Record<ResourceKey,number>>;
  const clean=(source:Partial<Record<ResourceKey,number>>) => ({
    food:round2(clamp(finite(source.food),0,1_000_000_000)),
    energy:round2(clamp(finite(source.energy),0,1_000_000_000)),
    materials:round2(clamp(finite(source.materials),0,1_000_000_000)),
    technology:round2(clamp(finite(source.technology),0,1_000_000_000))
  });
  return {
    population:Math.max(1000,finite(raw.population,population)),
    treasury:round2(clamp(finite(raw.treasury,treasury),0,1_000_000_000_000)),
    taxRate:clamp(finite(raw.taxRate,.18),0,.5),
    gdp:round2(clamp(finite(raw.gdp,0),0,1_000_000_000_000)),
    productivity:round2(clamp(finite(raw.productivity,1),.25,2)),
    resources:clean(resources),production:clean(production),consumption:clean(consumption),
    tradeBalance:round2(finite(raw.tradeBalance))
  };
}

export function normalizeEconomy(economy:unknown,nations:Nation[],credits:Record<string,number>={}):EconomyState {
  const source=(economy&&typeof economy==="object"?economy:{}) as Record<string,unknown>;
  const result:EconomyState={};
  for(const nation of nations) result[nation.id]=normalizeNationalEconomy(source[nation.id],nation.population,credits[nation.id]??100);
  return result;
}

export function createEconomy(nations:Nation[], credits:Record<string,number> = {}):EconomyState {
  const result:EconomyState = {};
  for (const n of nations) {
    const population = Math.max(1000,n.population);
    const scale = Math.max(1,population/1_000_000);
    const productivity = clamp(0.65 + n.stability/250 + n.diplomacy/500,0.55,1.35);
    result[n.id] = {
      population,treasury:Math.max(0,credits[n.id]??100),taxRate:.18,
      gdp:round2(scale*1.8*productivity),productivity:round2(productivity),
      resources:{food:round2(scale*12),energy:round2(scale*8),materials:round2(scale*5),technology:round2(scale*1.5)},
      production:{food:0,energy:0,materials:0,technology:0},
      consumption:{food:0,energy:0,materials:0,technology:0},tradeBalance:0
    };
  }
  return result;
}

export function economyMetrics(nation:Nation,economy:NationalEconomy) {
  const productivity=clamp(finite(economy.productivity,1),.25,2);
  const annualGdp=Math.max(0,finite(economy.gdp));
  const taxRevenue=annualGdp*clamp(finite(economy.taxRate,.18),0,.5);
  const employment=clamp(58+nation.stability*.22+productivity*12,25,98);
  const growth=(productivity-.8)*2+(nation.stability-50)*.025;
  return {
    annualGdp:round2(annualGdp),taxRevenue:round2(taxRevenue),employment:Math.round(employment),
    growth:round2(growth),gdpPerCapita:round2(annualGdp*1_000_000/Math.max(1,economy.population)),
    populationScale:Math.max(1,economy.population/1_000_000)
  };
}

export function advanceEconomy(state:SimState,economy:EconomyState):EconomyState {
  const next:EconomyState={...economy};
  for(const nation of state.nations){
    const previous=economy[nation.id];
    if(!previous) continue;
    const old=normalizeNationalEconomy(previous,nation.population,state.credits[nation.id]??100);
    const metrics=economyMetrics(nation,old);
    // Population is authoritative in the simulation engine; this prevents two competing population totals.
    const population=Math.max(1000,finite(nation.population,old.population));
    const scale=population/1_000_000;
    const production={
      food:round2(Math.max(0,scale*.012*old.productivity)),
      energy:round2(Math.max(0,scale*.008*old.productivity)),
      materials:round2(Math.max(0,scale*.004*old.productivity)),
      technology:round2(Math.max(0,scale*.0012*old.productivity))
    };
    const consumption={
      food:round2(scale*.010),energy:round2(scale*.006),
      materials:round2(scale*.0025),technology:round2(scale*.0007)
    };
    const resources={...old.resources};
    for(const key of resourceKeys) resources[key]=round2(clamp(old.resources[key]+production[key]-consumption[key],0,1_000_000_000));
    const taxRevenue=metrics.taxRevenue/365;
    const operatingCost=Math.max(.01,old.gdp*.0008);
    const treasury=clamp(old.treasury+taxRevenue-operatingCost,0,1_000_000_000_000);
    const resourcePressure=resourceKeys.reduce((sum,key)=>sum+(production[key]-consumption[key]),0);
    const productivity=clamp(old.productivity+(nation.stability-50)*.000002+(resources.technology>old.resources.technology?.0001:-.0001),.25,2);
    const growthFactor=1+metrics.growth/100/365;
    next[nation.id]={
      ...old,population,treasury:round2(treasury),productivity:round2(productivity),
      gdp:round2(clamp(old.gdp*growthFactor,0,1_000_000_000_000)),
      resources,production,consumption,tradeBalance:round2(old.tradeBalance+resourcePressure)
    };
  }
  return next;
}

export function setTaxRate(economy:EconomyState,nationId:string,rate:number):EconomyState {
  const current=economy[nationId];
  if(!current||!Number.isFinite(rate)) return economy;
  return {...economy,[nationId]:{...current,taxRate:clamp(rate,0,.5)}};
}

export function tradeResource(economy:EconomyState,from:string,to:string,key:ResourceKey,amount:number):EconomyState {
  const seller=economy[from],buyer=economy[to];
  if(!seller||!buyer||from===to||!resourceKeys.includes(key)||!Number.isFinite(amount)||amount<=0||amount>seller.resources[key]) return economy;
  const price=key==="technology"?4:key==="materials"?2:key==="energy"?1.5:1;
  const cost=round2(amount*price);
  if(!Number.isFinite(cost)||buyer.treasury<cost) return economy;
  return {
    ...economy,
    [from]:{...seller,resources:{...seller.resources,[key]:round2(seller.resources[key]-amount)},treasury:round2(seller.treasury+cost),tradeBalance:round2(seller.tradeBalance+cost)},
    [to]:{...buyer,resources:{...buyer.resources,[key]:round2(buyer.resources[key]+amount)},treasury:round2(buyer.treasury-cost),tradeBalance:round2(buyer.tradeBalance-cost)}
  };
}
