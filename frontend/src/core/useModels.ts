/**
 * frontend/src/core/useModels.ts
 *
 * Shared hook — fetches the model menu from the backend (single source of truth).
 * NcertChat and PersonalChat both use this. No model names are hardcoded here.
 *
 * To add/remove/rename a model in the UI:
 *   → Edit FRONTEND_MODEL_MENU in src/config.py (backend)
 *   → Done. No frontend code changes needed.
 */

import { useState, useEffect } from 'react';

export interface ModelOption {
  id: string;
  label: string;
  sub: string;
}

export interface ModelGroup {
  group: string;
  options: ModelOption[];
}

interface ModelsResponse {
  default: string;
  groups: ModelGroup[];
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Module-level cache so the fetch happens once per page load, not once per component mount.
let _cache: ModelsResponse | null = null;
let _promise: Promise<ModelsResponse> | null = null;

async function fetchModels(): Promise<ModelsResponse> {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = fetch(`${API_BASE}/models`)
      .then((r) => r.json())
      .then((data: ModelsResponse) => {
        _cache = data;
        return data;
      });
  }
  return _promise;
}

const FALLBACK: ModelsResponse = {
  default: 'gemini-3.6-flash',
  groups: [
    {
      group: 'Google (Gemini)',
      options: [
        { id: 'gemini-3.6-flash',       label: 'Gemini 3.6 Flash', sub: 'Stable · recommended' },
        { id: 'gemini-3.7-flash',       label: 'Gemini 3.7 Flash', sub: 'Latest · currently busy' },
        { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro',   sub: 'Smartest · complex reasoning' },
        { id: 'gemini-3.5-flash-lite',  label: 'Gemini 3.5 Lite',  sub: 'Fastest · ultra lightweight' },
      ],
    },
    {
      group: 'Groq (Fast Inference)',
      options: [
        { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', sub: 'Heavy · Groq inference' },
        { id: 'openai/gpt-oss-20b',  label: 'GPT-OSS 20B',  sub: 'Fast · Groq inference' },
        { id: 'qwen/qwen3.6-27b',    label: 'Qwen 3.6 27B', sub: 'Reasoning · Groq inference' },
      ],
    },
  ],
};

export function useModels() {
  const [data, setData] = useState<ModelsResponse>(_cache ?? FALLBACK);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) return; // already loaded
    setLoading(true);
    fetchModels()
      .then(setData)
      .catch(() => setData(FALLBACK)) // offline / backend down — use fallback
      .finally(() => setLoading(false));
  }, []);

  const allOptions = data.groups.flatMap((g) => g.options);

  return {
    groups: data.groups,
    allOptions,
    defaultModelId: data.default,
    loading,
  };
}
