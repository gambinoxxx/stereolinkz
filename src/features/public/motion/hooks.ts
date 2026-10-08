"use client";

// Shared motion hooks for the landing page (ui-context.md → Public Site
// Motion). No animation library: requestAnimationFrame loops that only run
// while their element is on screen and the tab is visible, passive
// listeners, and a reduced-motion switch that turns every loop off.
import {
  type RefObject,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export const EASE = "cubic-bezier(.2,.8,.2,1)";

export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));

function mediaStore(query: string) {
  return {
    subscribe(onChange: () => void) {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    get: () => window.matchMedia(query).matches,
  };
}

const reduced = mediaStore("(prefers-reduced-motion: reduce)");
const finePointer = mediaStore("(pointer: fine)");

// False on the server and in the first client render (so hydration
// matches), then the real preference. CSS already shows the still version
// before this runs, so nothing moves in between.
export function useReducedMotion(): boolean {
  return useSyncExternalStore(reduced.subscribe, reduced.get, () => false);
}

export function useFinePointer(): boolean {
  return useSyncExternalStore(
    finePointer.subscribe,
    finePointer.get,
    () => false,
  );
}

function visibleStore() {
  return {
    subscribe(onChange: () => void) {
      document.addEventListener("visibilitychange", onChange);
      return () => document.removeEventListener("visibilitychange", onChange);
    },
    get: () => document.visibilityState === "visible",
  };
}
const pageVisible = visibleStore();

export function usePageVisible(): boolean {
  return useSyncExternalStore(
    pageVisible.subscribe,
    pageVisible.get,
    () => true,
  );
}

// True while the element is on screen (or, with once, from the first time
// it is).
export function useInView(
  ref: RefObject<Element | null>,
  { threshold = 0, once = false, rootMargin = "0px" } = {},
): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) setInView(false);
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, once, rootMargin]);
  return inView;
}

// True once the page has loaded and the browser is idle (or after 2 s):
// continuous loops wait for it, so they never compete with hydration.
let settled = false;
const settledListeners = new Set<() => void>();
function settle() {
  settled = true;
  settledListeners.forEach((l) => l());
}
const settledStore = {
  subscribe(onChange: () => void) {
    settledListeners.add(onChange);
    if (settledListeners.size === 1 && !settled) {
      const idle = () =>
        "requestIdleCallback" in window
          ? window.requestIdleCallback(settle, { timeout: 2000 })
          : setTimeout(settle, 300); // Safari has no requestIdleCallback
      if (document.readyState === "complete") idle();
      else window.addEventListener("load", idle, { once: true });
    }
    return () => settledListeners.delete(onChange);
  },
  get: () => settled,
};

export function usePageSettled(): boolean {
  return useSyncExternalStore(
    settledStore.subscribe,
    settledStore.get,
    () => false,
  );
}

// Runs callback(now) every frame while active, once the page has settled.
// The latest callback is used without restarting the loop.
export function useFrame(callback: (now: number) => void, active: boolean) {
  const cb = useRef(callback);
  useEffect(() => {
    cb.current = callback;
  });
  const visible = usePageVisible();
  const ready = usePageSettled();
  useEffect(() => {
    if (!active || !visible || !ready) return;
    let id = requestAnimationFrame(function tick(now) {
      cb.current(now);
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [active, visible, ready]);
}

// How far the page has scrolled through an element: 0 when its top meets
// the top of the viewport, 1 when its bottom meets the bottom. Read inside
// a frame callback.
export function scrollProgress(el: Element): number {
  const r = el.getBoundingClientRect();
  const total = r.height - window.innerHeight;
  return total > 0 ? clamp(-r.top / total, 0, 1) : r.top < 0 ? 1 : 0;
}

// Calls onProgress with the element's scroll progress, once per frame at
// most, while it is on screen. Passive listener.
export function useScrollProgress(
  ref: RefObject<Element | null>,
  onProgress: (p: number) => void,
  active = true,
) {
  const cb = useRef(onProgress);
  useEffect(() => {
    cb.current = onProgress;
  });
  const inView = useInView(ref);
  useEffect(() => {
    const el = ref.current;
    if (!el || !inView || !active) return;
    let queued = 0;
    const run = () => {
      queued = 0;
      cb.current(scrollProgress(el));
    };
    const onScroll = () => {
      if (!queued) queued = requestAnimationFrame(run);
    };
    run();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(queued);
    };
  }, [ref, inView, active]);
}

// The pointer as -0.5…0.5 across the window, from one shared passive
// listener. A ref, not state: read it in a frame callback and ease toward
// it there, so moving the mouse never re-renders.
const pointer = { x: 0, y: 0 };
let pointerUsers = 0;
function onPointer(e: PointerEvent) {
  pointer.x = e.clientX / window.innerWidth - 0.5;
  pointer.y = e.clientY / window.innerHeight - 0.5;
}

export function usePointer(
  active: boolean,
): Readonly<{ x: number; y: number }> {
  useEffect(() => {
    if (!active) return;
    if (pointerUsers++ === 0)
      window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      if (--pointerUsers === 0) {
        window.removeEventListener("pointermove", onPointer);
        pointer.x = 0;
        pointer.y = 0;
      }
    };
  }, [active]);
  return pointer;
}
