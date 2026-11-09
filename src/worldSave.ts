import type { SimState } from "./simulation";
import { ensureAIState } from "./simulation";
import { normalizeEconomy, type EconomyState } from "./economy";

export const WORLD_SAVE_FORMAT = "world-simulator-save";
export const WORLD_SAVE_VERSION = 3;

export type WorldSave = {
  format: typeof WORLD_SAVE_FORMAT;
  version: number;
  savedAt: string;
  gameVersion: string;
  state: SimState;
  economy?: EconomyState;
};

export function createWorldSave(state:SimState,economy?:unknown):WorldSave {
  return {
    format:WORLD_SAVE_FORMAT,version:WORLD_SAVE_VERSION,savedAt:new Date().toISOString(),
    gameVersion:"Official RTS 3.1.0",state:ensureAIState(state),
    ...(economy===undefined?{}:{economy:economy as EconomyState})
  };
}

export function serializeWorldSave(state:SimState,economy?:unknown):string {
  return JSON.stringify(createWorldSave(state,economy),null,2);
}

export function parseWorldSave(raw:string):WorldSave {
  const parsed:unknown=JSON.parse(raw);
  if(!parsed||typeof parsed!=="object") throw new Error("Save file is not a valid object.");
  const save=parsed as Partial<WorldSave>;
  if(save.format!==WORLD_SAVE_FORMAT) throw new Error("This file is not a World Simulator save.");
  if(typeof save.version!=="number"||save.version>WORLD_SAVE_VERSION||save.version<1) throw new Error("Unsupported save version.");
  const state=save.state as SimState|undefined;
  if(!state||!Array.isArray(state.nations)||!Array.isArray(state.units)||!Array.isArray(state.wars)||!state.control||(typeof (state as any).elapsedSeconds!=="number"&&!Number.isFinite(Number((state as any).tick)))) {
    throw new Error("Save data is incomplete or damaged.");
  }
  if(state.nations.length===0||state.nations.length>1000||state.units.length>100000||state.wars.length>10000) throw new Error("Save data exceeds safe limits.");
  const normalized=ensureAIState(state);
  const economy=save.economy?normalizeEconomy(save.economy,normalized.nations,normalized.credits):undefined;
  return {
    format:WORLD_SAVE_FORMAT,version:WORLD_SAVE_VERSION,savedAt:typeof save.savedAt==="string"?save.savedAt:new Date().toISOString(),
    gameVersion:"Official RTS 3.1.0",state:normalized,...(economy?{economy}:{})
  };
}

export function downloadWorldSave(state:SimState,economy?:unknown):void {
  const blob=new Blob([serializeWorldSave(state,economy)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download="world-simulator-"+new Date().toISOString().replace(/[:.]/g,"-")+".worldsave";
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function readWorldSave(file:File):Promise<WorldSave> {
  return new Promise((resolve,reject)=>{
    if(file.size>50*1024*1024){reject(new Error("Save file is larger than the 50 MB safety limit."));return;}
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("Could not read the selected save file."));
    reader.onload=()=>{try{resolve(parseWorldSave(String(reader.result??"")));}catch(error){reject(error instanceof Error?error:new Error("Invalid save file."));}};
    reader.readAsText(file);
  });
}
