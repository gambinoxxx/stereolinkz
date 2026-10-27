"use client";

import {
  BellOff,
  BellRing,
  Loader2,
  Share,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  removeDevice,
  removeThisDevice,
  saveSubscription,
  sendTestNotification,
  setPreference,
} from "@/features/notifications/actions";
import {
  EVENT_SWITCHES,
  type TeamEvent,
} from "@/features/notifications/events";
import type { MyDevice } from "@/features/notifications/queries";
import { Section } from "@/features/settings/components/settings-parts";
import { SettingsTabs } from "@/features/settings/components/SettingsTabs";

// This browser, as far as notifications go.
type DeviceState =
  | { kind: "checking" }
  | { kind: "not-ready" } // no VAPID keys on the server
  | { kind: "ios-install" } // iPhone / iPad, not opened from the Home Screen
  | { kind: "unsupported" }
  | { kind: "denied"; platform: Platform }
  | { kind: "off" }
  | { kind: "on"; endpoint: string };

type Platform = "ios" | "android" | "desktop";

function platformOf(): Platform {
  const ua = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios ? "ios" : /Android/.test(ua) ? "android" : "desktop";
}

function standalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function hashOf(endpoint: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(endpoint),
  );
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

async function detect(
  serverReady: boolean,
  devices: MyDevice[],
): Promise<DeviceState> {
  const platform = platformOf();
  if (platform === "ios" && !standalone()) return { kind: "ios-install" };
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    return { kind: "unsupported" };
  if (!serverReady) return { kind: "not-ready" };
  if (Notification.permission === "denied") return { kind: "denied", platform };
  if (Notification.permission !== "granted") return { kind: "off" };
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return { kind: "off" };
  const hash = await hashOf(sub.endpoint);
  return devices.some((d) => d.endpointHash === hash)
    ? { kind: "on", endpoint: sub.endpoint }
    : { kind: "off" };
}

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

const DENIED_STEPS: Record<Platform, string[]> = {
  ios: [
    "Open the iPhone’s Settings app.",
    "Tap Notifications, then Stereolinkz.",
    "Turn on Allow Notifications, then come back here.",
  ],
  android: [
    "Long-press the Stereolinkz icon (or the Chrome icon) and tap App info.",
    "Tap Notifications and turn them on.",
    "In Chrome, tap the icon left of the address, then Permissions → Notifications → Allow.",
    "Come back here and reload.",
  ],
  desktop: [
    "Click the icon left of the address bar (a padlock or sliders).",
    "Set Notifications to Allow.",
    "Reload this page.",
  ],
};

