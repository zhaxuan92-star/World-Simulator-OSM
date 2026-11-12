import type { SimState } from "./simulation";
import { doc, writeBatch, serverTimestamp, setDoc, getDocs, collection, query, where } from "firebase/firestore";
import { db, getFirebaseUser } from "./firebase";

const QUEUE_KEY = "world-simulator-ai-training-queue-v1";
const SESSION_KEY = "world-simulator-ai-session-v1";
const SENT_KEY = "world-simulator-ai-sent-events-v1";
const WORLD_KEY = "world-simulator-firebase-world-id-v1";

type TrainingEvent = {
  eventId: string;
  attacker: string;
  defender: string;
  winner: string;
  tick: number;
  sector: number;
  attackerScore: number;
  defenderScore: number;
};
type TrainingBatch = {
  schema: 1;
  sessionId: string;
  batchId: string;
  createdAt: string;
  events: TrainingEvent[];
};
function readQueue(): TrainingBatch[] {
  try {
    const value = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(value) ? value.slice(-30) : [];
  } catch { return []; }
}
function saveQueue(queue: TrainingBatch[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-30))); } catch {}
}
function sessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : "session-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch { return "anonymous-session"; }
}
function worldId(uid: string): string {
  const key = WORLD_KEY + ":" + uid;
  let id = localStorage.getItem(key);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "world-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    localStorage.setItem(key, id);
  }
  return id;
}
export function queueCompletedCampaigns(state: SimState) {
  const queue = readQueue();
  let sent: string[] = [];
  try { sent = JSON.parse(localStorage.getItem(SENT_KEY) || "[]"); } catch {}
  const known = new Set([...sent, ...queue.flatMap(batch => batch.events.map(event => event.eventId))]);
  const completed = state.wars.filter(w => w.status === "Ceasefire" && w.log.includes("champion-evaluated") && !known.has(w.id));
  if (!completed.length) return;
  const events = completed.slice(0, 40).map(w => {
    const winner = state.control[w.defender] === w.attacker ? w.attacker : w.defender;
    const attacker = state.aiProfiles[w.attacker];
    const defender = state.aiProfiles[w.defender];
    return {
      eventId: w.id,
      attacker: w.attacker,
      defender: w.defender,
      winner,
      tick: state.elapsedSeconds,
      sector: w.sector,
      attackerScore: attacker?.score ?? 0,
      defenderScore: defender?.score ?? 0
    };
  });
  queue.push({
    schema: 1,
    sessionId: sessionId(),
    batchId: "batch-" + Date.now().toString(36) + "-" + events[0].eventId,
    createdAt: new Date().toISOString(),
    events
  });
  saveQueue(queue);
}
export function pendingTrainingBatches(): number {
  return readQueue().length;
}
export async function flushTrainingQueue(): Promise<boolean> {
  const queue = readQueue();
  if (!queue.length) return true;
  const batchData = queue[0];
  try {
    const user = await getFirebaseUser();
    const batch = writeBatch(db);
    const world = worldId(user.uid);
    const playerRef = doc(db, "players", user.uid);
    const worldRef = doc(db, "worlds", world);

    batch.set(playerRef, {
      uid: user.uid,
      username: "Anonymous player",
      status: "active",
      authProvider: "anonymous",
      lastSeenAt: serverTimestamp()
    }, { merge: true });

    batch.set(worldRef, {
      worldId: world,
      worldName: "World Simulator world",
      ownerId: user.uid,
      status: "active",
      lastUpdatedAt: serverTimestamp()
    }, { merge: true });

    for (const event of batchData.events) {
      const eventDocId = (user.uid + "_" + event.eventId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 1400);
      batch.set(doc(db, "ai_training", eventDocId), {
        ...event,
        worldId: world,
        playerId: user.uid,
        sessionId: batchData.sessionId,
        batchId: batchData.batchId,
        createdAt: serverTimestamp(),
        schemaVersion: 1
      }, { merge: true });
    }

    await batch.commit();
    saveQueue(queue.slice(1));
    try {
      const sent = JSON.parse(localStorage.getItem(SENT_KEY) || "[]") as string[];
      localStorage.setItem(SENT_KEY, JSON.stringify([...sent, ...batchData.events.map(event => event.eventId)].slice(-500)));
    } catch {}
    return true;
  } catch (error) {
    console.warn("Firebase AI training sync failed; keeping local queue.", error);
    return false;
  }
}
export function sendPendingOnExit() {
  // Firestore writes require an authenticated SDK session. The 15-second
  // foreground sync is the reliable path; keep queued events for the next visit.
}


