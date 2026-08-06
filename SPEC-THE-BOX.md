# Build spec: The Box

A task app for people whose attention is a scarce resource. The concept in one line:
a box that never forgets your tasks and never shows you the pile. You put things in,
and when you have energy, you ask it for exactly one thing back.

The working prototype (plain form UI) is in this repo as `reference.html`. Its logic,
storage model and copy are the specification for behaviour. Your job is to rebuild the
interface around a single visual object: the box itself. Read `reference.html` first.

## The philosophy, because it constrains every decision

The users this is for are depleted: full-time jobs, kids, attention disorders. Every
mainstream task app punishes them with the sight of everything they have not done.
This app's entire value is what it refuses to do:

- It never shows a list. Not a count, not a badge, not a progress bar. Ever.
- It never measures. No streaks, no timestamps shown, no "added 3 weeks ago".
- It never pushes. No notifications, no "one more?", no gamification.
- Stopping is always presented as a legitimate outcome, not a failure state.

If any interaction you build makes the user feel behind, it is wrong, even if it is
standard practice. When in doubt, the box stays silent.

## Tech constraints

- One `index.html`, one `style.css`, one `app.js`. Vanilla JS, no framework, no build
  step. Plus `manifest.json`, `sw.js` and icons copied unchanged from the reference
  folder so it stays installable as a PWA.
- All state in localStorage under one key, same schema as the reference so existing
  users keep their tasks: `{ tasks: [...], current: id|null }`, task =
  `{ id, text, effort 1-3, repeat 0|1|7|30 (days), sleepUntil timestamp, added }`.
- Wrap all storage access in try/catch with an in-memory fallback and a small notice
  when storage is blocked (the reference shows how).
- Works offline once installed, works from file://, works on a 380px-wide phone screen
  first. The phone is the primary device; the desktop layout is just the phone layout
  with more air around it.

## The visual concept: the box is the interface

There is no navigation, no tabs, no menu. The screen holds one thing: a box, drawn
large, centered, sitting on a groundline. Everything begins by touching it.

**Style: visual but not colourful.** Near-monochrome. Charcoal background, off-white
line work, at most one muted accent used sparingly (a desaturated warm tone for the
lid seam and focus states, nothing else). The feel to aim for: a woodcut illustration
or a fine-line etching, an object of some weight and dignity, drawn in strokes, not a
flat-design cardboard emoji and not a skeuomorphic render. Draw the box as inline SVG
so it can be animated part by part (lid, body, seam, shadow).

The box has states, expressed through the drawing, never through text or numbers:

- **Idle.** Closed, still. A very slow, subtle idle motion is welcome (a shadow that
  breathes over ~8 seconds) so it feels present, but it must be barely noticeable and
  fully disabled under `prefers-reduced-motion`.
- **Open for input.** Lid tilts open toward the viewer.
- **Open for output.** Lid tilts away, as if you are reaching in.
- **Holding a hand-off.** When a task is currently out (see Resume below), the box sits
  with its lid very slightly ajar, a thin line of the accent tone at the seam. This is
  the only persistent state signal in the whole app, and it says "something of yours is
  out", nothing more.

The box never changes size or appearance based on how many tasks it holds. A box with
one task and a box with eighty look identical. That is the point of it.

## Interaction flow

### 1. Touching the box

Tap or click the box (the whole SVG is one button, keyboard-focusable, Enter/Space
activate it). The lid cracks open and two choices fade in, one on either side of it
or above and below on narrow screens:

- **Put something in**
- **Take something out**

Plain text buttons, quiet styling. Pressing Escape or tapping elsewhere closes the
lid and returns to idle. If the box is empty and the user chooses "take something
out", the box opens, shows nothing inside, and says: "The box is empty. Nothing is
waiting. Enjoy that." Then closes.

### 2. Putting something in

A single text field slides up in front of the open box, focused immediately, with
the placeholder "e.g. call the dentist". Below it, two quiet chip rows:

- Weight: Light / Medium / Heavy (default Light)
- Comes back? One-off / Daily / Weekly / Monthly (default One-off)

One confirm control: "Into the box".

On confirm, animate the essential moment of the whole app: the text itself, the
actual words the user typed, drifts down into the open box, the lid closes over it,
and a one-line confirmation appears: ""Call the dentist" is in the box. You can
forget it now." Then the field clears and stays open for another task, because
people empty their head in bursts. The lid stays open between entries; it closes
when the user dismisses the input (Escape, tap elsewhere, or a small "done for now"
link under the field).

