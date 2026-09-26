---
name: Kids Church Check-In
description: Sunday check-in for kids, families, and the serve team, built for phones in a bright church lobby.
colors:
  sunday-blue: "#1a6bd6"
  sunday-blue-deep: "#1558b3"
  ink: "#0f172a"
  body-ink: "#1e293b"
  quiet-ink: "#475569"
  whisper-ink: "#64748b"
  field-line: "#dbeafe"
  morning-tint: "#eff6ff"
  canvas-sky: "#f0f9ff"
  canvas-sun: "#fefce8"
  paper: "#ffffff"
  sunshine: "#fef08a"
  cloud: "#bfdbfe"
  bubblegum: "#fbcfe8"
  all-good-green: "#15803d"
  all-good-tint: "#f0fdf4"
  oops-red: "#991b1b"
  oops-tint: "#fef2f2"
  birthday-gold: "#854d0e"
  birthday-tint: "#fefce8"
  pickup-orange: "#9a3412"
  pickup-tint: "#fff7ed"
typography:
  display:
    fontFamily: "Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 900
    lineHeight: 1.33
  title:
    fontFamily: "Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 900
    lineHeight: 1.55
  body:
    fontFamily: "Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.43
  meta:
    fontFamily: "Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.33
rounded:
  pill: "9999px"
  card: "2rem"
  control: "1rem"
  compact: "0.75rem"
spacing:
  gutter: "16px"
  stack: "16px"
  card-pad: "24px"
  tap-min: "44px"
components:
  button-primary:
    backgroundColor: "{colors.sunday-blue}"
    textColor: "{colors.paper}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "16px"
  button-primary-hover:
    backgroundColor: "{colors.sunday-blue-deep}"
    textColor: "{colors.paper}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.sunday-blue}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "{spacing.tap-min}"
  button-checkout:
    backgroundColor: "{colors.pickup-tint}"
    textColor: "{colors.pickup-orange}"
    typography: "{typography.label}"
    rounded: "{rounded.compact}"
    height: "{spacing.tap-min}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.body-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  notice-error:
    backgroundColor: "{colors.oops-tint}"
    textColor: "{colors.oops-red}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px"
  notice-success:
    backgroundColor: "{colors.all-good-green}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px"
  help-button:
    backgroundColor: "{colors.sunday-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    size: "56px"
---

# Design System: Kids Church Check-In

## Overview

**Creative North Star: "The Sunday Playroom"**

Check-in should feel like walking into the kids' room on a Sunday morning: bright, soft, a little bouncy, and obviously made for children. Parents tapping on a phone in a busy lobby should feel welcomed and never lost. Leaders at the admin screens should feel the same room, just with the lights on for work. The playfulness is in the materials (rounded type, pillowy cards, sunshine and bubblegum circles, emoji) and never in the controls. Every button, field, and message is plain, large, and obvious.

The system is light-only on purpose. It is used under bright lobby light on mid-range phones, and a dark theme would add maintenance for no one. Density is low on parent screens (one decision per screen, big tap tiles) and moderate on admin screens (lists, counts, filters). Both share the same card, field, and button vocabulary.

**Key Characteristics:**
- One brand blue carries every primary action. Everything else is soft tint or neutral ink.
- One rounded family (Nunito) at three weights. The 900 weight does all the shouting.
- Pillowy white cards on a sky-to-sunshine gradient canvas.
- Emoji and soft decorative circles appear on every page, including admin, as the brand's voice.
- Accessibility floor is non-negotiable: AA contrast, 44px taps, announced messages.

## Colors

A sunny primary-school palette: one confident blue, soft pastel atmosphere, and dark, readable ink.