export function NotificationSettings({
  devices,
  preferences,
  serverReady,
  vapidKey,
}: {
  devices: MyDevice[];
  preferences: Record<TeamEvent, boolean>;
  serverReady: boolean;
  vapidKey: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<DeviceState>({ kind: "checking" });
  const [thisHash, setThisHash] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [prefs, setPrefs] = useState(preferences);

  useEffect(() => {
    let live = true;
    detect(serverReady, devices)
      .then(async (s) => {
        if (!live) return;
        setState(s);
        setThisHash(s.kind === "on" ? await hashOf(s.endpoint) : null);
      })
      .catch(() => live && setState({ kind: "unsupported" }));
    return () => {
      live = false;
    };
  }, [serverReady, devices]);

  // Must run straight from the tap: iOS only shows the prompt for a
  // user gesture, so the permission request is the first thing awaited.
  const turnOn = () =>
    start(async () => {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState({ kind: "denied", platform: platformOf() });
        return;
      }
      if (permission !== "granted" || !vapidKey) return;
      let sub: PushSubscription | null = null;
      try {
        const reg = await registration();
        sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyBytes(vapidKey),
          }));
      } catch {
        toast.error("This browser couldn’t turn notifications on. Try again.");
        return;
      }
      const r = await saveSubscription(sub.toJSON());
      if (!r.ok) {
        await sub.unsubscribe().catch(() => {});
        toast.error(r.error);
        return;
      }
      toast.success("Notifications are on for this device");
      setState({ kind: "on", endpoint: sub.endpoint });
      setThisHash(await hashOf(sub.endpoint));
      router.refresh();
    });

  const turnOff = () =>
    start(async () => {
      if (state.kind !== "on") return;
      const sub = await (
        await registration()
      ).pushManager
        .getSubscription()
        .catch(() => null);
      await sub?.unsubscribe().catch(() => {});
      await removeThisDevice(state.endpoint);
      toast.success("Notifications are off for this device");
      setState({ kind: "off" });
      setThisHash(null);
      router.refresh();
    });

  const test = () =>
    start(async () => {
      if (state.kind !== "on") return;
      const r = await sendTestNotification(state.endpoint);
      if (r.ok) toast.success("Test sent. It should arrive in a few seconds.");
      else toast.error(r.error);
    });

  return (
    <>
      <PageHeader
        title="Settings"
        description="Notifications: alerts on your own phone or computer, the moment a deal needs you."
      />
      <SettingsTabs current="notifications" />

      <Section
        title="This device"
        description="Each phone or computer is turned on separately. Only you get the alerts you choose below."
      >
        <ThisDevice
          state={state}
          busy={busy}
          onTurnOn={turnOn}
          onTurnOff={turnOff}
          onTest={test}
        />
      </Section>

      <Section
        title="Your devices"
        description="Everywhere you’ve turned notifications on. Remove one you no longer use."
      >
        {devices.length === 0 ? (
          <p className="text-[14px] text-text-secondary">
            No devices yet. Turn notifications on above, on each phone or
            computer you use.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-border-default px-3.5 py-3"
              >
                <Smartphone
                  aria-hidden="true"
                  className="size-5 shrink-0 text-text-muted"
                  strokeWidth={1.9}
                />
                <div className="min-w-0 flex-1">
                  <b className="flex flex-wrap items-center gap-2">
                    {d.label}
                    {d.endpointHash === thisHash && (
                      <Badge variant="brand">This device</Badge>
                    )}
                  </b>
                  <span className="block text-[13px] text-text-secondary">
                    Added {when(d.createdAt)} ·{" "}
                    {d.lastSuccessAt
                      ? `last alert ${when(d.lastSuccessAt)}`
                      : "no alerts yet"}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      const r = await removeDevice(d.id);
                      if (!r.ok) return void toast.error(r.error);
                      toast.success("Device removed");
                      if (d.endpointHash === thisHash) {
                        setState({ kind: "off" });
                        setThisHash(null);
                      }
                      router.refresh();
                    })
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Alerts"
        description="What you want to hear about, on all your devices. The team’s email alerts don’t change."
      >
        <ul className="flex flex-col divide-y divide-border-subtle">
          {EVENT_SWITCHES.filter((e) => e.shown).map((e) => (
            <li
              key={e.key}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <label htmlFor={`pref-${e.key}`} className="min-w-0">
                <b className="block text-[14.5px] font-semibold">{e.label}</b>
                <span className="text-[13px] text-text-secondary">
                  {e.hint}
                </span>
              </label>
              <Switch
                id={`pref-${e.key}`}
                checked={prefs[e.key]}
                disabled={busy}
                onCheckedChange={(on) => {
                  setPrefs((p) => ({ ...p, [e.key]: on }));
                  start(async () => {
                    const r = await setPreference({ event: e.key, on });
                    if (!r.ok) {
                      setPrefs((p) => ({ ...p, [e.key]: !on }));
                      toast.error(r.error);
                    }
                  });
                }}
              />
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-text-muted">
          Lock screens are public: alerts show the deal number, the service and
          the amount, never a customer’s name, number or account.
        </p>
      </Section>
    </>
  );
}

function ThisDevice({
  state,
  busy,
  onTurnOn,
  onTurnOff,
  onTest,
}: {
  state: DeviceState;
  busy: boolean;
  onTurnOn: () => void;
  onTurnOff: () => void;
  onTest: () => void;
}) {
  const spinner = busy && (
    <Loader2 aria-hidden="true" className="animate-spin" />
  );
  switch (state.kind) {
    case "checking":
      return (
        <p className="flex items-center gap-2 text-[14px] text-text-secondary">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Checking this device…
        </p>
      );
    case "not-ready":
      return (
        <Note icon={<ShieldAlert />}>
          Notifications aren’t set up on the server yet: the owner needs to add
          the VAPID keys in Vercel.
        </Note>
      );
    case "unsupported":
      return (
        <Note icon={<BellOff />}>
          This browser can’t show notifications. Use Chrome on Android or a
          computer, or on iPhone add Stereolinkz to your Home Screen.
        </Note>
      );
    case "ios-install":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-[14.5px]">
            On iPhone, notifications work only in the Stereolinkz app on your
            Home Screen (iOS 16.4 or later):
          </p>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[14.5px]">
            <li>Open stereolinkz.com in Safari.</li>
            <li>
              Tap Share{" "}
              <Share
                aria-label="(the Share icon)"
                className="inline size-4 align-[-2px]"
                strokeWidth={2}
              />
              , then Add to Home Screen.
            </li>
            <li>Open the app from its new icon and sign in.</li>
            <li>Come back here: Settings → Notifications.</li>
          </ol>
        </div>
      );
    case "denied":
      return (
        <div className="flex flex-col gap-3">
          <Note icon={<BellOff />} tone="bad">
            Notifications are blocked for this app. To allow them again:
          </Note>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[14.5px]">
            {DENIED_STEPS[state.platform].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      );
    case "off":
      return (
        <div className="flex flex-col items-start gap-3">
          <p className="text-[14.5px]">
            This device: <b>Off</b>. Turn it on to get an alert the moment a
            deal needs you.
          </p>
          <Button onClick={onTurnOn} disabled={busy}>
            {spinner || <BellRing strokeWidth={1.9} />}
            Turn on notifications on this device
          </Button>
        </div>
      );
    case "on":
      return (
        <div className="flex flex-col items-start gap-3">
          <p className="flex items-center gap-2 text-[14.5px]">
            This device: <Badge variant="success">On</Badge>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onTest} disabled={busy}>
              {spinner || <BellRing strokeWidth={1.9} />}
              Send a test notification
            </Button>
            <Button variant="outline" onClick={onTurnOff} disabled={busy}>
              Turn off on this device
            </Button>
          </div>
        </div>
      );
  }
}

function Note({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone?: "bad";
  children: React.ReactNode;
}) {
  return (
    <p
      className={
        tone === "bad"
          ? "flex items-start gap-2.5 rounded-control bg-state-error-soft px-3.5 py-3 text-[14px] text-state-error [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0"
          : "flex items-start gap-2.5 rounded-control bg-bg-subtle px-3.5 py-3 text-[14px] text-text-secondary [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0"
      }
    >
      {icon}
      <span>{children}</span>
    </p>
  );
}