Duplicate rule, from the reference: if the normalized text (lowercase, collapsed
whitespace) matches an existing task, nothing is added. The box refuses gently:
""Call the dentist" is already in the box. It hasn't been forgotten." If the match
is a sleeping recurring task: "...already in the box, resting until its next time
comes round." This matters because re-typing a task is the intended way to check
whether you already put it in.

### 3. Taking something out

The lid opens away from the viewer, and one question appears:

**"What have you got right now?"**

Three choices, exact copy:
- Running on fumes
- Something left
- Actually fresh

Selection rules, from the reference: available tasks are those whose `sleepUntil` is
absent or past. Filter to `effort <= energy`. Oldest `added` first, so nothing rots
in the box forever. Skipped tasks ("Not this one") are excluded until the pool for
that energy is exhausted, then allowed back.

The reveal is the second essential moment: the chosen task's text rises out of the
open box and settles large in the center of the screen, the box receding smaller
beneath it. The task text is the biggest thing on the screen, set in the display
serif. Under it, one quiet line, e.g. "This is a light one. The box is holding the
rest so you don't have to." (Recurring tasks add "comes back daily/weekly/monthly".)

Three controls:
- **Done** (primary)
- **Not this one** (swaps for the next candidate; if none fits: "That's the only
  thing that fits your energy right now. Do it, or rest. Both are fine.")
- **Back to the box** (returns it, no comment, no penalty)

If nothing fits the chosen energy at all, the box closes gently and says: "Nothing
fits the energy you have. Everything left needs more than you've got right now, and
that's a fine reason to do none of it. Rest is allowed." If tasks exist but all are
asleep: "Everything is asleep. The recurring things will wake up when their time
comes." These screens must feel like permission, not like an error page.

### 4. Done

On Done: a one-off task is gone for good; a recurring task gets
`sleepUntil = now + repeat days` and sinks back into the box visually. Then, exact
copy: "Done. That's one more than none. You can stop here. Nothing is keeping score.
If you've still got something in the tank, ask the box again." The box returns to
idle. Do not auto-offer the next task. Stopping is the default; continuing is a
choice the user makes by touching the box again.

### 5. Resume, the hand-off that survives closing the app

When a task is handed out, `current` is saved immediately. If the app is opened
while `current` points to an existing task, do not show the idle box: show that task
already out, under the heading "Still yours", with the line "You took this out
earlier. However long it took is however long it took." Same three controls. Tasks
take hours and phones get closed; the box holds the hand-off without comment. No
elapsed time is ever shown or stored beyond what the schema already has.

### 6. Emptying the box

One quiet text link, bottom of the screen, small: "Empty the box completely". One
confirm dialog ("Everything in it will be gone for good."), then everything is
cleared, including `current`. No other management UI exists. No editing, no viewing,
no reordering. If that feels like a missing feature, re-read the philosophy section.

## Copy rules

The app speaks in a calm, plain voice, always addressing one tired person. All user-
facing copy is quoted above or present in `reference.html`; reuse it verbatim. If you
must write a new line, match the register: short sentences, no exclamation marks, no
productivity vocabulary (crush, win, goal, streak, productive), and never an em dash.
The footer keeps the promise, verbatim: "Everything stays in this browser, on this
device. No account, no cloud, no streaks, no notifications, and the box never shows
you everything at once."

## Typography and motion

- Display serif for the box's speech, task reveals and headings (Newsreader or
  similar, light weights). A humanist sans (Karla or similar) for controls. These are
  already wired in the reference; keep the pairing.
- Motion is the product's language, so it must be good: 300-500ms, eased like a real
  lid and real paper (cubic-bezier, slight settle), never bouncy, never springy.
  Everything meaningful (lid, task drift, reveal) uses it. Every animation has a
  reduced-motion fallback that cuts to the end state instantly.
- Focus states visible on everything interactive. The box, the chips and the buttons
  must all be reachable and operable by keyboard alone.

## Definition of done

- All flows above work: in, out, duplicate refusal, energy filter, skip, done,
  recurring sleep and wake, resume after close, empty.
- Existing localStorage data from the reference app loads without migration.
- No count, list, badge or progress indicator anywhere, in any state.
- No em dash anywhere in the UI.
- Lighthouse-installable as a PWA; works offline after first load.
- The box drawing looks like it was made with intent. If it reads as a generic
  cardboard-box icon, iterate on the SVG until it does not.
