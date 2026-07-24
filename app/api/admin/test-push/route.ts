import { NextResponse } from "next/server";
import { sendPushToAllDevices } from "@/lib/push";

export async function POST() {
  const result = await sendPushToAllDevices(
    "YBC — Test notification",
    "ဒါက စမ်းသပ်ချက် message ဖြစ်ပါသည်။ ရောက်ရင် အားလုံး အဆင်ပြေပါပြီ။",
    { type: "test" }
  );
  return NextResponse.json({ ok: true, push: result });
}
