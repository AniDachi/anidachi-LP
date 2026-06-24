#!/usr/bin/env python3
"""Bulk SEO page CTA cleanup."""

import re
from pathlib import Path

WEB_APP = Path(__file__).resolve().parent.parent / "apps/web/app"

LISTICLE_GUIDES = [
    "guides/best-anime-movies-to-watch-with-friends/page.tsx",
    "guides/best-anime-to-watch-with-friends/page.tsx",
    "guides/best-anime-to-watch-on-crunchyroll-with-friends/page.tsx",
    "guides/best-anime-to-binge-with-friends-this-weekend/page.tsx",
    "guides/best-short-anime-to-watch-with-friends/page.tsx",
    "guides/best-shonen-anime-to-watch-with-friends/page.tsx",
    "guides/best-romance-anime-to-watch-with-friends/page.tsx",
    "guides/best-classic-anime-to-watch-with-friends/page.tsx",
    "guides/best-slice-of-life-anime-to-watch-with-friends/page.tsx",
    "guides/best-horror-anime-to-watch-with-friends/page.tsx",
    "guides/best-psychological-anime-to-watch-with-friends/page.tsx",
]

CTA_BLOCK = re.compile(
    r"\n\s*<PrimaryCheckoutCta[\s\S]*?/>\s*",
    re.MULTILINE,
)

IMPORT_CTA = re.compile(
    r'^import \{ PrimaryCheckoutCta \} from "@/components/primary-checkout-cta";\n',
    re.MULTILINE,
)

ABOVE_FOLD_LINE = re.compile(r"^\s*aboveFoldCta\s*\n", re.MULTILINE)


def strip_extra_ctas(content: str) -> str:
    matches = list(CTA_BLOCK.finditer(content))
    if len(matches) <= 1:
        return content
    # Remove all but the first mid-page CTA
    for match in reversed(matches[1:]):
        content = content[: match.start()] + content[match.end() :]
    return content


def remove_all_ctas(content: str) -> str:
    content = CTA_BLOCK.sub("\n", content)
    content = IMPORT_CTA.sub("", content)
    return content


def remove_above_fold(content: str) -> str:
    return ABOVE_FOLD_LINE.sub("", content)


def process_file(rel: str, *, keep_one_mid_cta: bool = False) -> bool:
    path = WEB_APP / rel
    if not path.exists():
        print(f"skip missing {rel}")
        return False
    original = path.read_text()
    updated = original
    if keep_one_mid_cta:
        updated = strip_extra_ctas(updated)
    else:
        updated = remove_all_ctas(updated)
    updated = remove_above_fold(updated)
    if updated != original:
        path.write_text(updated)
        print(f"updated {rel}")
        return True
    return False


def main() -> None:
    changed = 0
    for rel in LISTICLE_GUIDES:
        if process_file(rel, keep_one_mid_cta=True):
            changed += 1

    for path in sorted(WEB_APP.glob("guides/**/page.tsx")):
        rel = str(path.relative_to(WEB_APP))
        if rel in LISTICLE_GUIDES:
            continue
        if process_file(rel, keep_one_mid_cta=False):
            changed += 1

    for path in sorted(WEB_APP.glob("compare/**/page.tsx")):
        rel = str(path.relative_to(WEB_APP))
        if process_file(rel, keep_one_mid_cta=False):
            changed += 1

    for path in sorted(WEB_APP.glob("glossary/**/page.tsx")):
        rel = str(path.relative_to(WEB_APP))
        if process_file(rel, keep_one_mid_cta=False):
            changed += 1

    print(f"done, {changed} files changed")


if __name__ == "__main__":
    main()
