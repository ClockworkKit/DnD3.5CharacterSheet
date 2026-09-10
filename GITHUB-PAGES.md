# Publish Barrow Ledger with GitHub Pages

The Pages edition has the same character sheet, reference libraries, automatic calculations, local dice, and Beyond20 controls. It saves characters in the visitor's browser. The original Sites edition remains available with server saves.

## Cost and repository access

[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) is included with GitHub Free for **public repositories**. A private personal repository needs GitHub Pro or another eligible paid plan. Check [GitHub's current plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans) before upgrading. This setup does not change visibility or purchase a plan.

`ClockworkKit/DnD3.5CharacterSheet` was private and had Pages disabled when this edition was prepared. If using GitHub Free, you must choose to make the repository public before enabling Pages. That exposes the repository's source and commit history, including the previous C# application. Keeping the repository private requires an eligible paid plan. A Pages website from a personal account is public even when its source repository is private.

## Activate once

1. If necessary, choose public visibility under **Settings → General → Danger Zone → Change repository visibility**, or use an eligible paid GitHub plan.
2. Open [Settings → Pages](https://github.com/ClockworkKit/DnD3.5CharacterSheet/settings/pages). Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Open [the Pages workflow](https://github.com/ClockworkKit/DnD3.5CharacterSheet/actions/workflows/pages.yml). Select **Run workflow**, keep `master`, and run it.
4. Wait for both the build and deployment to succeed. GitHub displays the published website link in the deployment and Pages settings.

The expected address after successful deployment is `https://clockworkkit.github.io/DnD3.5CharacterSheet/`. This document is not confirmation that it is live. Subsequent pushes to `master` deploy automatically while Pages remains enabled. A push with Pages disabled builds and packages the site without deploying it.

## Bring your characters

Export each character from the original Site, open the Pages edition, then choose **Import character**. The original saved record remains on the original Site.

Pages saves stay in the current browser profile on the current device. No account sign-in or cross-device synchronization is provided in this edition. Export backups before clearing browser data, changing devices, renaming the repository, or moving to a different domain. Private-browsing storage may disappear when its session ends. If storage is blocked or full, the sheet retains the open edits and offers export instead of claiming they were saved.

Each browser has its own characters. The published assets contain no saved characters or database. People who share a browser profile can access the same browser saves.

## Roll20

Enable the new `clockworkkit.github.io` site in Beyond20's custom-domain settings, reload the sheet, and use **Roll20 setup → Send test roll** with your Roll20 game open. The old Site's extension permission does not automatically cover a new domain.

## Build details

`npm run build:pages` uses `build/pages.config.ts` and writes `dist-pages/`. It leaves the Sites output and configuration separate. `npm run preview:pages` serves that output for local inspection at the project path. Dependencies are shared with the original application; no new package is required.

The project path defaults to `/DnD3.5CharacterSheet/`. To deploy at a different project path or custom domain, set `PAGES_BASE_PATH` for the build, ending it with `/`. The public reference URLs, logo link, icon, scripts, and styles use that base. The browser ledger is scoped to the base path, so export before changing it.

The workflow uses standard GitHub-hosted Linux runners, tests the source, checks TypeScript, builds the Pages edition, uploads its static artifact, and deploys through GitHub's official Pages actions. It uses the workflow's temporary token and requires no stored personal token. The artifact excludes server output and credentials.

See the [Vite deployment guide](https://vite.dev/guide/static-deploy.html#github-pages) and [GitHub's workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) for the publishing mechanism.
