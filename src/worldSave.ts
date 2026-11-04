import type { SimState } from "./simulation";

export const WORLD_SAVE_FORMAT = "world-simulator-save";
export const WORLD_SAVE_VERSION = 1;

export type WorldSave = {
  format: typeof WORLD_SAVE_FORMAT;
  version: number;
  savedAt: string;
  gameVersion: string;
  state: SimState;
  economy?: unknown;
};

export function createWorldSave(state:SimState,economy?:unknown):WorldSave {
  return {
    format:WORLD_SAVE_FORMAT,
    version:WORLD_SAVE_VERSION,
    savedAt:new Date().toISOString(),
    gameVersion:"Alpha",
    state,
    ...(economy===undefined?{}:{economy})
  };
}

export function serializeWorldSave(state:SimState,economy?:unknown):string {
  return JSON.stringify(createWorldSave(state,economy),null,2);
}

export function parseWorldSave(raw:string):WorldSave {
  const parsed:unknown=JSON.parse(raw);
  if(!parsed||typeof parsed!=="object")throw new Error("Save file is not a valid object.");
  const save=parsed as Partial<WorldSave>;
  if(save.format!==WORLD_SAVE_FORMAT)throw new Error("This file is not a World Simulator save.");
  if(typeof save.version!=="number"||save.version>WORLD_SAVE_VERSION||save.version<1)throw new Error("Unsupported save version.");
  const s=save.state as SimState|undefined;
  if(!s||!Array.isArray(s.nations)||!Array.isArray(s.units)||!Array.isArray(s.wars)||!s.control||typeof s.tick!=="number") {
    throw new Error("Save data is incomplete or damaged.");
  }
  if(s.nations.length===0)throw new Error("Save contains no countries.");
  return save as WorldSave;
}

export function downloadWorldSave(state:SimState,economy?:unknown):void {
  const blob=new Blob([serializeWorldSave(state,economy)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="world-simulator-"+new Date().toISOString().replace(/[:.]/g,"-")+".worldsave";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function readWorldSave(file:File):Promise<WorldSave> {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("Could not read the selected save file."));
    reader.onload=()=> {
      try{resolve(parseWorldSave(String(reader.result??"")));}
      catch(error){reject(error instanceof Error?error:new Error("Invalid save file."));}
    };
    reader.readAsText(file);
  });
}
