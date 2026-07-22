import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushStatus = "default" | "granted" | "denied" | "subscribed" | "unsupported";

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>("default");
  const token = getToken();

  const { data: vapidData } = useQuery<{ publicKey: string }>({
    queryKey: ["vapid-public-key"],
    queryFn: async () => {
      const r = await fetch("/api/notifications/vapid-key");
      if (!r.ok) throw new Error("VAPID not available");
      return r.json();
    },
    staleTime: Infinity,
    retry: 1,
  });

  // Auto-resubscribe: if the browser already granted permission and has an
  // active SW subscription, silently re-register it with the server so push
  // works even after the server loses the subscription (e.g. DB wipe or
  // redeploy). Runs once on mount when VAPID key is available.
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!vapidData?.publicKey) return;
    if (Notification.permission !== "granted") return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();

        // If no active subscription, create one silently
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey) as unknown as Uint8Array<ArrayBuffer>,
          });
        }

        if (!sub || !token) return;

        // Always re-POST subscription to server to recover from DB wipe / redeploy
        const subJson = sub.toJSON();
        await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth },
          }),
        }).catch(() => {});

        localStorage.setItem("investa_push_sub", "subscribed");
        setStatus("subscribed");
      } catch {
        // Silent — don't surface auto-resubscribe errors to the user
      }
    })();
  }, [vapidData?.publicKey, token]);

  // Initial status from browser permission + localStorage
  useEffect(() => {
    if (!("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    const pref = localStorage.getItem("investa_push_sub");
    if (pref === "subscribed" && Notification.permission === "granted") {
      setStatus("subscribed");
    } else {
      setStatus(Notification.permission as PushStatus);
    }
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return false;
    }
    if (!vapidData?.publicKey) return false;

    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setStatus("denied");
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey) as unknown as Uint8Array<ArrayBuffer>,
      });

      const sub = subscription.toJSON();
      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys?.p256dh, auth: sub.keys?.auth },
        }),
      });

      localStorage.setItem("investa_push_sub", "subscribed");
      setStatus("subscribed");
      return true;
    } catch {
      setStatus("denied");
      return false;
    }
  }, [vapidData, token]);

  const unsubscribe = useCallback(async () => {
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    const sub = await registration?.pushManager.getSubscription().catch(() => null);
    await sub?.unsubscribe().catch(() => {});
    await fetch("/api/notifications/subscribe", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    localStorage.removeItem("investa_push_sub");
    setStatus("default");
  }, [token]);

  return { status, subscribe, unsubscribe, vapidReady: !!vapidData?.publicKey };
}
