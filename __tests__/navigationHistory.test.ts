import { currentPath, decideBack, hardwareBackTarget, previousPath, recordPath, resetHistory, rewindTo } from "@/lib/navigation/history";

describe("kthimi nga njoftimet", () => {
  it("njoftim -> ekran tjetër -> mbrapa -> mbrapa kthehet te kreu, jo në rreth", () => {
    resetHistory(["/baby", "/notifications", "/baby/vaccinations"]);

    // mbrapa nga vaksinat: kthim i shprehur te njoftimet
    const first = decideBack(previousPath(), currentPath());
    expect(first).toEqual({ kind: "goto", path: "/notifications" });
    if (first.kind === "goto") rewindTo(first.path);
    recordPath("/notifications"); // rrënja e regjistron rrugën e re

    // mbrapa nga njoftimet: te kreu (para ndreqjes dilte përsëri te vaksinat)
    expect(previousPath()).toBe("/baby");
    expect(decideBack(previousPath(), currentPath())).toEqual({ kind: "goto", path: "/baby" });
  });

  it("rewindTo pa rrugën në histori nuk ndryshon asgjë", () => {
    resetHistory(["/baby", "/shop"]);
    rewindTo("/nuk-ekziston");
    expect(currentPath()).toBe("/shop");
    expect(previousPath()).toBe("/baby");
  });
});

describe("butoni fizik mbrapa (Android)", () => {
  it("nga një pjesë tjetër kthehet aty ku ishte përdoruesi", () => {
    expect(hardwareBackTarget("/more", "/shop/orders")).toBe("/more");
    expect(hardwareBackTarget("/baby", "/notifications")).toBe("/baby");
  });

  it("brenda së njëjtës pjesë lë sjelljen native (pop me animacion)", () => {
    expect(hardwareBackTarget("/shop/cart", "/shop/checkout")).toBeNull();
    expect(hardwareBackTarget(null, "/baby/vaccinations")).toBeNull();
  });

  it("te rrënjët e tab-eve dhe ekranet jashtë (main) s'ndërhyn", () => {
    expect(hardwareBackTarget("/baby", "/more")).toBeNull();
    expect(hardwareBackTarget("/more", "/ai-chat")).toBeNull();
    expect(hardwareBackTarget("/baby", "/log/feeding")).toBeNull();
    expect(hardwareBackTarget("/baby", "/sleep")).toBeNull();
  });
});
