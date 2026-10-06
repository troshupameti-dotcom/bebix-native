import { currentPath, decideBack, previousPath, recordPath, resetHistory, rewindTo } from "@/lib/navigation/history";

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
