# Agent Note: Magic-door boot ceremony — the loading page becomes a gem-opened portal

Status: implemented

English | [中文](2026-08-16-magic-door-boot-ceremony.zh.md)

## Problem

The shell boot gate (`AppRoot` in `packages/client/web/src`) rendered a neutral spinner card under the wordmark "HARNESS" while the plugin tree loaded, then switched to the real UI in one pass the instant the boot settled (`loader.await()` + all-ACTIVE sweep). The settle could complete before the user's eye landed on the page, so the loading moment read as a flash and the entry into the app had no ceremony — functional, but the product wanted a themed, brand-first entrance ("Pixiyu purple magical-girl" register) that still honored the existing gate contract: status alone never opens the gate, and a single failed entry keeps a loud report instead of partial UI.

The challenge was to add a click-driven ritual without weakening that contract or breaking shell self-sufficiency: the loading page must still render with zero plugin dependencies (it reports the failure of the very system it depends on), so the ceremony could not pull in an asset fetch, an animation library, or any plugin package.

## Decision

`AppRoot` becomes a four-phase state machine driven entirely by kernel-own state plus timed transitions — no new props, no new dependencies, pure CSS for every visual:

1. **charging** — a floating crystal with twin magic-circle rings spins for a minimum dwell (`LOADING_MS`, 2.2 s) so the "center loading" moment reads even on an instant boot.
2. **closed** — the charge resolves into a closed door (top and bottom leaves) with a slowly rotating magic circle behind it; the center gem is the only interactive element.
3. **opening** — clicking the gem fires a scatter burst (butterflies with flapping wings, glowing motes, falling petals, rising mist — all CSS, deterministic via a seeded pseudo-random build so re-renders do not thrash), the magic circle spins up and dissipates, the leaves sweep with a shine and part in 3D (top leaf up, bottom leaf down), and the portal behind fades in.
4. **revealed** — the portal shows its vortex, halo, and the welcome copy ("欢迎回来，魔法师"); a not-yet-settled boot shows "正在唤醒世界…" until the settle lands.

The real UI enters only after the door opened **and** the boot settled. A settled boot that the user has not yet opened waits at the revealed portal for the gesture; a door opened before settlement waits at the portal for the settle. Either ordering resolves into the real UI in one switch, so the gate contract holds — status alone still never opens it, and `renderApp` is called exactly once.

### Self-sufficiency preserved

Every visual is pure CSS: gradients, `clip-path`, `conic-gradient` rings, `mask`, `box-shadow`, keyframes, and CSS custom properties (`--p-angle`, `--p-distance`, `--p-size`, `--p-delay`) drive the seeded burst. The shell value-imports no plugin package and fetches no asset, so the loading page still renders when (and especially when) plugins fail. The fail-loud branch is unchanged: a failed entry or a boot rejection keeps the loading page with the loud per-entry report, bypassing the ceremony entirely.

### Computed background stays a single color

The boot page paints a fixed violet night, independent of the persisted theme tokens: `background-color` is the computed single-color face (`#140a2e`) the e2e asserts, while the violet gradients live in `background-image`. The `data-ds-dark-theme` attribute and `colorScheme` still follow the persisted preference, so the dark-theme contract is intact; only the loading page's own palette is now the themed one.

### Desktop launcher

A PowerShell launcher (`magic-door-launcher.ps1`) and a generated violet crystal icon (`magic-door.ico`) ship at the repo root; a desktop shortcut (`魔法之门 DeepSeek Harness.lnk`) targets the launcher, which starts `dsh web --port 3080 --host 127.0.0.1` if the port is free and then opens the browser. These are convenience entry points, not runtime code.

## Consequences

- The loading page now owns a fixed violet palette independent of the theme tokens; a deployment that wanted the boot page to follow `--dsw-alias-bg-base` again would revert `AppRoot.module.css`. The `data-ds-dark-theme` attribute and `colorScheme` still follow the persisted preference, so the dark-theme contract is intact.
- The real UI no longer enters the instant the boot settles; it waits for the gem click. A headless or scripted boot that never clicks stays at the revealed portal — acceptable for a themed entrance, but any future automation that wants the real UI without interaction must click the gem (or a future `seam`-injected skip) rather than rely on settle alone.
- The ceremony adds `LOADING_MS + OPENING_MS + REVEAL_MS` of perceived latency on top of the real boot; the phases run while the boot settles in parallel, so on a slow boot the ceremony is free, but on a fast boot the user sees the full ritual.

## Testing

The shell-owned gate semantics are pinned by `packages/client/web/tests/app-root.client.spec.tsx` with fake timers driving the phase durations: the charging page never calls `renderApp`; status alone never opens the gate; failed entries and the boot failure report stay loud; settlement alone does not enter (the door waits for the gem click); clicking the gem with settlement already set switches to the real UI in one pass; a door opened before settlement waits at the portal until the settle lands. The full browser chain (real module system + vendored Loader + bundles) remains the e2e's job. `apps/web/tests/settings-chrome.e2e.ts` asserts the loading page's computed background color (`rgb(20, 10, 46)`) and that the persisted dark-theme preference still sets `data-ds-dark-theme` and `colorScheme: dark`.

## Alternatives considered

- **Auto-enter on settle, ceremony as a skip-able overlay.** Rejected: the product wanted the gem click to be the entrance, not a prelude the user can miss. Making settlement wait for the gesture keeps the ritual on every boot.
- **An animation library (GSAP/anime.js).** Rejected on shell self-sufficiency: the loading page cannot depend on a plugin package, and keyframed CSS covers every motion needed (scatter, spin, 3D parting, shine sweep) without a runtime dependency or an asset fetch.
- **Generated image assets for the door, portal, and gem.** Deferred: pure CSS keeps the page self-contained and instant, and matches the token-fallback policy for the boot page. Image-driven variants can layer in later without changing the phase contract.

## Risks

- The click-to-enter contract diverges from the original "settle → one-pass switch" wording in the web-client architecture note; that note was updated in the same change to describe the magic-door gate, so the decision and the architecture record agree.
- The CSS burst uses `transform: rotate(var(--p-angle)) translate(...)` with `rotate(calc(var(--p-angle) * -1))` to un-rotate each particle for upright art; a browser that does not support `calc()` inside `rotate()` (all evergreen engines do) would scatter art at the launch angle without uprighting. Acceptable for the boot page's evergreen-only audience.
- The desktop launcher spawns the web server only when port 3080 is free; a deployment already serving something else on 3080 would skip the spawn and open the existing URL, which is the intended convenience behavior.
