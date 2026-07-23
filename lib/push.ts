import { SignJWT, importPKCS8 } from "jose";
import { supabaseAdmin } from "./supabase/server";

function loadServiceAccount(): {
  client_email: string;
  private_key: string;
  project_id: string;
} | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    } catch {
      return null;
    }
  }
}

async function getAccessToken(sa: {
  client_email: string;
  private_key: string;
}) {
  const privateKey = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`FCM auth failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

/**
 * Sends a push notification to every registered device (buyers who have
 * the Android app installed). Silently no-ops if Firebase isn't
 * configured, so local dev / early deploys without push set up don't
 * break anything that triggers it.
 */
export async function sendPushToAllDevices(
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  const sa = loadServiceAccount();
  if (!sa) {
    console.warn(
      "Push not configured (FIREBASE_SERVICE_ACCOUNT_JSON missing) — skipping."
    );
    return;
  }

  const { data: tokenRows } = await supabaseAdmin.from("push_tokens").select("token");
  if (!tokenRows || tokenRows.length === 0) return;

  const accessToken = await getAccessToken(sa);

  await Promise.all(
    tokenRows.map(async ({ token }) => {
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
                data,
                android: { priority: "high" },
              },
            }),
          }
        );

        if (!res.ok) {
          const errText = await res.text();
          console.error("FCM send failed:", errText);
          // Token is stale/uninstalled — stop trying to notify it.
          if (res.status === 404 || errText.includes("UNREGISTERED")) {
            await supabaseAdmin.from("push_tokens").delete().eq("token", token);
          }
        }
      } catch (err) {
        console.error("FCM send error:", err);
      }
    })
  );
}
