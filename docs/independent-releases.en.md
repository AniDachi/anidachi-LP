# Release an SEO change

You can ship a website change while another developer is still working on the Prime extension. You share a staging site, and each task has its own release pull request (PR).

Use your own GitHub account with **Write** access to the repository. Get the staging password through the team password manager.

## Start your task

For example, to update the title of the Netflix page, start a branch from the current production version. Pick a new branch name for each task.

```bash
git fetch origin
git switch -c codex/seo-netflix-title origin/main
```

On a new machine, follow the Node and pnpm setup in the [repository contributor guide](../AGENTS.md). If your checkout still tells you to branch from `staging`, read the current instructions with `git show origin/staging:AGENTS.md`. Website-specific rules are in the [web contributor guide](../apps/web/AGENTS.md).

## Check the change on staging

1. Make your change and run the local checks before opening the PR.

   ```bash
   pnpm dev:check --base origin/main
   pnpm --filter @anidachi/web check
   pnpm --filter @anidachi/web test
   ```

2. Commit and push your branch. Open a PR with **base `staging`** and your branch as the source. Once CI passes, merge it yourself using **Create a merge commit**. Keep your branch for the release.
3. The **Accept a staged feature** workflow checks your exact commit on its own and tests the shared staging site. Open the changed page and check what visitors will see. For the title example, check the browser tab and the page's `<title>`. Staging is password-protected and deliberately marked `noindex`. [Open the staging site](https://staging.anidachi.app)

## Release when you are ready

After staging passes, GitHub opens or updates one PR from **your branch to `main`**. Check **Files changed** and the required `tested-on-staging` and `isolated-release-ci` results. You can leave this PR open while you work. When you're ready, click **Merge** yourself. Your teammate can release their own PR independently.

After release, GitHub checks what merging `main` into `staging` would change. If staging already has the released changes, the next task based on the latest `main` carries the release commit into staging. GitHub opens a separate PR into `staging` only when files would change or a conflict needs attention.

If you push another commit, open a fresh PR from the same branch into `staging`. GitHub requires staging to pass again for the new commit. If `main` has moved, run `git fetch origin` and `git merge origin/main` on your branch, then push and stage it again. Always bring shared updates into your branch from `origin/main`. If staging acceptance fails, open **Actions → Accept a staged feature** and read the failed step.

## Prompt for your AI assistant

> Implement the SEO task on one branch from the latest `origin/main`. Follow the repository and web contributor instructions. Run the web checks and open the first PR against `staging`. Keep the branch and repeat staging after any new commits. Send me the staging page URL and my release PR so I can review the change. Merge into `main` only when I explicitly ask you to release it.
