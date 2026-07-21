"use client";

import { useEffect } from "react";

/**
 * Registers this device for push notifications, but only when rendered
 * (i.e. inside the admin dashboard) and only when running as the native
 * Android app — a no-op on the regular website. This keeps "new offer"
 * pushes going to the admin's own device(s), not every buyer who has the
 * app installed.
 */
export default function PushNotificationSetup() {
  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const { PushNotifications } = await import("@capacitor/push-notifications");

      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== "granted") return;

      await PushNotifications.register();

      PushNotifications.addListener("registration", async (token) => {
        if (cancelled) return;
        try {
          await fetch("/api/push/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: token.value, platform: "android" }),
          });
        } catch {
          /* best-effort — a missed registration just means no push this session */
        }
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.error("Push registration error:", err);
      });
    }

    setup();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
