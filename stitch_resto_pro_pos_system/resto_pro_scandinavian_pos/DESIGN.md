---
name: Resto Pro Scandinavian POS
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8fd'
  surface-container-highest: '#dce2f7'
  on-surface: '#141b2b'
  on-surface-variant: '#3d4a42'
  inverse-surface: '#293040'
  inverse-on-surface: '#edf0ff'
  outline: '#6d7a72'
  outline-variant: '#bccac0'
  surface-tint: '#006c4a'
  primary: '#006948'
  on-primary: '#ffffff'
  primary-container: '#00855d'
  on-primary-container: '#f5fff7'
  inverse-primary: '#68dba9'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#825100'
  on-tertiary: '#ffffff'
  tertiary-container: '#a36700'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#85f8c4'
  primary-fixed-dim: '#68dba9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f9f9ff'
  on-background: '#141b2b'
  surface-variant: '#dce2f7'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
  numeric-display:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.25rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system embodies modern Nordic hospitality engineering: grounded, hyper-functional, warm, and uncluttered. It bridges high-volume tactile execution (rapid tablet-based point-of-sale terminals and grease-resistant Kitchen Display Systems) with guest-facing refinement (frictionless QR self-ordering and VIP loyalty dashboards).

The style fuses **Modern Tactile Minimalism** with **Clean Ergonomic Density**:
- **Nordic Clarity:** Prioritizes generous negative space, intentional typography hierarchy, and a quiet, calming palette dominated by crisp organic whites, sage-tinted micro-surfaces, and muted moss undertones that reduce cognitive fatigue during peak dinner service rushes.
- **Physical Affordance & Touch Readiness:** Interactive components feature oversized hit targets (minimum 48x48px on POS screens, expanding to 56px for critical quick-actions), deep micro-states, and subtle spring-damped tactile presses that give servers instant sensory confirmation without interface bloat.
- **Dual Environmental Paradigms:** Operates cleanly under daylight bistro conditions with breathable, light-mode sage surfaces, while switching effortlessly into an ultra-high-contrast slate-dark mode tailored to humid, dimly lit kitchen lines where readability through peripheral vision is paramount.

## Colors

The color system is calibrated for precision status signaling, visual composure, and ambient hospitality environments.

### Core Swatches
- **Primary Emerald (`#059669`):** The functional spine. Applied to primary POS tenders, confirmation buttons, completed order steps, and active system actions.
- **Secondary Mint (`#10B981`):** High-visibility accent utilized for active states, fresh modifier badges, toggle switches, and real-time connectivity indicators.
- **Tertiary Amber Gold (`#F59E0B` / `#D97706`):** Reserved for VIP tier statuses, active SaaS subscription highlights, pending table calls, and time-critical kitchen tickets approaching late thresholds.
- **Neutral Charcoal Slate (`#111827` / `#1F2937`):** Deep, legible text foundation avoiding the stark harshness of pitch black, providing comfortable contrast against light sage and white containers.

### Contextual Status System (Tables & KDS)
- **Available / Clean:** Soft Sage background (`#ECFDF5`), Emerald boundary (`#059669`), Slate typography (`#065F46`).
- **Occupied / Dining:** Soft Rose tint (`#FFF1F2`), Crimson boundary (`#E11D48`), Deep Cherry text (`#9F1239`).
- **Bill Requested / Payment Pending:** Pale Amber wash (`#FFFBEB`), Warm Marigold boundary (`#F59E0B`), Deep Umber text (`#92400E`).
- **KDS Overdue Ticket:** High-contrast vermilion strobe ring (`#DC2626`) on slate backing.

### Functional Surfaces & Dark Mode KDS
Light mode relies on `#F8FAF9` for the canvas base, `#FFFFFF` for primary cards, and `#F0FDF4` for highlighted sidebar trays. 
For KDS deployment, backgrounds flip to `#0F172A` (Obsidian Slate), container surfaces settle at `#1E293B` (Muted Steel), and borders lift to `#334155`, creating maximum legibility against food heat lamps and harsh industrial overheads.

## Typography

Typography balances rapid scanning with modern hospitality warmth.

- **Plus Jakarta Sans** provides structural character and rounded modern warmth for primary category headers, guest-facing menus, POS totals, table numbers, and KPI statistics.
- **Inter** handles high-density informational tasks: order modifiers, receipt listings, operational timestamps, and fine-print ingredient allergens. It maintains exceptional glyph differentiation under fast glancing angles.
- **Tabular Figures & Metrics:** All numeric tokens (prices, counts, table timers, split-bill subtotals) must implement OpenType `tnum` (tabular numbers) to eliminate layout jitter when quantities mutate in real-time.
- **Vertical Rhythm:** Line heights follow tight multiples of 4px to maintain compact line-item grouping within receipt feeds without sacrificing legibility for waiters processing tables under pressure.

## Layout & Spacing

The layout is built around responsive, touch-first ergonomics structured across an adaptive grid.

### Grid Architectures
- **Desktop / Service Station (≥ 1280px):** 12-column layout with 24px gutters and 32px margins. Employs a persistent 3-zone structure: Category Navigation (220px fixed rail), Item Canvas (flexible 6-column grid), and Dynamic Ticket Cart (380px fixed right rail).
- **Tablet POS / Kitchen Monitor (768px – 1279px):** 8-column layout with 20px gutters and 24px margins. Category tabs condense into a top horizontal snap-scroll rail; the receipt checkout rail docks into a persistent 320px column or bottom drawer depending on horizontal vs. vertical orientation.
- **QR Self-Order Mobile (≤ 767px):** 4-column fluid layout with 16px gutters and 16px margins. Maximizes vertical scrolling single-column card flows with a sticky bottom summary bar elevated above device gesture areas (minimum safe-area padding: 20px).

