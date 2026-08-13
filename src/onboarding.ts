export type OnboardingStepId = "profile" | "data" | "assumptions" | "results";
export type DataOrigin = "sample" | "imported";

export type OnboardingScreen =
  | "diagnosis"
  | "setup"
  | "import"
  | "historical"
  | "assumptions"
  | "scenarios"
  | "statements"
  | "insights"
  | "gap"
  | "india"
  | "export";

export interface OnboardingStep {
  id: OnboardingStepId;
  screen: OnboardingScreen;
  title: string;
  description: string;
}

export const onboardingSteps: readonly OnboardingStep[] = [
  {
    id: "profile",
    screen: "setup",
    title: "会社情報",
    description: "会社名・年度・部門を確認",
  },
  {
    id: "data",
    screen: "import",
    title: "財務データ",
    description: "Excel取込、またはサンプルで試す",
  },
  {
    id: "assumptions",
    screen: "assumptions",
    title: "将来の前提",
    description: "成長率・投資・資金条件を承認",
  },
  {
    id: "results",
    screen: "insights",
    title: "診断結果",
    description: "リスクと改善ポイントを確認",
  },
] as const;

const screenStepIndex: Record<OnboardingScreen, number> = {
  diagnosis: 0,
  setup: 0,
  import: 1,
  historical: 1,
  assumptions: 2,
  scenarios: 3,
  statements: 3,
  insights: 3,
  gap: 3,
  india: 3,
  export: 3,
};

export function onboardingStepIndex(screen: OnboardingScreen): number {
  return screenStepIndex[screen];
}

export function addCompletedStep(
  completed: readonly OnboardingStepId[],
  step: OnboardingStepId,
): OnboardingStepId[] {
  return completed.includes(step) ? [...completed] : [...completed, step];
}

export function validCompletedSteps(value: unknown): OnboardingStepId[] {
  if (!Array.isArray(value)) return [];
  const validIds = new Set(onboardingSteps.map((step) => step.id));
  return value.filter(
    (item, index): item is OnboardingStepId =>
      typeof item === "string" && validIds.has(item as OnboardingStepId) && value.indexOf(item) === index,
  );
}
