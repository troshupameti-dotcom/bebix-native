/**
 * Sentry REACT-NATIVE-1: "cannot add postgres_changes callbacks ... after subscribe()". Klienti i vërtetë i
 * Realtime-it kthen kanalin ekzistues për të njëjtin emër; një emër i ri për çdo abonim e shmang.
 */
import { RealtimeClient } from "@supabase/realtime-js";
import { realtimeTopic } from "@/lib/supabase/realtimeTopic";

describe("emri i kanalit Realtime", () => {
  // Transport i rremë: testi s'lidhet kurrë, vetëm krijon kanale.
  const client = () =>
    new RealtimeClient("ws://localhost:1/realtime/v1", { params: { apikey: "test" }, transport: class {} as never });

  it("shkaku: i njëjti emër kthen të njëjtin kanal (i vjetri, ende pa u hequr)", () => {
    const c = client();
    expect(c.channel("baby_records:u1")).toBe(c.channel("baby_records:u1"));
  });

  it("çdo abonim merr kanalin e vet, edhe për të njëjtin pronar", () => {
    const c = client();
    const a = realtimeTopic("baby_records:u1");
    const b = realtimeTopic("baby_records:u1");
    expect(a).not.toBe(b);
    expect(a.startsWith("baby_records:u1:")).toBe(true);
    expect(c.channel(a)).not.toBe(c.channel(b));
  });
});
