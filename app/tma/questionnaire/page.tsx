"use client";

import { QuestionnaireForm } from "../../questionnaire/page";
import { TmaShell, useTma } from "../tma-shell";

function Content() {
  const { haptic } = useTma();
  return <QuestionnaireForm onAction={() => haptic()} onComplete={() => haptic("success")} />;
}

export default function TmaQuestionnairePage() {
  return <TmaShell title="The questionnaire"><Content /></TmaShell>;
}
