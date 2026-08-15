/**
 * Shell root: boot loading page → (boot settled + door opened) → real UI in
 * one switch. Pure kernel component with zero plugin dependencies — before
 * settled it may only rely on itself (the fail-loud presentation must not
 * depend on the system whose failure it reports; the status/signal stores are
 * kernel-own, shell self-sufficiency rule); the real UI is produced by the
 * app-shell entry once every entry is active.
 *
 * The loading page is a magic-door ceremony: a crystal charge phase (the
 * center "loading" moment), then a closed portal whose center gem opens the
 * door on click (top leaf up, bottom leaf down), revealing the starfield
 * behind. Opening the gem fires a burst — the magic circle spins up, butterflies,
 * motes, petals and mist scatter outward — before the leaves part. Settlement
 * never bypasses the ceremony: the real UI enters only after the door opened,
 * so a fast boot still reads as a magic-door reveal. A failed boot keeps the
 * loading page and lists the per-entry fiber states and the sweep report
 * (fail loud, no partial UI).
 */
import { useEffect, useMemo, useState } from 'react'
import { useSyncExternalStore } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { KernelSignal, LoaderStatus } from './loader-status.ts'
import css from './AppRoot.module.css'

/** Map a particle kind to its CSS module class — static so the bundler keeps the names.
 *  The four classes are defined in AppRoot.module.css; the assertion narrows the
 *  CSS module's `string | undefined` index face back to `string` for className use. */
const PARTICLE_CLASS = {
  butterfly: css.p_butterfly,
  mote: css.p_mote,
  petal: css.p_petal,
  mist: css.p_mist,
} as Record<Particle['kind'], string>

/** Minimum dwell of the crystal-charge phase so the loading moment reads even on instant boots. */
export const LOADING_MS = 2200
/** Door-opening animation duration (burst + top leaf up + bottom leaf down). */
export const OPENING_MS = 1700
/** Post-open dwell before the settled real UI enters. */
export const REVEAL_MS = 700

/** Door-ceremony phase: crystal charge → closed door → opening → revealed. */
type BootPhase = 'charging' | 'closed' | 'opening' | 'revealed'

/** AppRoot props: settled signal, fiber-state projection feed, boot failure report, deferred real-UI factory. */
export interface AppRootProps {
  /** True once the boot chain settled (loader quiesced + all entries ACTIVE); the boot closure flips it. */
  settled: KernelSignal<boolean>
  /** Per-entry fiber-state projection store (drives loading/failed rendering). */
  status: KernelSignal<LoaderStatus>
  /** Boot failure report (the settle rejection message); undefined while loading or after success. */
  error: KernelSignal<string | undefined>
  /** Builds the real UI; called only after the door opened. */
  renderApp: () => ReactNode
}

/** One scatter particle: kind, launch angle (deg), distance, size, delay. */
interface Particle {
  kind: 'butterfly' | 'mote' | 'petal' | 'mist'
  angle: number
  distance: number
  size: number
  delay: number
}

/** Deterministic pseudo-random in [0,1) from a seed — keeps the burst reproducible across renders. */
function rand(seed: number): number {
  const x = Math.sin(seed * 999.13) * 43758.5453
  return x - Math.floor(x)
}

/** Precompute the scatter burst so it is stable across re-renders (no layout thrash on each frame). */
function buildBurst(): Particle[] {
  const out: Particle[] = []
  // Butterflies — few, large, fly far with varied angles.
  for (let i = 0; i < 7; i += 1) {
    out.push({ kind: 'butterfly', angle: 18 + i * 47 + rand(i + 1) * 22, distance: 180 + rand(i + 9) * 150, size: 26 + rand(i + 17) * 16, delay: rand(i + 25) * 180 })
  }
  // Motes — many, small, scatter everywhere.
  for (let i = 0; i < 26; i += 1) {
    out.push({ kind: 'mote', angle: rand(i + 100) * 360, distance: 120 + rand(i + 110) * 240, size: 4 + rand(i + 120) * 7, delay: rand(i + 130) * 240 })
  }
  // Petals — medium, arc outward and fall.
  for (let i = 0; i < 14; i += 1) {
    out.push({ kind: 'petal', angle: rand(i + 200) * 360, distance: 90 + rand(i + 210) * 180, size: 10 + rand(i + 220) * 10, delay: rand(i + 230) * 200 })
  }
  // Mist — slow rising wisps near the center.
  for (let i = 0; i < 8; i += 1) {
    out.push({ kind: 'mist', angle: 30 + i * 42 + rand(i + 300) * 18, distance: 40 + rand(i + 310) * 90, size: 60 + rand(i + 320) * 50, delay: rand(i + 330) * 300 })
  }
  return out
}

