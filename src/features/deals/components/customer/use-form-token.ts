"use client";

import { useCallback, useEffect, useRef } from "react";

import { startDealForm } from "@/features/deals/public-actions";

// The signed form timestamp (bot check), fetched when the form opens: the
// forms are cached pages, so it can't be in their HTML. Returns a getter
// for submit, which waits for the first fetch and retries once if it failed.
export function useFormToken(): () => Promise<string> {
  const pending = useRef<Promise<string> | null>(null);
  const load = useCallback(() => {
    pending.current ??= startDealForm()
      .then((r) => (r.ok ? r.data.formToken : ""))
      .catch(() => "");
    return pending.current;
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return useCallback(async () => {
    const token = await load();
    if (token) return token;
    pending.current = null;
    return load();
  }, [load]);
}
