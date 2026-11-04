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
const round2 = (n:number) => Math.round(n*100)/100;
const resourceKeys: ResourceKey[] = ["food","energy","materials","technology"];

export function createEconomy(nations:Nation[], credits:Record<string,number> = {}):EconomyState {
  const result:EconomyState = {};
  for (const n of nations) {
    const population = Math.max(1000,n.population);
    const scale = Math.max(1,population/1_000_000);
    const productivity = clamp(0.65 + n.stability/250 + n.diplomacy/500,0.55,1.35);
    result[n.id] = {
      population,
      treasury: Math.max(0,credits[n.id] ?? 100),
      taxRate: 0.18,
      gdp: round2(scale * 1.8 * productivity),
      productivity: round2(productivity),
      resources: {food:round2(scale*12),energy:round2(scale*8),materials:round2(scale*5),technology:round2(scale*1.5)},
      production: {food:0,energy:0,materials:0,technology:0},
      consumption: {food:0,energy:0,materials:0,technology:0},
      tradeBalance: 0
    };
  }
  return result;
}

export function economyMetrics(nation:Nation,economy:NationalEconomy) {
  const scale = Math.max(1,economy.population/1_000_000);
  const productivity = clamp(economy.productivity,0.25,2);
  const annualGdp = Math.max(0,economy.gdp);
  const taxRevenue = annualGdp * clamp(economy.taxRate,0,0.5);
  const employment = clamp(58 + nation.stability*0.22 + productivity*12,25,98);
  const growth = (productivity-0.8)*2 + (nation.stability-50)*0.025;
  return {
    annualGdp:round2(annualGdp),
    taxRevenue:round2(taxRevenue),
    employment:Math.round(employment),
    growth:round2(growth),
    gdpPerCapita:round2(annualGdp*1_000_000/Math.max(1,economy.population)),
    populationScale:scale
  };
}

export function advanceEconomy(state:SimState,economy:EconomyState):EconomyState {
  const next:EconomyState = {...economy};
  for (const nation of state.nations) {
    const old = economy[nation.id];
    if (!old) continue;
    const metrics = economyMetrics(nation,old);
    const population = Math.max(1000,Math.round(old.population*(1 + metrics.growth/100/365)));
    const production = {
      food:round2(Math.max(0,old.population/1_000_000*0.012*old.productivity)),
      energy:round2(Math.max(0,old.population/1_000_000*0.008*old.productivity)),
      materials:round2(Math.max(0,old.population/1_000_000*0.004*old.productivity)),
      technology:round2(Math.max(0,old.population/1_000_000*0.0012*old.productivity))
    };
    const consumption = {
      food:round2(population/1_000_000*0.010),
      energy:round2(population/1_000_000*0.006),
      materials:round2(population/1_000_000*0.0025),
      technology:round2(population/1_000_000*0.0007)
    };
    const resources = {...old.resources};
    for (const key of resourceKeys) resources[key] = round2(clamp(resources[key]+production[key]-consumption[key],0,1_000_000_000));
    const taxRevenue = metrics.taxRevenue/365;
    const operatingCost = old.gdp*0.0008;
    const resourceSurplus = resourceKeys.reduce((sum,key)=>sum+production[key]-consumption[key],0);
    const treasury = Math.max(0,old.treasury+taxRevenue-operatingCost);
    const productivity = clamp(old.productivity + (nation.stability-50)*0.000002 + (resources.technology>old.resources.technology?0.0001:-0.0001),0.25,2);
    next[nation.id] = {
      ...old,population,treasury:round2(treasury),productivity:round2(productivity),
      gdp:round2(old.gdp*(1+metrics.growth/100/365)),
      resources,production,consumption,tradeBalance:round2(old.tradeBalance+resourceSurplus)
    };
  }
  return next;
}

export function setTaxRate(economy:EconomyState,nationId:string,rate:number):EconomyState {
  const current=economy[nationId];
  if(!current)return economy;
  return {...economy,[nationId]:{...current,taxRate:clamp(rate,0,0.5)}};
}

export function tradeResource(economy:EconomyState,from:string,to:string,key:ResourceKey,amount:number):EconomyState {
  const seller=economy[from],buyer=economy[to];
  if(!seller||!buyer||from===to||!Number.isFinite(amount)||amount<=0||seller.resources[key]<amount)return economy;
  const price=key==="technology"?4:key==="materials"?2:key==="energy"?1.5:1;
  const cost=round2(amount*price);
  if(buyer.treasury<cost)return economy;
  return {
    ...economy,
    [from]:{...seller,resources:{...seller.resources,[key]:round2(seller.resources[key]-amount)},treasury:round2(seller.treasury+cost),tradeBalance:round2(seller.tradeBalance+cost)},
    [to]:{...buyer,resources:{...buyer.resources,[key]:round2(buyer.resources[key]+amount)},treasury:round2(buyer.treasury-cost),tradeBalance:round2(buyer.tradeBalance-cost)}
  };
}
