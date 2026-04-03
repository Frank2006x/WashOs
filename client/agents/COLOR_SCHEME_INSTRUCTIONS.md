# Color Scheme Instructions

Use this project color system consistently across screens and components.

## Source Of Truth

- Define and update tokens only in `global.css` under `:root` and `.dark`.
- Do not hardcode random color values in components.
- Use semantic classes in JSX: `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`, `bg-primary`, etc.

## Theme Rules

- Every new UI component must support light and dark mode.
- Prefer semantic tokens first.
- If Nativewind runtime behavior needs explicit dark fallback in a specific component, pair semantic classes with `dark:*` utilities.

## Token Naming

Use existing token names instead of creating one-off names:

- Core: `background`, `foreground`, `border`, `ring`, `input`
- Surfaces: `card`, `popover`, `sidebar`
- Text pairs: `*-foreground`
- Intent: `primary`, `secondary`, `accent`, `destructive`, `muted`
- Data visuals: `chart-1` to `chart-5`

## Architecture Guardrails

- Keep token definitions in CSS.
- Keep token mapping in `tailwind.config.js`.
- Keep components semantic and reusable.
- Avoid visual drift by reusing the same spacing, radius, and typography tokens.

## PR Checklist

- No new hardcoded colors unless intentionally documented.
- Light and dark mode both tested.
- Components use semantic token classes.
- Lint passes.
