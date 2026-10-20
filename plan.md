# EduVerse LMS — Implementation Plan

## Scope

EduVerse is implemented as a responsive Next.js App Router experience with a deliberately useful demo mode. The first release proves the three most important journeys end-to-end in the browser: teacher creates and controls a course, a student joins by link and completes activities, and a teacher configures/tests a Number Line Challenge in Mini-Game Studio. Demo state is stored in `localStorage` and is clearly labeled; the domain model is kept in typed seed modules so it can be moved to the enabled managed database without rewriting the UI.

## Architecture

- `app/`: route-level screens for public entry, Teacher, Admin, and Student flows.
- `components/`: reusable shell, cards, data visualizations, activity controls, dialogs, and feedback UI.
- `lib/demo-data.ts`: typed seed data for the demo course, participants, quiz, and mini-game.
- `lib/storage.ts`: browser persistence helpers for theme, participant identity, progress, and studio draft.
- `public/manus-routes.json`: route manifest for Preview and deployment.
- `app.config.ts`: project branding metadata.

No service-role keys are used in the browser. A future production adapter can replace the browser service functions with authenticated server actions and the managed database. The UI uses a `DEMO MODE` badge wherever state is browser-local.

## Design

### Considered styles

- Soft neo-brutalist classroom: 0.07 probability; tactile blocks and expressive labels, but too loud for sustained student use.
- Calm editorial learning lab: 0.06 probability; refined and quiet, but misses the requested playfulness.
- **Chosen — Playful 3D EdTech dashboard**: 0.87 probability; friendly depth, colorful progress, and practical classroom density.

### Design Movement

Playful 3D EdTech with soft UI surfaces and a light isometric illustration language.

### Core Principles

1. Make the next action obvious for a busy teacher.
2. Let progress feel physical through depth, rails, and gentle lift.
3. Keep student journeys focused and low-friction.
4. Use color as a learning signal, not decoration.

### Color Philosophy

Soft violet is the platform’s ownable signal: imaginative, confident, and distinct from school-admin blue. Teal marks motion and completion, yellow marks energy and attention, and coral marks human feedback. Warm neutrals keep long reading and data tables comfortable in both themes.

### Layout Paradigm

A rail-and-canvas composition: a persistent teacher rail frames an asymmetric content canvas, while hero metrics and activity cards overlap into a soft stack rather than a rigid dashboard grid.

### Signature Elements

- “Orbit” progress rings and pill-shaped status badges.
- Layered cards with a visible lower “shadow slab” for tactile depth.
- A small orbiting dot motif around course and game illustrations.

### Interaction Philosophy

Every control should reveal a concrete state change: publish toggles access, quiz answers unlock feedback, game settings change the generated challenge, and student progress persists locally.

### Animation

Use short ease-out lifts and fades. Celebrate completion with a small scale and color transition, never a distracting confetti wall. Respect `prefers-reduced-motion` by removing lift and pulse transitions.

### Typography System

Use a rounded display treatment through heavy system sans weights for headings, with readable system sans for body copy. Headings use tight tracking and short line lengths; body copy stays at 1.55 line height for student comprehension.

### Brand Essence

A friendly learning studio that turns teacher-made content into visible momentum. Personality: curious, encouraging, practical.

### Brand Voice

Headlines are warm and action-oriented. CTAs are specific. Example lines: “Make today’s lesson feel like a small adventure.” and “Open the room when your class is ready.”

### Wordmark & Logo

The mark is an orbiting “e” made from a violet ring and teal spark; the wordmark is lowercase `eduverse` with a compact dot between brand and workspace labels.

### Signature Brand Color

`#7C5CFC` — EduVerse Violet.

## Build workflow

1. Install the pinned pnpm dependencies.
2. Run TypeScript diagnostics and `pnpm typecheck`.
3. Start `pnpm dev` on the configured port 3000.
4. Verify `/manus-routes.json`, `/`, `/teacher`, `/teacher/game-studio`, `/learn/operasi-bilangan-bulat`, and `/admin`.
5. Run `pnpm build` before checkpointing.
6. Commit and push to the canonical `main` branch for a recorded checkpoint; publication remains manual because auto-publish is disabled.
