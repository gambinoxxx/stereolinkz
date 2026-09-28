# UI Context

## Design References

The page designs in `docs/design/` (from `rateboard-pages.zip`) are the
visual spec. There is one HTML file per page and per drawer/modal
state. Each file starts with a comment describing its route, data,
actions and rules. Match their layout, copy, spacing and states. Open
`docs/design/index.html` for the full list.

| Page | Design file(s) |
| ---- | -------------- |
| Login | `login.html` |
| Dashboard | `dashboard.html` |
| Forex rates | `forex.html`, `forex-edit.html`, `forex-add.html` |
| POF rates | `pof.html`, `pof-edit.html`, `pof-add.html` |
| Banks | `banks.html`, `bank-add.html`, `bank-edit.html`, `bank-delete.html` |
| Templates | `templates.html` |
| Generator | `generator.html`, `generator-edited.html`, `generator-pof.html`, `generator-done.html` |
| History | `history.html`, `history-board.html`, `history-regenerate.html` |
| Settings | `settings.html` |

## Theme

Light only for the admin app. The admin is a calm, professional
operations tool: lavender-white page, white panels, a deep aubergine
sidebar, and one violet accent for actions. Gold is used sparingly, for
the active-nav marker, edited values, notes and the brand wordmark.

The generated boards are the expressive, public-facing product. They
use a deep purple gradient, a violet "buy" colour and a gold "sell"
colour, with their own token set (see Board Tokens).

## Colors

All admin components use these tokens (defined in `app/globals.css`
`@theme`). No hard-coded hex values.

| Role                          | CSS Variable              | Value     |
| ----------------------------- | ------------------------- | --------- |
| Page background               | `--bg-base`               | `#F6F4FA` |
| Surface (panels, drawers)     | `--bg-surface`            | `#FFFFFF` |
| Subtle surface (table header) | `--bg-subtle`             | `#FBFAFD` |
| Sidebar / mobile top bar      | `--bg-sidebar`            | `#1D0A38` |
| Primary text                  | `--text-primary`          | `#1F0B3F` |
| Secondary text                | `--text-secondary`        | `#5E5577` |
| Muted text                    | `--text-muted`            | `#8D84A3` |
| Primary accent (buttons, links, focus) | `--accent-primary` | `#5B2BC4` |
| Primary accent hover          | `--accent-primary-hover`  | `#4B21A6` |
| Accent soft (info callouts, step numbers) | `--accent-soft` | `#EFE9FB` |
| Gold (nav marker, edited input border) | `--accent-gold`  | `#E9B949` |
| Gold soft (note chips, warning callouts) | `--accent-gold-soft` | `#FBF1D9` |
| Gold text on gold soft        | `--accent-gold-text`      | `#86610F` |
| Border                        | `--border-default`        | `#E8E4F0` |
| Inner divider                 | `--border-subtle`         | `#F1EEF6` |
| Input border                  | `--border-input`          | `#DCD5E8` |
| Error / rate down             | `--state-error`           | `#C2413A` |
| Error soft                    | `--state-error-soft`      | `#FBEAE8` |
| Success / rate up / active    | `--state-success`         | `#0E8A5F` |
| Success soft                  | `--state-success-soft`    | `#E4F4EC` |

Sidebar text: `#C4B8E0` normal, `#FFFFFF` active or hover, `#9C8FC0`
secondary. Define these as `--sidebar-text`, `--sidebar-text-active` and
`--sidebar-text-muted`.

### Board Tokens (templates only, in `features/templates/theme.ts`)

| Role | Purple Signal | Daylight |
| ---- | ------------- | -------- |
| Background | gradient 165°: `#3B1675` → `#2A0F58` (45%) → `#1C0A3D` | gradient 170°: `#FFFFFF` → `#F3EEFB` (60%) → `#E9E1F7` |
| Headline text | `#FFFFFF` | `#3B1675` |
| Subheading / date | `#D4C8EE` / `#C4B6E3` | `#6E6187` |
| Rate card | `#F7F4FC` | `#FFFFFF` + 2px `#ECE5F7` border |
| Card text / muted | `#1F0B3F` / `#6E6187` | same |
| Card dividers | `#E6DFF2` | same |
| Buy / POF rate pill | `#6A35D9`, white text | same |
| Sell pill, notes, logo bars | `#E9B949`, `#1F0B3F` text | same |
| Contact panel | `rgba(255,255,255,.08)` + border `rgba(255,255,255,.14)` | `#2A0F58`, white text |
| Bottom band | 3:1 split `#6A35D9` / `#E9B949`, 22px | same |

Organization brand colours from Settings (background, buy/rates,
sell/highlights) override these at render time. They are copied into
the snapshot.

## Typography

| Role | Font | Variable |
| ---- | ---- | -------- |
| UI text | Archivo (variable: weight 400–900, width 62–125), via `next/font/google` | `--font-sans` |
| Board text | Archivo WOFF files (`latin` + `latin-ext`, weights 400–900) from `@fontsource/archivo`, committed in `assets/fonts/` for Satori | — |
| Numbers | Archivo with `font-variant-numeric: tabular-nums` | — |

No monospace font. Archivo has the ₦ glyph only in its `latin-ext`
subset, so `next/font` must load `subsets: ["latin", "latin-ext"]` and
Satori must load the `latin-ext` files too.

Satori ignores `font-stretch`. The board headline uses Archivo's normal
width in the PNG; the preview must match, so templates do not set
`font-stretch`.

