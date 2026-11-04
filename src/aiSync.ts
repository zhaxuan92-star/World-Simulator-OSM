import type { SimState } from "./simulation";

const QUEUE_KEY = "world-simulator-ai-training-queue-v1";
const SESSION_KEY = "world-simulator-ai-session-v1";
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
export function queueCompletedCampaigns(state: SimState) {
  const queue = readQueue();
  const known = new Set(queue.flatMap(batch => batch.events.map(event => event.eventId)));
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
      tick: state.tick,
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
  const batch = queue[0];
  try {
    const response = await fetch("/api/ai-training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
      keepalive: true
    });
    if (!response.ok) return false;
    saveQueue(queue.slice(1));
    return true;
  } catch { return false; }
}
export function sendPendingOnExit() {
  const queue = readQueue();
  if (!queue.length || typeof navigator === "undefined" || !navigator.sendBeacon) return;
  try {
    const payload = new Blob([JSON.stringify(queue[0])], { type: "application/json" });
    navigator.sendBeacon("/api/ai-training", payload);
  } catch {}
}
