# UI Design Language

## Product Tone

This MVP should feel like lead intelligence software, not a consumer social app.

The interface should communicate:

- signal detection
- focus
- credibility
- speed
- operational clarity

The visual tone is dark, restrained, and technical. It should feel modern without looking decorative or trend-driven.

## Core Design Direction

- Use a dark-neutral base with high-contrast text.
- Keep layouts clean and structured.
- Use one main accent color to represent signal and discovery.
- Prefer subtle depth, borders, and layered backgrounds over loud effects.
- Make screens feel like tools for operators reviewing opportunities.
- Use `shadcn/ui` components as the default UI foundation.

## Color System

### Base

- Background: `#0B0F0E`
- Surface: `#111716`
- Elevated Surface: `#161D1B`
- Border: `#27312E`

### Text

- Primary Text: `#F3F5F4`
- Secondary Text: `#9DA9A4`
- Muted Text: `#6F7C77`

### Accent

- Primary Accent: `#7BF179`
- Strong Accent: `#4ADE80`
- Accent Glow: `rgba(123, 241, 121, 0.18)`

### Utility

- Warning: `#F5C451`
- Error: `#F87171`
- Info: `#7DD3FC`

## Visual Language

- Backgrounds should not be flat.
- Use soft gradients, grid textures, or faint signal/radar motifs.
- Cards should feel compact and intentional.
- Borders should be visible but understated.
- Shadows should be soft and low-spread, not heavy.
- Avoid glossy or glassmorphism-heavy styling.

## Typography

- Use a clean, modern sans-serif for primary UI text.
- Headings should feel firm and slightly tight.
- Body copy should be compact and readable.
- Avoid oversized marketing-style typography.
- Prefer short, direct labels and descriptions.

## Layout Principles

- Prioritize fast scanning.
- Keep content width controlled.
- Use strong spacing rhythm rather than oversized padding everywhere.
- Desktop layouts can use split panels or dense dashboard sections.
- Mobile layouts should stack cleanly without losing hierarchy.

## Components

### Component System

- Use `shadcn/ui` as the primary component library.
- Prefer extending `shadcn/ui` components with tokens and utility classes rather than building ad hoc primitives for each screen.
- Keep component styling consistent across auth, dashboard, settings, and lead detail pages.
- Favor composition with `Card`, `Button`, `Input`, `Badge`, `Dialog`, `DropdownMenu`, `Table`, and `Toast` primitives from `shadcn/ui`.
- Avoid mixing multiple visual systems in the same screen.

### Buttons

- Primary actions should use the accent color.
- Secondary actions should use muted surfaces with clear borders.
- Hover and focus states should be obvious and crisp.
- Default button implementations should come from `shadcn/ui` and then be themed to match this design language.

### Inputs

- Inputs should feel precise and structured.
- Use dark surfaces with clear borders and strong focus states.
- Error states must be readable without relying only on color.
- Use `shadcn/ui` `Input`, `Label`, and form primitives where possible.

### Cards

- Use cards to group data and actions.
- Keep corners modestly rounded.
- Prefer bordered cards with subtle elevation.
- Use `shadcn/ui` card primitives for auth panels, settings sections, and lead summaries.

### Tables and Lists

- Leads and campaign data should optimize for scanability.
- Use row separation, muted metadata, and clear score/status emphasis.
- Use `shadcn/ui` tables and badges as the baseline for data-heavy screens.

## Motion

- Keep motion minimal and meaningful.
- Use soft fade, slight slide, or staggered reveals.
- Avoid bouncy interactions or decorative animations.

## Auth Page Direction

The auth page should immediately communicate the product category.

Recommended structure:

- Left side: product value, short proof points, visual atmosphere
- Right side: auth form card

Recommended supporting copy:

- "Track buyer intent across Reddit"
- "Qualify leads with AI"
- "Get alerted before the thread goes cold"

Implementation note:

- Auth forms, buttons, separators, and toast errors should use `shadcn/ui` components.

## MVP Screen Feel

### Campaigns

Should feel structured and configurable, with clear filters and setup fields.

### Leads Inbox

Should feel like an intelligence queue. Emphasize score, source, summary, and status.

### Lead Detail

Should feel analytical. Show Reddit context, extracted pain points, and qualification notes clearly.

### Settings

Should feel simple and operational, especially for alerts and account preferences.

## What To Avoid

- Bright SaaS gradients on white backgrounds
- Generic purple branding
- Overly playful illustrations
- Social-media-style visuals
- Excessive blur effects
- Over-animated components
- Marketing-site styling inside application screens
- Mixing `shadcn/ui` with unrelated component styling conventions on the same page

## Design Rule

Every screen should answer this feeling test:

"Does this look like a tool that helps me detect valuable opportunities quickly?"

If not, simplify and make it more operational.