export async function saveWorldSnapshot(state: SimState, economySnapshot?: unknown): Promise<boolean> {
  try {
    const user = await getFirebaseUser();
    const world = worldId(user.uid);
    const worldRef = doc(db, "worlds", world);
    const provinces = Array.isArray(state.provinces) ? state.provinces : [];
    const { provinces: _provincePayload, ...compactState } = state;
    const chunkSize = 300;
    const chunkCount = Math.ceil(provinces.length / chunkSize);
    const syncKey = "world-simulator-province-sync-v1:" + world;
    const lastSync = Number(localStorage.getItem(syncKey) || 0);
    const syncProvinceChunks = chunkCount > 0 && Date.now() - lastSync >= 60000;
    const payload = {
      worldId: world,
      worldName: "World Simulator",
      ownerId: user.uid,
      status: "active",
      tick: state.elapsedSeconds,
      gameState: compactState,
      provinceChunkCount: chunkCount,
      ...(economySnapshot===undefined?{}:{economySnapshot}),
      lastUpdatedAt: serverTimestamp(),
      schemaVersion: 2
    };
    if (syncProvinceChunks) {
      const batch = writeBatch(db);
      batch.set(worldRef, payload, { merge: true });
      for (let i=0;i<chunkCount;i++) {
        const chunkRef = doc(db, "worlds", world + "-province-" + i);
        batch.set(chunkRef, { worldId:world, parentWorldId:world, ownerId:user.uid, provinceChunk:true, index:i, provinces:provinces.slice(i*chunkSize,(i+1)*chunkSize), lastUpdatedAt:serverTimestamp(), schemaVersion:2 }, { merge:true });
      }
      await batch.commit();
      localStorage.setItem(syncKey, String(Date.now()));
    } else {
      await setDoc(worldRef, payload, { merge: true });
    }
    return true;
  } catch (error) {
    console.warn("World cloud save failed", error);
    return false;
  }
}


export async function loadWorldSnapshot(): Promise<SimState | null> {
  try {
    const user = await getFirebaseUser();
    const q = query(collection(db, "worlds"), where("ownerId", "==", user.uid));
    const result = await getDocs(q);
    const docs = result.docs
      .filter(item => { const state=item.data().gameState; return state && (typeof state.elapsedSeconds === "number" || typeof state.tick === "number"); })
      .sort((a, b) => (b.data().lastUpdatedAt?.toMillis?.() ?? 0) - (a.data().lastUpdatedAt?.toMillis?.() ?? 0));
    if (!docs.length) return null;
    const latest=docs[0],data=latest.data(),saved=data.gameState as SimState;
    const chunkCount=Math.max(0,Number(data.provinceChunkCount)||0);
    if(!chunkCount)return saved;
    const provinces=result.docs
      .filter(item=>item.data().parentWorldId===latest.id&&item.data().provinceChunk===true)
      .map(item=>item.data())
      .filter(item=>Number(item.index)<chunkCount&&Array.isArray(item.provinces))
      .sort((a,b)=>Number(a.index)-Number(b.index))
      .flatMap(item=>item.provinces);
    return {...saved,provinces:provinces.length?provinces:(saved.provinces??[])};
  } catch (error) {
    console.warn("World cloud load failed", error);
    return null;
  }
}


export async function loadWorldEconomySnapshot(): Promise<unknown | null> {
  try {
    const user = await getFirebaseUser();
    const q = query(collection(db, "worlds"), where("ownerId", "==", user.uid));
    const result = await getDocs(q);
    const docs = result.docs.map(item => item.data())
      .filter(data => data.gameState && (typeof data.gameState.elapsedSeconds === "number" || typeof data.gameState.tick === "number"))
      .sort((a, b) => (b.lastUpdatedAt?.toMillis?.() ?? 0) - (a.lastUpdatedAt?.toMillis?.() ?? 0));
    return docs.length ? docs[0].economySnapshot ?? null : null;
  } catch (error) {
    console.warn("Cloud economy load failed", error);
    return null;
  }
}
