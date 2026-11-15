import { act } from "react-test-renderer";
import { renderScreen, router } from "./helpers/screen";
import { AskAiButton } from "@/components/baby/AskAiButton";

/** AI-ja doli nga shiriti poshtë: te faqja kryesore e hap butoni i bisedës. */
describe("butoni i bisedës me AI-në", () => {
  it("ka emër për lexuesin e ekranit dhe hap bisedën", async () => {
    const r = await renderScreen(<AskAiButton />);
    const btn = r.root.findAll((n) => n.props.accessibilityLabel === "Bisedo me asistentin AI" && typeof n.props.onPress === "function")[0];
    expect(btn.props.accessibilityRole).toBe("button");
    await act(async () => btn.props.onPress());
    expect(router().push).toHaveBeenCalledWith("/(main)/ai-chat");
  });
});
