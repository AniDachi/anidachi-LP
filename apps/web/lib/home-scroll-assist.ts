export type SectionBounds = { top: number; height: number };

/** A small nudge in the user's direction, never a jump back into a long section. */
export function getHomeScrollNudge(
  sections: SectionBounds[],
  viewportHeight: number,
  headerHeight: number,
  direction: 1 | -1,
): number | null {
  const available = viewportHeight - headerHeight;
  const reach = Math.min(140, available * 0.2);
  const candidates = sections.map(section => ({
    delta: section.top - headerHeight,
    tall: section.height > available + 2,
  })).filter(({ delta, tall }) => {
    if (Math.abs(delta) < 4 || Math.abs(delta) > reach) return false;
    if (direction === 1) return delta > 0;
    return !tall && delta < 0;
  });
  candidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
  return candidates[0]?.delta ?? null;
}