Admin type scale:

| Use | Size / weight |
| --- | ------------- |
| Page title | 30px / 750, `font-stretch: 108%`, tracking −0.7px (25px on phones) |
| Panel title | 16px / 700 |
| Body | 15px / 400, line-height 1.45 |
| Table secondary, hints | 13–13.5px |
| Table header, chips | 12.5px / 600 |
| Rate values in tables | 16.5px / 700, tabular |
| Stat values | 27px / 750 (23px on phones) |

Board type scale (at 1080 × 1920):

| Use | Size / weight |
| --- | ------------- |
| Headline | 124px / 800, tracking −4px, line-height 0.92, two lines |
| Wordmark | 60px / 800 |
| Currency code | 66px / 900 |
| Buy/sell price | 68px / 800 |
| Bank name | 48px / 800 |
| POF rate | 56px / 800 |
| Subheading | 36px / 500 |
| Small print | 23px |

## Border Radius

| Context | Class |
| ------- | ----- |
| Chips, pills, switches, avatars | `rounded-full` |
| Inline / small UI (small buttons, flags inside tables) | `rounded-lg` (8px) |
| Buttons, inputs, selects, callouts | `rounded-[10px]` |
| Cards / panels / tables | `rounded-[14px]` |
| Template cards | `rounded-2xl` (16px) |
| Modals | `rounded-[18px]`; bottom sheets on phones `rounded-t-[20px]` |
| Board preview frame | `rounded-[10px]` |

## Component Library

shadcn/ui on top of Tailwind v4, themed with the tokens above.
Components live in `components/ui/`; add them with the shadcn CLI.
Components used:

- Button (primary, secondary/outline, ghost, destructive; sizes default 40px, sm 32px, icon 34px)
- Input (42px) with prefix/suffix add-ons (`₦`, `%`)
- Select, Textarea, Switch, Checkbox
- Tabs / ToggleGroup (segmented filters: All / Active / Inactive, Forex / POF)
- Sheet (edit drawers: right side on desktop at 460px, bottom sheet under 760px)
- Dialog (board detail, regenerate, delete confirmation)
- Sonner (toasts, bottom centre)
- Tooltip, Badge (status chips)

Project components (not shadcn):

- `components/shell/*`: sidebar, mobile top bar, bottom tab bar, page header
- `components/board/BoardFrame`: renders a template at 1080 × 1920 and scales it to its container
- `components/board/WhatsAppOverlay`: preview-only overlay (progress bars, name, caption, Reply bar); never part of the PNG
- `RateDelta`: up/down arrow with amount, green/red, "No change" in muted
- `StatusSwitch`, `BankMark` (logo or letter monogram), `CurrencyFlag` (bundled SVG by `flagCode`)

## Layout Patterns

- **App shell (≥ 900px):** fixed 248px sidebar on the left (brand,
  nav, separators, user block at the bottom). Content area max-width
  1200px, padding 34px 40px.
- **App shell (< 900px):** sticky 56px top bar (brand + menu button)
  and a fixed bottom tab bar (Home, Forex, POF, Generate [raised
  violet], More). Content padding 22px 16px 120px. The sidebar becomes
  a slide-in drawer.
- **Page header:** title and one-line description on the left, actions
  on the right. On phones the actions fill the width.
- **Tables:** grid rows inside a 14px-radius panel with a subtle header
  row. Under 760px each row becomes a card: name and Edit on top, two
  labelled values and the status below.
- **Edit flows:** always a drawer (Sheet) over the table, never a new
  page. Footer has Cancel and a primary action. Enter saves.
- **Dashboard:** 4-cell stat strip, then two rows of two panels (1.3fr / 1fr), stacking under 1100px.
- **Generator:** two columns (steps | 400px sticky preview). Under
  900px the preview goes on top (max 220px wide) and the Generate bar
  sticks above the bottom tab bar.
- **Settings:** sections with a 260px label column and a form panel.
- **Callouts:** violet-soft for info, gold-soft for "will be saved"
  warnings.
- **Board safe area:** a board is 1080 × 1920. The top 150px sits under
  WhatsApp's progress bar and name, and roughly the bottom 320px sits
  under the caption and Reply bar. Only decoration (the bottom band) or
  small print may sit in those zones.
- **Motion:** only drawer/modal slide, toast entrance and the generate
  spinner. Respect `prefers-reduced-motion`.

## Icons

Lucide React, stroke icons only, `strokeWidth={1.9}`. Sizes:
`h-4 w-4` inline and in small buttons, `h-[18px] w-[18px]` in nav,
`h-5 w-5` in the bottom tab bar.

Mapping:

| Use | Icon |
| --- | ---- |
| Dashboard | `LayoutGrid` |
| Forex | `ArrowLeftRight` |
| POF | `Percent` |
| Banks | `Landmark` |
| Generator / Generate | `Sparkles` |
| History | `History` |
| Templates | `Layers` |
| Settings | `SlidersHorizontal` |
| Edit | `Pencil` |
| Download | `Download` |
| Regenerate | `RefreshCw` |
| View | `Eye` |
| Delete | `Trash2` |
| Reorder handle | `GripVertical` |
| Rate up / down | `ArrowUp` / `ArrowDown` |
| Callouts | `Info` |

Flags on boards are bundled SVGs, not emoji (emoji flags render
unreliably in SVG).
