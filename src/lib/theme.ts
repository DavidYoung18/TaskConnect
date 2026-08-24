// Design tokens — single source of truth for the values that were drifting across
// the app (per the design QA review: ~50 hex values doing the job of ~8 semantic
// colors, border radius scattered across 8/10/12/14/16/20 with no rule, secondary
// text split between #666/#999 with no clear tiering). Values here are the ACTUAL
// dominant value already in use for each role, not new colors invented from
// scratch — the goal is converging existing usage onto one value per role, not
// introducing a visually different palette.

export const colors = {
  ink: '#000000',        // primary text, primary button fill
  inkMuted: '#666666',   // secondary/body-muted text
  inkFaint: '#999999',   // tertiary text, placeholders, disabled labels
  surface: '#ffffff',
  surfaceMuted: '#f5f5f5',
  border: '#e8e8e8',     // the dominant border gray (86 of ~120 border-color usages)

  danger: '#f44336',         // the most-used of 5 competing reds
  dangerText: '#f44336',
  success: '#065f46',
  successBg: '#d1fae5',
  warning: '#b45309',
  warningBg: '#fef3c7',
} as const;

export const radius = {
  card: 12,    // dominant radius (76 of ~145 usages) — cards, buttons, inputs, modals
  pill: 100,   // fully-rounded badges/tags/segmented controls — already consistent app-wide
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const type = {
  caption: 12,
  bodySmall: 13,
  label: 14,
  body: 15,
  title: 20,
  largeTitle: 28,
} as const;
