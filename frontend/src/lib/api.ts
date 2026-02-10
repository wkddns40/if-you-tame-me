const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface SpeechResult {
  audio_url: string;
  cache_hit: boolean;
}

export async function fetchSpeech(
  text: string,
  voiceId: string = "shimmer"
): Promise<SpeechResult> {
  const res = await fetch(`${API_URL}/chat/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice_id: voiceId }),
  });

  if (!res.ok) {
    throw new Error(`TTS request failed: ${res.status}`);
  }

  return res.json();
}

export interface CreateCompanionPayload {
  user_id: string;
  name: string;
  relationship_type: string;
  tone_style: string;
}

export async function createCompanion(payload: CreateCompanionPayload) {
  const res = await fetch(`${API_URL}/companions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Create companion failed: ${res.status}`);
  return res.json();
}

export interface DailyEmotion {
  date: string;
  companion_id: string;
  primary_emotion: string | null;
  color_hex: string | null;
  summary_text: string | null;
  key_quote: string | null;
}

export async function fetchEmotions(companionId: string): Promise<DailyEmotion[]> {
  const res = await fetch(`${API_URL}/emotions/${companionId}`);
  if (!res.ok) throw new Error(`Fetch emotions failed: ${res.status}`);
  return res.json();
}

export interface InventoryItem {
  item_id: string;
  user_id: string;
  item_type: string | null;
  image_url: string | null;
  metadata: Record<string, unknown> | null;
  acquired_at: string;
}

export async function fetchInventory(userId: string): Promise<InventoryItem[]> {
  const res = await fetch(`${API_URL}/inventory/${userId}`);
  if (!res.ok) throw new Error(`Fetch inventory failed: ${res.status}`);
  return res.json();
}

export async function crystallize(companionId: string, userId: string) {
  const res = await fetch(`${API_URL}/store/crystallize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companion_id: companionId, user_id: userId }),
  });
  if (!res.ok) throw new Error(`Crystallize failed: ${res.status}`);
  return res.json();
}