/** Boot gate: magic-door ceremony until the boot settles and the user opens the door; failures stay here. */
export function AppRoot(props: AppRootProps) {
  const settled = useSyncExternalStore(props.settled.subscribe, props.settled.getSnapshot)
  const status = useSyncExternalStore(props.status.subscribe, props.status.getSnapshot)
  const error = useSyncExternalStore(props.error.subscribe, props.error.getSnapshot)
  const [phase, setPhase] = useState<BootPhase>('charging')
  const [entered, setEntered] = useState(false)
  const burst = useMemo(buildBurst, [])
  const failed = Object.entries(status).filter(([, s]) => s === 'failed')

  // Charge phase runs its minimum dwell, then the closed door appears.
  useEffect(() => {
    if (phase !== 'charging') return
    const timer = setTimeout(() => { setPhase('closed') }, LOADING_MS)
    return () => { clearTimeout(timer) }
  }, [phase])

  // The opening animation plays, then the portal stays revealed.
  useEffect(() => {
    if (phase !== 'opening') return
    const timer = setTimeout(() => { setPhase('revealed') }, OPENING_MS)
    return () => { clearTimeout(timer) }
  }, [phase])

  // The real UI enters only after the door opened AND the boot settled —
  // a settled boot waits at the revealed portal for the user gesture.
  useEffect(() => {
    if (phase !== 'revealed' || !settled) return
    const timer = setTimeout(() => { setEntered(true) }, REVEAL_MS)
    return () => { clearTimeout(timer) }
  }, [phase, settled])

  if (entered) return <>{props.renderApp()}</>

  const loud = error !== undefined || failed.length > 0

  if (loud) {
    return (
      <div className={css.boot}>
        <div className={css.stage}>
          <div className={css.wordmark}>HARNESS</div>
          <div className={css.failed}>
            <div className={css.failedTitle}>Failed to load plugins</div>
            {failed.map(([id]) => <div key={id} className={css.failedItem}>{id}</div>)}
            {error !== undefined && <div className={css.failedItem}>{error}</div>}
          </div>
        </div>
      </div>
    )
  }

  const open = phase === 'opening' || phase === 'revealed'

  return (
    <div className={css.boot} data-phase={phase}>
      <div className={css.stars} aria-hidden="true" />
      <div className={`${css.aurora} ${open ? css.auroraOpen : ''}`} aria-hidden="true" />
      {phase === 'charging' && (
        <div className={css.stage}>
          <div className={css.wordmark}>HARNESS</div>
          <div className={css.crystal} aria-hidden="true">
            <span className={css.crystalShard} />
            <span className={css.crystalRing} />
            <span className={css.crystalRing2} />
          </div>
          <div className={css.hint}>Loading plugins…</div>
        </div>
      )}
      {phase !== 'charging' && (
        <div className={`${css.door} ${open ? css.doorOpen : ''}`}>
          <div className={css.portal} aria-hidden={!open}>
            <div className={css.portalVortex} />
            <div className={css.portalHalo} />
            <div className={css.welcome}>欢迎回来，魔法师</div>
            {!settled && <div className={css.waking}>正在唤醒世界…</div>}
          </div>
          {/* Magic circle — slow spin while closed, fast spin on open. */}
          <div className={css.circle} aria-hidden="true">
            <span className={css.circleRing} />
            <span className={css.circleGlyphs} />
            <span className={css.circleRing2} />
          </div>
          <div className={`${css.leaf} ${css.leafTop}`} aria-hidden="true">
            <span className={css.leafSigil} />
            <span className={css.leafShine} />
          </div>
          <div className={`${css.leaf} ${css.leafBottom}`} aria-hidden="true">
            <span className={css.leafSigil} />
            <span className={css.leafShine} />
          </div>
          <button
            type="button"
            className={css.gem}
            onClick={() => { if (phase === 'closed') setPhase('opening') }}
            aria-label="点击开启魔法之门"
          >
            <svg className={css.gemStar} viewBox="0 0 48 48" aria-hidden="true">
              <path
                d="M24 2 L29 17 L44 12 L37 24 L44 36 L29 31 L24 46 L19 31 L4 36 L11 24 L4 12 L19 17 Z"
                fill="url(#gemGrad)"
              />
              <circle cx="24" cy="24" r="5" fill="#fff" opacity="0.9" />
              <defs>
                <linearGradient id="gemGrad" x1="4" y1="4" x2="44" y2="46" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#f5d0fe" />
                  <stop offset="45%" stopColor="#c084fc" />
                  <stop offset="100%" stopColor="#6d28d9" />
                </linearGradient>
              </defs>
            </svg>
          </button>
          {/* Burst layer: butterflies, motes, petals, mist scatter on open. */}
          {open && (
            <div className={css.burst} aria-hidden="true">
              {burst.map((p, i) => (
                <span
                  key={i}
                  className={`${css.particle} ${PARTICLE_CLASS[p.kind]}`}
                  style={{
                    '--p-angle': `${p.angle}deg`,
                    '--p-distance': `${p.distance}px`,
                    '--p-size': `${p.size}px`,
                    '--p-delay': `${p.delay}ms`,
                  } as CSSProperties}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
