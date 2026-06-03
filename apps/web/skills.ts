/**
 * Skills for motion graphics prompt classification and skill-specific system prompt guidance.
 */

export const SKILL_NAMES = [
  "typography",
  "data-viz",
  "ui",
  "logo",
  "social",
  "explainer",
  "kinetic-typography",
  "abstract",
  "illustration",
  "product",
  "countdown",
  "loading",
] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

export const SKILL_DETECTION_PROMPT = `You are a classifier for motion graphics prompts.
Given a user prompt, identify which of these skill categories apply: ${SKILL_NAMES.join(", ")}.
Return an array of applicable skill names. Use lowercase and exact names from the list.`;

const SKILL_CONTENT: Record<SkillName, string> = {
  typography: "Focus on clear, readable text with strong hierarchy and legible fonts.",
  "data-viz":
    "Emphasize charts, graphs, or progress indicators with clear data representation.",
  ui: "Prioritize UI patterns: buttons, cards, modals, and smooth transitions.",
  logo: "Create logo or brand mark animations with professional timing.",
  social: "Optimize for vertical/square formats and short, punchy hooks.",
  explainer: "Use narrative structure with clear key messages and pacing.",
  "kinetic-typography":
    "Animate text as the primary visual; sync motion to meaning.",
  abstract: "Use shapes, color, and motion without literal imagery.",
  illustration: "Support illustrated or character-driven motion.",
  product: "Showcase product with clear framing and emphasis.",
  countdown: "Use numeric or visual countdown with clear final state.",
  loading: "Keep minimal and loop-friendly; avoid heavy layout.",
};

export function getCombinedSkillContent(skills: SkillName[]): string {
  if (skills.length === 0) return "";
  return skills
    .map((s) => `- **${s}**: ${SKILL_CONTENT[s]}`)
    .join("\n");
}
