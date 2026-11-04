import {
  elapsedSeconds, finishTimer, formatElapsed, isPaused, parseTimer, pauseTimer, resumeTimer, runningSince, sideSeconds, startTimer,
  suggestedSide, switchSide,
} from "@/lib/baby/breastTimer";

jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));

const T0 = new Date("2026-10-10T08:00:00Z");
const after = (sec: number) => new Date(T0.getTime() + sec * 1000);

describe("timeri i gjidhënies", () => {
  it("numëron kohën dhe e shfaq si mm:ss / h:mm:ss", () => {
    const timer = startTimer("left", T0);
    expect(elapsedSeconds(timer, after(125))).toBe(125);
    expect(formatElapsed(125)).toBe("02:05");
    expect(formatElapsed(3725)).toBe("1:02:05");
    expect(elapsedSeconds(timer, after(-10))).toBe(0);
  });

  it("ndalimi krijon shënimin me kohën e nisjes dhe kohëzgjatjen në minuta", () => {
    const done = finishTimer(startTimer("right", T0), after(12 * 60 + 40));
    expect(done).toEqual({ at: T0.toISOString(), durationMin: 13, side: "right", leftMin: 0, rightMin: 13, endedOn: "right" });
  });

  it("seancë shumë e shkurtër: pa kohëzgjatje (jo 0 min); gjysmë minute = 1 min", () => {
    expect(finishTimer(startTimer("left", T0), after(10)).durationMin).toBeNull();
    expect(finishTimer(startTimer("left", T0), after(31)).durationMin).toBe(1);
  });

  it("ndërrimi i gjirit mat kohën e secilit dhe ruhet si 'të dyja'", () => {
    let timer = startTimer("left", T0);
    timer = switchSide(timer, "right", after(480));
    expect(timer.side).toBe("right");
    expect(sideSeconds(timer, after(840))).toEqual({ left: 480, right: 360 });
    const done = finishTimer(timer, after(840));
    expect(done).toMatchObject({ side: "both", durationMin: 14, leftMin: 8, rightMin: 6, endedOn: "right" });
    // kthimi te i njëjti gji s'e dyfishon
    expect(switchSide(startTimer("left", T0), "left", after(5)).sides).toEqual(["left"]);
  });

  it("një prekje e gabuar te gjiri tjetër në fund s'e bën 'të dyja'", () => {
    const timer = switchSide(startTimer("left", T0), "right", after(600));
    expect(finishTimer(timer, after(610)).side).toBe("left");
  });

  it("pauza ndalon orën; vazhdimi e rinis; kohëzgjatja s'i përfshin pauzat", () => {
    let timer = startTimer("left", T0);
    timer = pauseTimer(timer, after(300));
    expect(isPaused(timer)).toBe(true);
    expect(elapsedSeconds(timer, after(900))).toBe(300);
    expect(runningSince(timer, after(900))).toBeNull();
    timer = resumeTimer(timer, after(900));
    expect(elapsedSeconds(timer, after(1200))).toBe(600);
    // ora pa ndalim e widget-it nis aq më vonë sa zgjati pauza
    expect(runningSince(timer, after(1200))).toBe(after(600).toISOString());
    expect(finishTimer(timer, after(1200)).durationMin).toBe(10);
    // prekja e një gjiri gjatë pauzës vazhdon te ai gji
    const resumed = switchSide(pauseTimer(startTimer("left", T0), after(60)), "right", after(120));
    expect(isPaused(resumed)).toBe(false);
    expect(sideSeconds(resumed, after(180))).toEqual({ left: 60, right: 60 });
  });

  it("timeri pa pauza e jep widget-it vetë çastin e nisjes", () => {
    expect(runningSince(startTimer("left", T0), after(100))).toBe(T0.toISOString());
    expect(runningSince({ startedAt: "2026-10-10T08:00:00Z", side: "left", sides: ["left"] }, after(100))).toBe("2026-10-10T08:00:00Z");
  });

  it("timeri i ruajtur lexohet; i prishur, i harruar (>6 orë) ose në të ardhmen hidhet", () => {
    const ok = JSON.stringify(startTimer("left", T0));
    expect(parseTimer(ok, after(60))?.side).toBe("left");
    expect(parseTimer(ok, after(7 * 3600))).toBeNull();
    expect(parseTimer(JSON.stringify(startTimer("left", after(3600))), T0)).toBeNull();
    expect(parseTimer("{prishur", T0)).toBeNull();
    expect(parseTimer(JSON.stringify({ startedAt: T0.toISOString(), side: "lart" }), T0)).toBeNull();
    expect(parseTimer(null, T0)).toBeNull();
  });

  it("pauza dhe segmentet mbijetojnë ruajtjen; timeri i vjetër (pa to) numëron si më parë", () => {
    const paused = pauseTimer(switchSide(startTimer("left", T0), "right", after(120)), after(180));
    const back = parseTimer(JSON.stringify(paused), after(600));
    expect(back && isPaused(back)).toBe(true);
    expect(back && sideSeconds(back, after(600))).toEqual({ left: 120, right: 60 });
    const legacy = parseTimer(JSON.stringify({ startedAt: T0.toISOString(), side: "right", sides: ["right"] }), after(60));
    expect(legacy && elapsedSeconds(legacy, after(90))).toBe(90);
    expect(legacy && sideSeconds(legacy, after(90))).toEqual({ left: 0, right: 90 });
  });

  it("gjiri i sugjeruar: pas njërit, tjetri; pas të dyve, ai ku mbaroi", () => {
    expect(suggestedSide("left")).toBe("right");
    expect(suggestedSide("right")).toBe("left");
    expect(suggestedSide(null)).toBe("left");
    expect(suggestedSide("both")).toBe("left");
    expect(suggestedSide("both", "right")).toBe("right");
    expect(suggestedSide("left", "left")).toBe("right");
  });
});
