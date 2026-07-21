@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-display: "Barlow Condensed", sans-serif;
  --font-body: "Inter", sans-serif;
}

html,
body {
  background-color: #14161a;
  color: #f4f3ef;
  overscroll-behavior-y: contain;
}

* {
  -webkit-tap-highlight-color: transparent;
}

body {
  padding-bottom: env(safe-area-inset-bottom);
}

::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Signature element: dashboard gauge ring, used behind price / offer actions */
.gauge-ring {
  position: relative;
}
.gauge-ring::before {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: 9999px;
  border: 2px solid rgba(255, 176, 32, 0.35);
  border-top-color: #ffb020;
  transform: rotate(-45deg);
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}

.input {
  @apply w-full rounded-xl border border-white/10 bg-surface2 px-4 py-2.5 text-ivory outline-none;
}
.input:focus {
  @apply border-amber;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