### Touch Ergonomics & Spatial Rules
- Touch targets must adhere to an absolute minimum of 44x44px, with primary POS item tiles scaled to at least 96x96px to facilitate error-free finger tapping.
- Gap relationships prioritize gestalt proximity: modifiers within an order item use `space-xs` (4px), line items inside an order card use `space-sm` (8px), and distinct order tickets maintain `space-md` (16px) separation.

## Elevation & Depth

Visual hierarchy uses **tonal layering and organic, low-opacity ambient shadows** rather than high-contrast structural dividers, maintaining an airy Scandinavian feel.

### Surface Tiers
- **Canvas Base (`Level 0`):** Soft Sage tint (`#F8FAF9` / `#F0FDF4`). Neutral ground that absorbs ambient glare.
- **Surface Level 1 (`Cards & Tiles`):** Crisp pure white (`#FFFFFF`) with a hairline border (`1px solid #E5E7EB`). Floated with `shadow-sm` (`0 1px 3px rgba(17, 24, 39, 0.04), 0 1px 2px rgba(17, 24, 39, 0.02)`).
- **Surface Level 2 (`Active Modals, Sliding Panels & Drawers`):** Elevated pure white containers featuring `shadow-lg` (`0 10px 25px -5px rgba(5, 150, 105, 0.06), 0 8px 10px -6px rgba(17, 24, 39, 0.04)`), softly tinted with the brand's emerald hue to simulate natural light refraction.
- **Surface Level 3 (`Popovers, Context Dropdowns & Quick Alerts`):** Raised pure white with `shadow-xl` (`0 20px 30px -10px rgba(17, 24, 39, 0.08)`) and high-contrast boundary definition (`1px solid #D1D5DB`).

### KDS High-Contrast Inversion
In Kitchen Display mode, elevation shifts from shadow-depth to **luminance bounding**:
- Base layer uses obsidian black-slate (`#0F172A`).
- Active tickets sit on `#1E293B` bordered with 2px stroke indicators keyed directly to course timing (green for fresh, amber for prep, pulsing rose for delayed). Depth via drop shadows is completely removed to prevent screen glare.

## Shapes

The design system adopts a balanced **Rounded (`2`)** geometry that feels welcoming yet structurally anchored:
- **Base Components (Input fields, table cards, order buttons):** Styled with an 8px (`0.5rem`) corner radius.
- **Containers & Large Panels (Receipt columns, food category modals):** Styled with a 16px (`1rem`, `rounded-lg`) corner radius.
- **Micro Badges, VIP Tags, and Status Chips:** Styled as full geometric capsules (`rounded-full` / `9999px`), creating strong shape distinction between informative badges and interactive square action blocks.
- **Corner Consistency:** Inner nested elements must scale their border radius downward relative to outer containers (e.g., a card with 16px radius containing an internal button must use an 8px radius to keep concentric alignment natural).

## Components

### Buttons & Quick Triggers
- **Primary Order Action:** Solid Emerald Green (`#059669`) fill, crisp white typography, subtle hover transition (`#047857`), and a dynamic tactile active state that scales the element to `0.98` with an inset shadow. Height: 48px standard, 56px for "Charge" or "Send to Kitchen".
- **Secondary Actions:** Sage surface (`#ECFDF5`), bold Emerald border (`1px solid #A7F3D0`), Emerald text (`#065F46`).
- **Destructive / Void Actions:** Pale rose background (`#FFF1F2`), Crimson outline, Crimson text (`#E11D48`). No solid red fills unless confirming a final cancellation modal.

### Status Chips & VIP Badges
- **Table Indicators:** Rounded capsule pill (`rounded-full`) with a leading 6px pulsing dot. 
  - *Available:* Green tint (`#ECFDF5`), Emerald text.
  - *Seated:* Slate tint (`#F3F4F6`), Charcoal text.
  - *Bill Requested:* Amber tint (`#FEF3C7`), Warm Gold text (`#B45309`).
- **VIP & SaaS Licensing Chips:** Metallic Amber gradient backdrop (`linear-gradient(135deg, #F59E0B 0%, #D97706 100%)`), sharp white text, subtle golden drop shadow glow (`0 2px 8px rgba(245, 158, 11, 0.3)`).

### Input Fields & Keypads
- Text and search inputs feature a soft gray border (`#E5E7EB`), crisp white background, and a 2px Emerald glow ring on focus (`ring-2 ring-emerald-500/20 border-emerald-600`).
- Numerical POS Numpads (for manual pricing and split payments) utilize high-impact grid keys with 52px minimum height, 18px bold tabular typography, and audible/haptic feedback loops.

### Lists & Receipt Feeds
- High-density list items bordered by subtle horizontal dividers (`#F3F4F6`).
- Modifier sub-items nested 16px to the right, rendered in `label-md` with slate-gray muted coloration (`#6B7280`).
- Item quantity buttons are integrated directly into list rows as connected pill steppers (`-` / `count` / `+`) with 36px touch squares.

### Cards & Grid Containers
- **Menu Item Cards:** Crisp white background, subtle hairline border, top-half image container with smooth 8px top-radius clipping, bottom content padded with `space-md` containing item title, dietary badges, and price tag in `numeric-display` typography.
- **KDS Ticket Columns:** Header bar color-coded by ticket urgency. Content area presents bold, high-contrast monospace dish listings with crossed-out modifier states for allergy awareness.