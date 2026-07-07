import { apiRequest } from "@/lib/queryClient";

// Transport layer for persistent chart drawings (/api/drawings).
// Anchor times travel as ISO strings over JSON (the server coerces to Date).

/** A drawing row as serialized by the API (timestamps become ISO strings). */
export interface DrawingRow {
  id: number;
  userId: number | null;
  symbol: string;
  kind: "horizontal" | "trend" | "vertical";
  aTime: string | null;
  aPrice: number | null;
  bTime: string | null;
  bPrice: number | null;
  alertId: number | null;
  createdAt: string | null;
}

export interface DrawingAnchorsPayload {
  aTime?: string;
  aPrice?: number;
  bTime?: string;
  bPrice?: number;
}

export async function fetchDrawings(symbol: string): Promise<DrawingRow[]> {
  const res = await fetch(`/api/drawings/${symbol}`);
  if (!res.ok) throw new Error("Failed to fetch drawings");
  return res.json();
}

export async function createDrawing(
  payload: { symbol: string; kind: DrawingRow["kind"] } & DrawingAnchorsPayload,
): Promise<DrawingRow> {
  const res = await apiRequest("POST", "/api/drawings", payload);
  return res.json();
}

export async function updateDrawing(
  id: number,
  payload: DrawingAnchorsPayload & { alertId?: number | null },
): Promise<DrawingRow> {
  const res = await apiRequest("PUT", `/api/drawings/${id}`, payload);
  return res.json();
}

export async function deleteDrawing(id: number): Promise<void> {
  await apiRequest("DELETE", `/api/drawings/${id}`, undefined);
}
