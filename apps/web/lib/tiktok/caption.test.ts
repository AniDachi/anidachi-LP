import test from "node:test";
import assert from "node:assert/strict";
import { adaptCaptionForTikTok } from "@/lib/tiktok/caption";

test("preserves multiline body and appends TikTok hashtags", () => {
  const input = [
    "pov: I quit smoking 30 days ago",
    "",
    "I stopped waking up with chest pain and my runs feel easier now.",
    "I have been logging cravings daily and it actually helps.",
    "",
    "#quitsmoking #smokefree #healthtransformation #beforeandafter #blou",
  ].join("\n");

  const { title, description } = adaptCaptionForTikTok(input);

  assert.equal(title, "pov: I quit smoking 30 days ago");
  assert.match(description, /I stopped waking up with chest pain/);
  assert.match(
    description,
    /#quitsmoking #smokefree #transformation #fyp #quittok$/,
  );
});

test("strips unicode hashtags from title and keeps body readable", () => {
  const input = [
    "#Bloü made this easier than I expected",
    "",
    "I used to smoke after every coffee and now I don't.",
    "This is the longest streak I have had in years.",
    "",
    "#quitsmoking #smokefree #healthtransformation #beforeandafter #Bloü",
  ].join("\n");

  const { title, description } = adaptCaptionForTikTok(input);

  assert.equal(title, "made this easier than I expected");
  assert.match(description, /longest streak/);
  assert.doesNotMatch(title, /#Blo/);
});

test("falls back to original body when transform collapses output", () => {
  const input = [
    "short hook",
    "",
    "#one #two #three #four #five #six #seven #eight #nine #ten",
    "This line should survive fallback with enough context and details.",
  ].join("\n");

  const { description } = adaptCaptionForTikTok(input);

  assert.match(description, /This line should survive fallback/);
});
