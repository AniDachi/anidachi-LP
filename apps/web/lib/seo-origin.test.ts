import assert from "node:assert/strict";
import { test } from "node:test";
import * as site from "./site-url";
import robots from "../app/robots";
import { GET as cohortSitemap } from "../app/force-index-sitemap.xml/route";

// Keep callback/runtime origin separate from public search-engine identity.
const seoOrigin = () => site.getSeoSiteOrigin();

for (const scenario of [
  { name: "explicit production apex", env: { NEXT_PUBLIC_SITE_URL: "https://anidachi.app/", VERCEL_ENV: "production" }, seo: "https://www.anidachi.app", runtime: "https://anidachi.app", noindex: false },
  { name: "production www", env: { NEXT_PUBLIC_SITE_URL: "https://www.anidachi.app/path", VERCEL_ENV: "production" }, seo: "https://www.anidachi.app", runtime: "https://www.anidachi.app", noindex: false },
  { name: "production fallback", env: { VERCEL_ENV: "production", VERCEL_URL: "build.vercel.app" }, seo: "https://www.anidachi.app", runtime: "https://build.vercel.app", noindex: false },
  { name: "staging", env: { NEXT_PUBLIC_SITE_URL: "https://staging.anidachi.app", VERCEL_ENV: "preview", NEXT_PUBLIC_ROBOTS_NOINDEX: "true" }, seo: "https://staging.anidachi.app", runtime: "https://staging.anidachi.app", noindex: true },
  { name: "preview", env: { VERCEL_ENV: "preview", VERCEL_URL: "build.vercel.app" }, seo: "https://build.vercel.app", runtime: "https://build.vercel.app", noindex: true },
  { name: "local", env: { NEXT_PUBLIC_SITE_URL: "http://localhost:3023", NEXT_PUBLIC_ROBOTS_NOINDEX: "true" }, seo: "http://localhost:3023", runtime: "http://localhost:3023", noindex: true },
  { name: "public apex outside Vercel", env: { NEXT_PUBLIC_SITE_URL: "https://anidachi.app" }, seo: "https://www.anidachi.app", runtime: "https://anidachi.app", noindex: false },
  { name: "noindex deployment using apex", env: { NEXT_PUBLIC_SITE_URL: "https://anidachi.app", VERCEL_ENV: "preview" }, seo: "https://anidachi.app", runtime: "https://anidachi.app", noindex: true },
]) {
  test(scenario.name, async () => {
    const names = ["NEXT_PUBLIC_SITE_URL", "VERCEL_ENV", "VERCEL_URL", "NEXT_PUBLIC_ROBOTS_NOINDEX"];
    const old = Object.fromEntries(names.map(key => [key, process.env[key]]));
    try {
      for (const key of names) delete process.env[key];
      Object.assign(process.env, scenario.env);
      assert.equal(seoOrigin(), scenario.seo);
      assert.equal(site.getResolvedSiteOrigin(), scenario.runtime);
      assert.equal(site.isRobotsIndexingDisabled(), scenario.noindex);
      const robotsOutput = robots();
      const cohort = cohortSitemap();
      if (scenario.noindex) {
        assert.equal(robotsOutput.sitemap, undefined);
        assert.equal(cohort.status, 404);
      } else {
        assert.deepEqual(robotsOutput.sitemap, [`${scenario.seo}/sitemap.xml`, `${scenario.seo}/force-index-sitemap.xml`]);
        assert.equal(cohort.status, 200);
        const xml = await cohort.text();
        assert.ok(xml.includes(`<loc>${scenario.seo}/`));
        if (scenario.seo === "https://www.anidachi.app") assert.ok(!xml.includes("<loc>https://anidachi.app/"));
      }
    } finally {
      for (const key of names) {
        if (old[key] === undefined) delete process.env[key];
        else process.env[key] = old[key];
      }
    }
  });
}
