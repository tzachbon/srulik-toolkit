# UI UX review checklist

Use the product's requirements and supported platforms to select applicable
checks. Accessibility requirements take precedence over stylistic preferences.
The numerical values below identify specific standards or platform guidance;
other layout and timing choices need evidence of a user problem.

## Story and design-system coverage

- Account for every in-scope story and acceptance criterion, including relevant
  roles, permissions, alternate paths, and failure/recovery states. Record
  absent screens and missing evidence instead of omitting the story.
- Directly inspect each required design image and implementation render at a
  readable scale. Compare generated designs with the story and design system;
  compare implementation screenshots with approved designs and the system.
- Verify reuse of established component variants, tokens, typography, spacing,
  colors, icon conventions, and interaction patterns. Trace exceptions to an
  approved decision; propose reuse before custom styling or new dependencies.
- Keep visual and behavioral evidence separate. Screenshots do not demonstrate
  navigation, submission, focus, announcements, or recovery; passing source or
  automated checks do not demonstrate visual quality.

## Accessibility and input

- Verify text contrast against the actual composed background: WCAG AA uses
  4.5:1 for normal text and 3:1 for large text (at least 18pt, or 14pt bold).
  [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
  exempts text in inactive components, decorative or incidental text, and
  logotypes.
  Applicable meaningful UI boundaries and graphics need 3:1 non-text contrast.
  [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
  exempts inactive components, unmodified user-agent controls, and graphics
  whose particular presentation is essential to the information conveyed.
  Evaluate gradients, transparency, images, and each supported theme separately.
- Check accessible names, roles, and states. Icon buttons need names;
  meaningful images need alternatives; decorative imagery should be ignored
  by assistive technology. Visible labels and accessible names should agree.
- Walk keyboard order, visible focus, activation, modal containment and focus
  return, and escape routes. Focused controls must not be hidden by sticky UI.
  Check headings, landmarks, reading order, and skip navigation where relevant.
- Check zoom, text scaling, and reflow without lost content or functionality.
  For applicable web content, test WCAG text resize at 200% and reflow at
  320 CSS px width; essential two-dimensional content has exceptions.
- Distinguish target rules: WCAG 2.2 AA web targets are at least 24×24 CSS px
  or meet a criterion exception such as spacing; iOS guidance is 44×44pt and
  Android guidance is 48×48dp. Assess the hit area, not only the visible icon.
- Provide alternatives to hover-only, gesture-only, and drag-only controls.
  Check that status/error updates reach assistive technology without stealing
  focus, and information is understandable without color alone.
- Authentication should support password managers and paste; check accessible
  alternatives to cognitive tests and unnecessary repeated entry.

## Task clarity, navigation, and interaction

- Can a user identify the main task, the current location, and the next action?
  Check labels, grouping, action hierarchy, and information needed for decisions.
- Verify predictable back/forward, retained relevant state, deep links where
  expected, and a visible way to dismiss overlays or cancel a multistep flow.
- Check hover, focus, pressed, selected, and disabled states as applicable.
  Loading feedback should explain waiting and prevent accidental duplicate
  actions without hiding failure or trapping the user indefinitely.
- Check search, filtering, sorting, pagination, and selection where present:
  results, counts, active criteria, and reset behavior should remain clear.
- Respect native controls, system gestures, safe areas, and platform navigation.

## Forms, feedback, and recovery

- Inputs need persistent labels, understandable requirements, appropriate input
  types, and autofill where relevant. Placeholders are not replacements for labels.
- Errors should identify the problem and recovery action, remain near their
  field, and be programmatically associated. After failed submission, manage
  focus to an error summary or the first invalid field as appropriate.
- Exercise loading, empty, no-results, partial, error, timeout, and success
  states. Preserve entered data on failure and make retry behavior clear.
- Distinguish success from pending work. Important information must remain
  available long enough to use; transient toasts must not be the sole record.
- For destructive actions or unsaved input, check proportionate confirmation,
  undo, or recovery. Inspect behavior without executing unauthorized effects.

## Layout, typography, and visual consistency

- Check narrow/wide layouts, orientation, and supported themes. Look for
  unintended horizontal overflow, overlap, clipped text, and content hidden
  behind fixed bars, keyboards, notches, or gesture areas. Essential tables or
  canvases may scroll when usable alternatives and context are preserved.
- Test long labels, localization, large values, empty content, URLs, and user
  text. Essential labels must remain available when wrapping or truncating;
  overflow disclosures should work by keyboard and pointer.
- Assess hierarchy, grouping, reading order, text size, line length, and line
  spacing against real content and audience. Do not enforce arbitrary font,
  spacing, or breakpoint values as universal accessibility requirements.
- Compare repeated components with existing tokens: typography, color roles,
  spacing, alignment, icons, borders, elevation, and interaction states.
  Flag inconsistency when it obscures meaning or conflicts with the system.

## Motion and perceived performance

- Check reduced motion, pause/stop controls where required, and interruptible
  transitions. Actions must remain usable without animation; feedback must
  reflect current state during rapid interactions.
- Look for layout shifts, lost scroll position, input delay, and unexplained
  waits. Reserve space for async content and media where relevant.
- Recommend performance changes only for an observed problem or supported
  source finding. Record measurements and conditions when available; avoid
  invented timings, mandatory animation, or arbitrary list-size thresholds.

## Charts and data displays

- Check whether the chart fits the user's comparison, trend, or lookup task.
  Verify labels, units, scales, legends, and distinctions beyond color.
- Ensure tooltips and underlying values are accessible by the supported input
  methods; provide an equivalent textual summary or data table where needed.
- Check empty, loading, missing/stale data, and filtering states. Severity
  depends on the decisions affected, not whether the defect is in a chart.
