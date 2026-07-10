/**
 * Resilient AI Engine Client — Phase 4 (Cognitive Layer)
 *
 * Calls the Next.js Proxy gateway (NOT the Python backend directly).
 * Features:
 * - 3-second strict timeout for all AI inference calls
 * - Graceful fallback to `null` if the AI engine is offline or slow
 * - The UI components check for `null` and use hardcoded mock data when unavailable
 * - Phase 4 additions: RAG query and ingest for the Knowledge Base
 *
 * Architecture:
 *   Frontend → Next.js Proxy (RBAC + WORM) → Python FastAPI Microservice
 *                                       ↓ (timeout/error)
 *                                   Returns null → UI uses mock data
 */

const PROXY_URL = '/api/advanced-intelligence/proxy';

export interface AMLPrediction {
  request_id: string;
  node_scores: number[];
  cluster_risk: number;
  confidence: number;
  routing_model: string;
  pdpl_residency_verified: boolean;
  processing_time_ms: number;
}

export interface AMLExplanation {
  edge_id: string;
  attention_weight: number;
  temporal_factor: string;
  reason: string;
}

export interface RAGQueryResult {
  id: string;
  document: string;
  metadata: Record<string, string>;
  distance: number;
}

export interface RAGQueryResponse {
  query: string;
  results: RAGQueryResult[];
}

export interface RAGIngestResponse {
  status: string;
  id: string;
}

/**
 * Fetch AML risk prediction from the AI Inference Engine.
 * Returns null if the engine is offline or times out (3s), allowing
 * the UI to gracefully fall back to hardcoded mock data.
 */
export async function fetchAMLPrediction(
  requestData: {
    request_id?: string;
    num_nodes?: number;
    num_edges?: number;
  } = {}
): Promise<AMLPrediction | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s strict timeout

    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'predict',
        request_id: requestData.request_id || crypto.randomUUID(),
        num_nodes: requestData.num_nodes || 10,
        num_edges: requestData.num_edges || 20,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
    return await res.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('[AI Engine] Request timed out after 3s. Falling back to UI mock data.');
    } else {
      console.warn('[AI Engine] Microservice offline or error. Falling back to UI mock data.');
    }
    return null; // Returning null tells the UI to use its hardcoded mock data
  }
}

/**
 * Fetch GATv2 attention explainability for specific graph edges.
 * Returns null if the explainability service is unavailable.
 */
export async function fetchAMLExplainability(
  nodeId: string,
  edgeIds: string[]
): Promise<{ explanations: AMLExplanation[] } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'explain',
        node_id: nodeId,
        edge_ids: edgeIds,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('Explainability endpoint failed');
    return await res.json();
  } catch (error) {
    console.warn('[AI Engine] Explainability service unavailable.');
    return null;
  }
}

/**
 * Query the RAG Knowledge Base for semantically similar regulatory
 * documents, case notes, or AML typologies.
 * Returns null if the RAG engine is unavailable.
 */
export async function fetchRAGQuery(
  query: string,
  nResults: number = 3
): Promise<RAGQueryResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'query',
        query,
        n_results: nResults,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('RAG query endpoint failed');
    return await res.json();
  } catch (error) {
    console.warn('[AI Engine] RAG Knowledge Base unavailable.');
    return null;
  }
}

/**
 * Ingest a new document (case note, regulatory snippet, typology)
 * into the RAG Knowledge Base.
 * Returns null if the ingest service is unavailable.
 */
export async function fetchRAGIngest(
  docId: string,
  text: string,
  metadata: Record<string, string>
): Promise<RAGIngestResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'learn',
        doc_id: docId,
        text,
        metadata,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('RAG ingest endpoint failed');
    return await res.json();
  } catch (error) {
    console.warn('[AI Engine] RAG ingest service unavailable.');
    return null;
  }
}
