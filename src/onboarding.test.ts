import { describe, expect, it } from "vitest";
import {
  addCompletedStep,
  onboardingStepIndex,
  validCompletedSteps,
} from "./onboarding";

describe("onboarding progress", () => {
  it("maps product screens to the four-step quick start", () => {
    expect(onboardingStepIndex("diagnosis")).toBe(0);
    expect(onboardingStepIndex("import")).toBe(1);
    expect(onboardingStepIndex("assumptions")).toBe(2);
    expect(onboardingStepIndex("insights")).toBe(3);
    expect(onboardingStepIndex("export")).toBe(3);
  });

  it("records a completed step only once", () => {
    expect(addCompletedStep(["profile"], "profile")).toEqual(["profile"]);
    expect(addCompletedStep(["profile"], "data")).toEqual(["profile", "data"]);
  });

  it("sanitizes persisted progress", () => {
    expect(validCompletedSteps(["profile", "unknown", "profile", "results"])).toEqual([
      "profile",
      "results",
    ]);
    expect(validCompletedSteps("profile")).toEqual([]);
  });
});
