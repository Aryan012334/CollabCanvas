import { createAiProvider, MockAiProvider } from "../provider";
import { PullRequestReviewSchema } from "../schemas";

describe("AI provider selection", () => {
  it("returns explicitly labelled mock output", async () => {
    const provider = new MockAiProvider();
    const result = await provider.complete(
      "pull-request-review",
      {},
      PullRequestReviewSchema,
    );

    expect(provider.mode).toBe("mock");
    expect(result.data.summary).toContain("MOCK MODE");
  });

  it("does not fall back when OpenAI configuration is incomplete", () => {
    expect(() => createAiProvider({ AI_PROVIDER: "openai" })).toThrow(
      "OPENAI_API_KEY is required",
    );
  });

  it("rejects unsupported provider names", () => {
    expect(() => createAiProvider({ AI_PROVIDER: "unknown" })).toThrow(
      "Unsupported AI_PROVIDER",
    );
  });
});
