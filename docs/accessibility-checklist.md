# Manual accessibility and responsive checklist

Run through this before each release. Check the box only after trying it.

## Keyboard and focus
- [ ] Tab reaches every control in a logical order; "Skip to content" appears on first Tab.
- [ ] Focus ring is visible on buttons, links, inputs, calendar days and chips.
- [ ] Dialogs (delete confirmations, memory form, reflection composer) trap focus, close with Escape, and return focus.
- [ ] Focus mode in the editor exits with Escape; the writing area is reachable without a mouse.
- [ ] Mood chips, intensity flowers, and calendar days toggle with Space/Enter.

## Screen readers
- [ ] Autosave status ("Saving...", "Saved", errors) is announced politely.
- [ ] Calendar days announce date and entries/feelings; selected state is exposed via `aria-pressed`.
- [ ] Every input has a visible or screen-reader-only label; errors use `role="alert"`.
- [ ] Decorative flowers, tape and grain are hidden from assistive tech.

## Visual
- [ ] Body text and controls meet 4.5:1 contrast in light and dark themes.
- [ ] Information is never conveyed by colour alone (moods always show a text label).
- [ ] `prefers-reduced-motion` removes transitions and tilt-on-hover.
- [ ] Text zoom to 200% keeps all content usable without horizontal scrolling.

## Responsive
- [ ] 360px wide phone: bottom tab bar visible, nothing overlaps, editor is comfortable to type in.
- [ ] 768px tablet and 1280px+ desktop: sidebar navigation, two-column editor.
- [ ] Touch targets are at least 44px (36px for secondary small buttons).
- [ ] Landscape phone: editor and dialogs scroll rather than clip.

## Tone and states
- [ ] Every screen has loading, empty, and error states with a recovery action.
- [ ] No streak, "missed day", score or red/green framing appears anywhere.
