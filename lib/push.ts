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

async function getAccessToken(sa: { client_email: string; private_key: string }) {
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

export type PushResult = {
  configured: boolean;
  targeted: number;
  sent: number;
  failed: number;
  errors: string[];
};

/**
 * Sends a push notification to every registered device (buyers who have
 * the Android app installed). Returns a diagnostic summary instead of
 * failing silently, so the admin dashboard can actually show what
 * happened rather than just hoping it worked.
 */
export async function sendPushToAllDevices(
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<PushResult> {
  const sa = loadServiceAccount();
  if (!sa) {
    return {
      configured: false,
      targeted: 0,
      sent: 0,
      failed: 0,
      errors: ["FIREBASE_SERVICE_ACCOUNT_JSON is not set on the server."],
    };
  }

  const { data: tokenRows, error: tokenError } = await supabaseAdmin
    .from("push_tokens")
    .select("token");

  if (tokenError) {
    return {
      configured: true,
      targeted: 0,
      sent: 0,
      failed: 0,
      errors: [`Could not read push_tokens: ${tokenError.message}`],
    };
  }

  if (!tokenRows || tokenRows.length === 0) {
    return {
      configured: true,
      targeted: 0,
      sent: 0,
      failed: 0,
      errors: [
        "No devices are registered yet — no buyer has opened the app and granted notification permission.",
      ],
    };
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (err: any) {
    return {
      configured: true,
      targeted: tokenRows.length,
      sent: 0,
      failed: tokenRows.length,
      errors: [`Firebase auth failed: ${err?.message ?? String(err)}`],
    };
  }

  let sent = 0;
  const errors: string[] = [];

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

        if (res.ok) {
          sent++;
        } else {
          const errText = await res.text();
          errors.push(errText.slice(0, 200));
          // Token is stale/uninstalled — stop trying to notify it.
          if (res.status === 404 || errText.includes("UNREGISTERED")) {
            await supabaseAdmin.from("push_tokens").delete().eq("token", token);
          }
        }
      } catch (err: any) {
        errors.push(err?.message ?? String(err));
      }
    })
  );

  return {
    configured: true,
    targeted: tokenRows.length,
    sent,
    failed: tokenRows.length - sent,
    errors: errors.slice(0, 5), // cap so one bad batch doesn't flood a response
  };
}