### Primary
- **Sunday Blue** (#1a6bd6): every primary action (Check In, Sign In, Next, Save), the help button, selected states, links, and the focus ring. Darkened from the original #227EEE so white text passes at 5.1:1. Defined once as `--color-brand` in `app/globals.css`.
- **Sunday Blue Deep** (#1558b3): hover and pressed state of Sunday Blue (`--color-brand-strong`).

### Atmosphere
- **Sunshine** (#fef08a, Tailwind yellow-200): decorative circles and text selection.
- **Cloud** (#bfdbfe, blue-200): decorative circles and the soft blue shadow tint.
- **Bubblegum** (#fbcfe8, pink-200): the third decorative circle.
- **Canvas gradient**: Morning Tint (#eff6ff) through Canvas Sky (#f0f9ff) to Canvas Sun (#fefce8), top to bottom (`bg-gradient-to-b from-blue-50 via-sky-50 to-yellow-50`). This is the page background everywhere.

### Semantic
- **All-Good Green** (#15803d on white, #f0fdf4 tint): success toasts, "Session active", check-in counts.
- **Oops Red** (#991b1b text on #fef2f2): errors, and destructive-action text (red-700, #b91c1c).
- **Birthday Gold** (#854d0e on #fefce8): birthday highlights and first-timer counts.
- **Pickup Orange** (#9a3412 on #fff7ed): the admin Check Out action only.

### Neutral
- **Ink** (#0f172a): headings.
- **Body Ink** (#1e293b): names, values, field text.
- **Quiet Ink** (#475569): helper text, subtitles, secondary links. It is the default secondary color and safe on every background.
- **Whisper Ink** (#64748b): meta text, **only on white**. On the gradient canvas it fails contrast.
- **Field Line** (#dbeafe): 2px borders on fields, secondary buttons, and tiles.

### Named Rules
**The Blue Means Go Rule.** Sunday Blue is reserved for the thing to tap next. Decoration uses the pastel atmosphere colors, never the brand blue at full strength.

**The No Grey On The Sky Rule.** Text sitting directly on the gradient canvas is Quiet Ink (#475569) or darker. Whisper Ink lives only inside white cards.

**The Colour Plus Words Rule.** State is never colour alone: errors say what is wrong, birthdays say "Birthday today!", checked-out rows say "Out".

## Typography

**Display, body, and label font:** Nunito (with ui-rounded, system-ui, sans-serif). It is self-hosted through `next/font/google` at weights 400, 700, and 900 only.

**Character:** round terminals echo the chunky "KiDS" logo lettering. At 900 it reads like a friendly shout; at 400 it stays calm for instructions.

### Hierarchy
- **Display** (900, 1.875rem/30px, tight tracking): the page greeting ("Check-In Time!", "Welcome Back!", "First Timer!").
- **Headline** (900, 1.5rem/24px): admin page titles.
- **Title** (900, 1.125rem/18px): card headings, primary button labels, big choice tiles.
- **Body** (400, 1rem/16px, 1.625 line-height): instructions and help text. Form fields are always 16px so iOS Safari does not zoom on focus.
- **Label** (700, 0.875rem/14px): field labels, secondary buttons, notices, section labels. Sentence case, never uppercase.
- **Meta** (700 or 400, 0.75rem/12px): timestamps, counts, and badges only. Use `tabular-nums` where numbers line up.

### Named Rules
**The Three Weights Rule.** Only 400, 700, and 900 exist. Hierarchy comes from the jump to 900, not from new weights or new families.

**The No Tiny Shouting Rule.** No uppercase letter-spaced micro-labels. The one exception is the "Kids Church" brand line on the home page.

## Layout

Single column, mobile first, centred. The page gutter is 16px (`px-4`). Page containers are max-w-sm (384px) for the home kiosk, max-w-md (448px) for check-in and forms, and max-w-2xl (672px) for admin lists.

Vertical rhythm uses the 4px Tailwind scale: 16px between fields and cards (`space-y-4`), 24px between admin sections (`space-y-6`), and 24px inside cards (`p-6`). Pages reserve 96px of bottom padding (`pb-24`) so the floating help button never covers the last control.

Admin filters stack on phones and go three-across from `sm` (640px). Paired short fields (Birthday + Age) sit side by side with a fixed 6rem column for the short one.

## Elevation & Depth

Soft and lifted, like paper cut-outs on a sunny wall. Depth comes from pale blue-tinted shadows under white surfaces, never from grey drop shadows or borders alone.

### Shadow Vocabulary
- **Card lift** (`box-shadow: 0 10px 25px -8px rgb(191 219 254 / 0.7)`): every `card` surface.
- **Button lift** (`shadow-lg shadow-blue-200`): primary buttons and the home choice tiles.
- **Dialog float** (`shadow-2xl`, with a `rgb(15 23 42 / 0.45)` backdrop): native dialogs only.

### Named Rules
**The Tinted Shadow Rule.** Shadows are tinted with Cloud blue. A neutral grey drop shadow looks like a different product.

## Shapes

Everything is pillowy. Cards use the **Big Pillow** radius (2rem/32px). Controls, fields, tiles, and notices use the **Soft Pillow** radius (1rem/16px). Compact row actions and filter tabs use 0.75rem/12px. Badges, counters, and the help button are full pills or circles.

Borders are 2px Field Line on interactive surfaces and 1px on cards. Decorative circles come in two sizes. On parent pages they are 80–112px, partly clipped by the hero card's edge (`overflow-hidden`), at 60–70% opacity. On admin pages, `app/components/Decor.tsx` places 128–192px circles (Sunshine, Cloud, Bubblegum) at the page edges behind the content.

## Components

### Buttons
- **Shape:** Soft Pillow (16px), minimum 44px tall.
- **Primary:** Sunday Blue fill, white 900-weight label, Button lift shadow. Full-width inside forms and dialogs.
- **Hover / Focus / Press:** hover darkens to Sunday Blue Deep. Keyboard focus shows a 3px Sunday Blue outline offset 2px (global `:focus-visible`). Press scales to 0.97–0.98, and the scale is disabled under `prefers-reduced-motion`.
- **Secondary:** white fill, 2px Field Line border, Sunday Blue 900-weight label. Used for navigation pills and toggles.
- **Destructive / Pickup:** red-700 text on white with a red-200 border for "Check Out All". Pickup Orange on its tint for per-child Check Out.
- **Busy:** the label changes to the action in progress ("Checking in…", "Saving…"), and the button is disabled at 60% opacity.

### Choice Tiles (signature)
The big parent-facing options: 80–90px tall, Soft Pillow, a 900-weight title, one line of helper text, and a large emoji. The primary tile is Sunday Blue; the others are white with a Field Line border that turns blue on hover. They are used for Returning vs First Timer, service time, and age group.

### Cards / Containers
- **Class:** `card` (a Tailwind `@utility` in `app/globals.css`). Never re-type the recipe.
- **Corner / Background / Border:** Big Pillow, white, 1px Field Line (#dbeafe).
- **Shadow:** Card lift.
- **Padding:** 24px (`p-6`), or 16px for dense admin lists.
- **Status variants:** the empty, done, and error states on the returning-member page swap the border and shadow to yellow-100, green-100, or red-100 tints.

### Inputs / Fields
- **Style:** `inputClass` from `app/lib/ui.ts`: white, 2px Field Line border, Soft Pillow, 12px × 16px padding, 16px text, Whisper Ink placeholder.
- **Label:** `labelClass`, 14px 700 Body Ink, always visible above the field. Required fields show a red `*` hidden from screen readers and carry the `required` attribute.
- **Focus:** border turns Sunday Blue with a 4px blue-100 ring.
- **Error:** `aria-invalid` turns the border red-400, and the message sits directly under the field, linked with `aria-describedby`.
- **Mobile:** phone numbers use `type="tel"` and ages use `inputMode="numeric"`.

### Notices
`app/components/Notice.tsx`. Error: Oops Red on its tint with `role="alert"`, and it stays until the next action. Success: white on All-Good Green with `role="status"`, and it clears after 2.5–3 seconds.

### Dialogs
`app/components/Modal.tsx` wraps the native `<dialog>`, which provides the focus trap, Escape to close, and focus return. On open it focuses the panel, not the first field, so phones do not pop the keyboard. The panel scrolls within `100dvh - 2rem`. Clicking the backdrop closes it.

### Page Decor
`app/components/Decor.tsx` is used on admin pages, which have no hero card to hold circles. It needs a `relative` parent (the `<main>`) and a `relative` content container after it so content sits above the circles. Every admin `<h1>` also leads with one `aria-hidden` emoji (📋 Dashboard, 👥 Members, 🏷️ Age Groups, 📅 Past Sessions, ➕ New Member, ✏️ Edit Member).

### Help Button
A 56px Sunday Blue circle with a "?" fixed bottom-right on every page. It opens the step-by-step HelpWizard (emoji, title, one short paragraph, progress dots).

### Navigation
Admin sections use a row of equal-width secondary pills inside `<nav aria-label="Admin sections">`. Back links are text links (14px 700 Quiet Ink or Sunday Blue) padded to a 44px tap area. Internal links always use Next.js `<Link>`.

## Do's and Don'ts

### Do:
- **Do** use `bg-brand` / `hover:bg-brand-strong` for every primary action. Never type the hex.
- **Do** build surfaces from the `card` utility, fields from `inputClass`/`labelClass`, messages from `Notice`, and pop-ups from `Modal`.
- **Do** route every client request through `requestJson` in `app/lib/api.ts`, so failures become readable messages instead of stuck buttons.
- **Do** keep every tap target at least 44px (`min-h-11`) and every form field at 16px text.
- **Do** keep emoji and decorative circles on every page: hero-card circles on parent pages, `<Decor />` on admin pages. Always mark them `aria-hidden="true"`.
- **Do** say what happened and what to do next in errors ("Could not reach the server. Check your connection and try again.").
- **Do** respect `prefers-reduced-motion` on any scale or transform (`motion-reduce:`).

### Don't:
- **Don't** put Whisper Ink (#64748b) or anything lighter directly on the gradient canvas.
- **Don't** add a dark theme, a second font family, or weights other than 400/700/900.
- **Don't** use uppercase letter-spaced micro-labels (except the home "Kids Church" line).
- **Don't** nest a card inside a card. Use a divider or a tinted panel instead.
- **Don't** use `alert()` for errors; use `Notice`. `confirm()` is acceptable only for irreversible bulk or delete actions, and must name the count or item.
- **Don't** use grey drop shadows or zero-offset glows. Shadows are Cloud-tinted and offset downward.
- **Don't** spend Sunday Blue on decoration.
