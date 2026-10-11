---
name: SBFinance
description: Personal finance manager. An operate surface — scan, compare, act — calm and consistent in light and dark.
colors:
  background: "hsl(0 0% 100%)"
  foreground: "hsl(240 10% 3.9%)"
  card: "hsl(0 0% 100%)"
  primary: "hsl(240 5.9% 10%)"
  primary-foreground: "hsl(0 0% 98%)"
  muted: "hsl(240 4.8% 95.9%)"
  muted-foreground: "hsl(240 3.8% 46.1%)"
  border: "hsl(240 5.9% 90%)"
  success: "hsl(142 72% 29%)"
  destructive: "hsl(0 74% 45%)"
  warning: "hsl(26 90% 37%)"
  info: "hsl(201 96% 32%)"
  status-foreground: "hsl(0 0% 98%)"
  dark-background: "hsl(224 7% 11%)"
  dark-foreground: "hsl(210 20% 98%)"
  dark-muted: "hsl(226 10% 17%)"
  dark-muted-foreground: "hsl(220 9% 56%)"
  dark-success: "hsl(142 69% 45%)"
  dark-destructive: "hsl(0 91% 71%)"
  dark-warning: "hsl(32 95% 44%)"
  dark-info: "hsl(199 89% 48%)"
  dark-status-foreground: "hsl(224 9% 11%)"
  chart-1: "#2a78d6"
  chart-2: "#eb6834"
  chart-3: "#1baf7a"
  chart-4: "#eda100"
  chart-5: "#e87ba4"
  chart-6: "#008300"
  chart-7: "#6250d6"
  chart-8: "#e34948"
typography:
  page-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  section-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  stat-value:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    fontFeature: "tnum"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  gutter: "16px"
  page-y: "32px"
  section: "24px"
  grid-gap: "16px"
  card-padding: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "40px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.status-foreground}"
    rounded: "{rounded.md}"
    height: "40px"
  icon-button:
    rounded: "{rounded.md}"
    size: "40px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"
  stat-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.stat-value}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"
---

# Design System: SBFinance

## Overview

**Creative North Star: "The Quiet Ledger"**

SBFinance is a tool people open to check a number and do one thing: log an expense, see whether the budget holds, settle a card. Every page is an **operate surface**. It should be scannable in seconds, the same from page to page, and calm enough that the one red number is the thing you notice. This is "Generation B" of the app's look, taken from the Analytics, Investments, Certificates, Credit cards and Loans pages: flat token-based surfaces, one card per idea, color only where it means something.

Density is medium: 16px gutters, 24px between sections, 16px between cards. Hierarchy comes from size and weight, never from gradients or glow. Light and dark are both first-class (`next-themes`, `defaultTheme='system'`); every color is a CSS token that changes per mode, so nothing in feature code says `dark:`.

**Key Characteristics:**
- Plain `bg-background` pages in a fixed shell (`PageShell` + `PageHeader`). No page-wide gradient wash.
- One h1 per page, the plain section name ("Cuentas", not "Gestión de Cuentas").
- KPIs are flat `StatCard`s in a `StatGrid`. No gradient tiles and no big centered icon tiles.
- Money is always `<Amount>`: semantic color + sign + tabular figures.
- Every list has an empty state, every query has an error state, every destructive action has a `ConfirmDialog`.
- Motion is rare and respects reduced motion app-wide (`MotionConfig reducedMotion='user'`).

## Colors

Neutral zinc ink on white (light) and Linear-style blue-gray ink on near-black (dark). Hue is reserved for meaning: status and data.

All tokens live in `styles/globals.css` as HSL triplets (`--success: 142 72% 29%`) and are exposed to Tailwind as `bg-success`, `text-success`, `border-success/50`, etc. The frontmatter lists the light values plus the dark values that differ.

### Primary
- **Ink Black / Paper White** (`primary`): primary buttons, the active nav item, focus rings. Near-black in light, near-white in dark, so the primary action is the highest-contrast thing on screen without needing a brand hue.

### Status (semantic, reserved)
- **Ledger Green** (`success`): income, gains, "paid", positive deltas.
- **Ledger Red** (`destructive`): expenses, losses, overspent, errors, delete.
- **Amber** (`warning`): approaching a limit (80–100% of a budget), due soon.
- **Ink Blue** (`info`): neutral notices.

Each status color works both as **text on the page background** and as a **fill with its `-foreground` on top**, at ≥4.5:1 in both modes:

| Token | Light (text on white / with foreground) | Dark (text on background / with foreground) |
|---|---|---|
| destructive | 5.75 / 5.51 (was 3.76 / 3.60) | 6.26 / 6.28 (was 1.72) |
| success | 5.07 / 4.85 (was 3.35 / 3.21) | 7.33 / 7.35 (was 3.69) |
| warning | 5.04 / 4.83 (was 2.14) | 5.46 / 5.69 (unchanged) |
| info | 5.94 / 5.68 (was 2.85 / 2.73) | 6.03 / 6.05 (foreground was 2.73) |

Light mode uses a dark hue with a white foreground; dark mode uses a light hue with a **dark** foreground (`224 9% 11%`). White text on a red light enough to read on the dark background cannot reach 4.5:1, so dark-mode destructive/success buttons have dark labels. Never hardcode `text-white` on a status fill; use the `-foreground` token.

### Neutral
- **Background / Card / Popover** (`background`, `card`, `popover`): page and surfaces; the same value, separated by a 1px `border`.
- **Muted** (`muted`, `secondary`, `accent`): soft fills (icon circles, hover, skeletons, progress track).
- **Muted ink** (`muted-foreground`): secondary text, labels, icons in StatCards. 4.83:1 on white, 5.05:1 on dark background (4.27:1 on dark `muted` fills: avoid long muted text on muted fills in dark mode).
- **Border / Input** (`border`, `input`): hairlines, input strokes, chart grid.

### Data (charts)
- **Series 1–8** (`chart-1` … `chart-8`, Tailwind `bg-chart-1` …): the categorical chart palette, validated for color-vision deficiency in this order (adjacent CVD ΔE ≥ 8.4, normal-vision ΔE ≥ 19.3, both modes). Dark mode has its own steps. Category colors chosen by users (category `color`) are user data and are used as-is.

### Named Rules
**The Semantic Money Rule.** Income/expense, gain/loss and over/under are colored only through `<Amount>` or the `success` / `destructive` / `warning` tokens. Never `text-green-600`, `text-red-500`, `bg-emerald-50`, `text-rose-…` or any raw palette class in feature code. Color is never the only cue: keep the sign and/or an arrow icon.

**The Reserved Hue Rule.** Status colors never decorate (no green "success" headers, no red section titles) and never stand in for a chart series. Charts use `chart-1…8`, except income/expense series, which use `colors.positive` / `colors.negative`.

**The No-Gradient Rule.** No gradient backgrounds, gradient text or glowing halos on app surfaces. The landing page (`app/page.tsx`) is out of scope.

## Typography

**Body Font:** Inter (`--font-inter`, via `next/font`), falling back to the system UI sans.
**Display Font:** the same Inter, bolder. (Plus Jakarta Sans, `.font-jakarta`, is loaded for the landing page only.)

**Character:** One neutral grotesque at every level, so numbers and labels line up and nothing competes with the data.

### Hierarchy
- **Page title** (700, 30px / `text-3xl font-bold tracking-tight`): the h1 in `PageHeader`. Exactly one per page.
- **Section title** (600, 20px / `text-xl font-semibold`): h2 for page sections and full-size empty/error states.
- **Card title** (600, 18–24px, `CardTitle`): renders an h3. Fine under an h2 section; when a card sits directly under the h1, keep it (h1→h3 is tolerated for cards) or pass a smaller class, but don't introduce extra h1/h2s.
- **Stat value** (600, 24px / `text-2xl font-semibold tabular-nums`): KPI numbers.
- **Body / label** (400–500, 14px / `text-sm`): almost all UI text.
- **Caption** (400, 12px / `text-xs text-muted-foreground`): hints, timestamps, chart captions.

### Named Rules
**The Tabular Figures Rule.** Any number that can sit next to another number (amounts, percentages, counts in tables, KPI values) uses `tabular-nums`. `<Amount>` and `StatCard` do this for you.

**The One H1 Rule.** The page's h1 comes from `PageHeader`. The sidebar brand ("SBFinance") and the top bar section label are not headings.

## Layout

- **App shell:** sidebar (256px expanded / 64px collapsed, a drawer below `lg`) + sticky top bar (56–64px) + `<main id='main-content'>`. A "Skip to main content" link is the first focusable element.
- **Top bar vs page title (decision):** the top bar shows a **small muted section label only** (`text-sm font-medium text-muted-foreground`, from `lib/navigation/route-title.ts`, hidden below `sm`). It no longer shows the section description. The page's `PageHeader` is the one prominent title and owns the description and the actions. Rationale: the h1 sits right under the bar, so a second big title was pure repetition; the small label still tells you where you are after scrolling the h1 away.
- **Page:** `PageShell` = `container mx-auto px-4 py-8 space-y-6` (16px gutter, 32px top/bottom, 24px between sections) on plain `bg-background`.
- **Header:** `PageHeader` = title block left, actions right; below `sm` the actions wrap under the title and **share the full width** (each direct child of `actions` grows; from `sm` up they keep their natural width). This is PageHeader's job: never add `w-full sm:w-auto` / `flex-1 sm:flex-none` to header buttons, and use `actionsId` instead of a wrapper `<div id>` when you need an anchor.
- **KPIs:** `StatGrid` = 1 column → 2 at `sm` → 2/3/4 at `lg` (`5` = 3 at `lg`, 5 at `xl`), 16px gap.
- **Content grids:** cards in `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` (or 2). Charts take full width or a half at `lg`.
- **Breakpoints:** Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280). `hooks/useMediaQuery.ts` exports them as `BREAKPOINTS` for the rare component whose tree changes by width.

## Elevation & Depth

Flat by default. Surfaces are separated by a 1px `border` and the `shadow-sm` that `Card` already carries; that is the whole depth system for content. Overlays (dialogs, drawers, popovers, dropdowns, tooltips) use `shadow-md`/`shadow-lg` over a `bg-black/40` scrim.

**The Flat Card Rule.** Don't add `shadow-lg`, `hover:shadow-xl`, colored glows or `hover:-translate-y` lifts to cards. Hover feedback on an interactive card is a border/background tint (`hover:bg-muted/40`, `hover:border-foreground/20`).

## Shapes

`--radius` is 8px. Cards and dialogs are `rounded-lg` (8px), buttons/inputs/menus `rounded-md` (6px), small chips `rounded-sm` (4px), badges, avatars, icon circles and progress bars `rounded-full`. No `border-left` accent stripes on cards, list items or alerts.

## Components

All shared building blocks live in **`components/shared/`** (feature folders keep feature components; `components/ui/` keeps the shadcn primitives). **Import each from its own file** (`@/components/shared/EmptyState`); there is deliberately no `index.ts` barrel, because the i18n import-graph check (`tests/lib/client-messages.test.ts`) and the client bundles follow imports file by file. Components marked *server-compatible* have no `'use client'` and work in server and client trees; the others are client components with serializable props (usable from server pages too).

### PageShell — `components/shared/PageShell.tsx` (server-compatible)
Outer frame of every /app and /admin page.
```ts
interface PageShellProps extends HTMLAttributes<HTMLDivElement> {} // className merges
```
```tsx
<PageShell>
	<PageHeader … />
	<StatGrid>…</StatGrid>
	<section>…</section>
</PageShell>
```

### PageHeader — `components/shared/PageHeader.tsx` (server-compatible)
```ts
interface PageHeaderProps {
	title: ReactNode        // plain section name, rendered as the page's h1
	description?: ReactNode // one muted sentence
	actions?: ReactNode     // page-level buttons; primary create button last; full width below sm
	actionsId?: string      // id of the actions container (demo-tour anchor)
	leading?: ReactNode     // e.g. a 40px ghost icon back button on detail pages
	className?: string
}
```
```tsx
<PageHeader
	title={t('title')}
	description={t('subtitle')}
	actions={
		<Button onClick={openCreate}>
			<Plus className='mr-2 h-4 w-4' />
			{t('newAccount')}
		</Button>
	}
/>
```
Page-level create buttons go here (not per tab, not under the KPI row). Detail pages put their back button in `leading` (`<Button asChild variant='ghost' size='icon'><Link aria-label={t('back')}>…ArrowLeft…`), not as a text link above the header.

### StatCard + StatGrid — `components/shared/StatCard.tsx`, `StatGrid.tsx` (server-compatible)
```ts
interface StatCardProps {
	label: ReactNode
	value: ReactNode                                // pass <Amount …/> for money
	icon?: ComponentType<{ className?: string }>    // lucide icon, top-right, muted, decorative
	hint?: ReactNode                                // one xs muted line
	tone?: 'default' | 'positive' | 'negative' | 'warning' // colors the value
	loading?: boolean                               // skeleton instead of value/hint, aria-busy
	className?: string
}
interface StatGridProps extends HTMLAttributes<HTMLDListElement> { columns?: 2 | 3 | 4 | 5 } // default 4
function StatGridSkeleton(props: { count?: 2 | 3 | 4 | 5; className?: string }) // loading frame
```
```tsx
<StatGrid columns={3}>
	<StatCard label={t('balance')} icon={Wallet} value={<Amount value={balance} currency='DOP' />} />
	<StatCard label={t('income')} icon={ArrowUpRight} tone='positive' value={<Amount value={income} />} hint={t('thisMonth')} />
	<StatCard label={t('expenses')} icon={ArrowDownRight} tone='negative' value={<Amount value={expenses} />} />
</StatGrid>
```
Animated counters are opt-in: `value={<Amount value={x} animate />}` (skipped under reduced motion). `STAT_TONE_CLASS` is exported if you need the same tone mapping elsewhere.
**Semantics:** `StatGrid` renders a `<dl>` and each `StatCard` is a `dt` (label) + `dd` (value, hint) group, so put only StatCards in a StatGrid; a StatCard outside a StatGrid goes in a `<dl>` grid of its own. **Loading:** the one KPI skeleton is `<StatGridSkeleton count={n} />` (same frame as n loading StatCards); don't hand-roll `Skeleton h-[108px]` tiles.

### Amount — `components/shared/Amount.tsx` (client)
The only way to render money.
```ts
interface AmountProps {
	value: number               // signed: income/inflow > 0, expense/outflow < 0
	currency?: string | null    // ISO code; empty/unknown → DOP
	tone?: 'auto' | 'positive' | 'negative' | 'warning' | 'neutral' // default 'neutral' (inherits ink)
	signed?: boolean            // "+RD$100.00" / "-RD$100.00"; zero unsigned
	icon?: boolean              // up/down arrow before the amount (aria-hidden)
	animate?: boolean           // count-up; ignored with reduced motion
	className?: string
}
```
```tsx
<Amount value={tx.type === 'bill' ? -tx.amount : tx.amount} currency={account.currency} tone='auto' signed icon />
<Amount value={account.balance} currency={account.currency} />
```
`tone='auto'` → `text-success` above zero, `text-destructive` below, neutral at zero (rounded to cents). A value that rounds to zero prints as a plain zero (never "-RD$0.00") with no arrow. Also exported: `resolveAmountTone(value, tone)`.
For **strings** (aria-labels, toasts, chart tooltips, exports) use `useFormatCurrency()` from `hooks/useFormatCurrency.ts`: `const format = useFormatCurrency(); format(1500.5, 'USD', { signDisplay: 'exceptZero' })`. Server components use `formatCurrency(value, currency, { locale: await getLocale() })` from `lib/utils`. No local `formatMoney`/`money`/`formatDOP` helpers, no inline `Intl.NumberFormat` or `toFixed` for money.
**Percentages** go through `useFormatPercent()` (`hooks/useFormatPercent.ts`) or, on the server, `formatPercent(value, { locale })` from `lib/utils`: value in percent units, locale-aware, 1 decimal at most by default (`formatPercent(roi, { signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2 })` → "+4.20%"). Never `toFixed(1) + '%'`; messages take the formatted string (`"{percent} usado"`, no literal `%` in the catalog).

### EmptyState — `components/shared/EmptyState.tsx` (server-compatible)
```ts
interface EmptyStateProps {
	icon?: ComponentType<{ className?: string }> // icon of the missing thing
	title: ReactNode                             // statement: "No budgets yet"
	description?: ReactNode                      // why + what the action does
	action?: ReactNode                           // usually one Button with Plus; second one outline
	compact?: boolean                            // inside cards/charts: smaller, no min-height
	titleAs?: 'h2' | 'h3' | 'p'                  // default h2 (full) / p (compact)
	className?: string
}
```
```tsx
<EmptyState
	icon={PiggyBank}
	title={t('noBudgets')}
	description={t('noBudgetsDescription')}
	action={
		<Button onClick={openCreate}>
			<Plus className='mr-2 h-4 w-4' />
			{t('createFirstBudget')}
		</Button>
	}
/>
<EmptyState compact icon={BarChart3} title={tCommon('empty.noData')} /> {/* replaces ChartEmptyState */}
```
Generic copy exists under `common.empty.*` (`title`, `noData`, `noResults`, `noResultsDescription`), but prefer a specific title that names the thing.
**Copy tone (both locales):** the user has none yet → "Aún no tienes X" / "No X yet"; a filter or search matched nothing → "No se encontraron X" / "No X found"; a period has no data → "No hay datos para este período" / "No data for this period". Titles have no trailing period; the description is one helpful sentence ending in a period. Plain muted `<p>` text is not an empty state: use `<EmptyState compact>` inside dialogs, cards and table cells too.

### ErrorState — `components/shared/ErrorState.tsx` (client)
```ts
interface ErrorStateProps {
	title?: ReactNode       // default common.error.title
	description?: ReactNode // default common.error.description; never raw error.message
	onRetry?: () => void    // shows "Try again" (outline) — pass refetch
	retryLabel?: ReactNode
	action?: ReactNode      // secondary action next to retry
	compact?: boolean       // inside a card/chart
	className?: string
}
```
```tsx
const { data, isLoading, isError, refetch } = useGetAccounts()
if (isError) return <ErrorState onRetry={() => refetch()} />
```
`role='alert'` sits on the title + description only (the retry button is not announced as part of the alert); AlertTriangle in a soft destructive circle. Inside a form (e.g. a failed list of source accounts) use it `compact` next to the field. `app/app/error.tsx` uses it as the route error boundary for every /app page (retry = `router.refresh()` + `reset()`, plus a link to the dashboard). Don't use `window.location.reload()` as a retry.

### ModuleDisabled — `components/shared/ModuleDisabled.tsx` (server-compatible)
```ts
interface ModuleDisabledProps { title: ReactNode } // the module's page title, kept as the h1
```
```tsx
if (!isEnabled('module_loans')) return <ModuleDisabled title={t('title')} />
```
Renders `PageShell` + `PageHeader` + an `EmptyState` with `common.moduleDisabled.{title,message,goToDashboard}`.

### ConfirmDialog — `components/shared/ConfirmDialog.tsx` (client)
Built on the new `components/ui/alert-dialog.tsx` (Radix AlertDialog: `role='alertdialog'`, focus starts on Cancel, no close X).
```ts
interface ConfirmDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: ReactNode          // the question, naming the object
	description?: ReactNode   // the consequence
	confirmLabel?: ReactNode  // default: common.actions.delete if destructive, else common.actions.confirm
	cancelLabel?: ReactNode   // default common.actions.cancel
	destructive?: boolean     // red confirm button
	loading?: boolean         // external busy state
	onConfirm: () => unknown  // sync → closes; returns a promise → spinner until it resolves; rejects → stays open + inline error
	errorMessage?: ReactNode  // inline error when onConfirm rejects; default common.error.actionFailed
	children?: ReactNode      // extra content above the buttons
}
```
```tsx
const [toDelete, setToDelete] = useState<Account | null>(null)
const deleteAccount = useDeleteAccount()

<ConfirmDialog
	open={toDelete !== null}
	onOpenChange={(open) => !open && setToDelete(null)}
	title={t('deleteTitle', { name: toDelete?.name ?? '' })}
	description={tCommon('confirm.irreversible')}
	destructive
	onConfirm={() => deleteAccount.mutateAsync(toDelete!.id)}
/>
```
When `onConfirm` rejects the dialog stays open and shows an inline destructive Alert (`errorMessage`); a toast from the mutation's `onError` is still fine for details. Escape and Cancel are disabled while busy; Confirm becomes `aria-disabled` (not `disabled`) so keyboard focus stays on it. To open it from a `DropdownMenuItem`, set state in `onSelect` (don't nest the dialog inside the menu).

### FormDialog — `components/shared/FormDialog.tsx` (client)
The one modal for create/edit forms: centered `Dialog` from `md` up, bottom `Drawer` below `md`.
```ts
interface FormDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: ReactNode
	description?: ReactNode
	children: ReactNode                 // fields; body scrolls (max 90vh)
	size?: 'sm' | 'md' | 'lg'           // 448 / 512 (default) / 672px on desktop
	submitLabel?: ReactNode             // default common.actions.save — prefer "Create account"
	cancelLabel?: ReactNode             // default common.actions.cancel ("Close" for tools that save nothing)
	loading?: boolean                   // spinner on submit, buttons + close X disabled, can't dismiss
	submitDisabled?: boolean
	error?: ReactNode                   // inline destructive Alert above the footer
	className?: string
}
// …plus exactly one way to submit (a discriminated union, checked by TypeScript):
	| { onSubmit: (e: FormEvent<HTMLFormElement>) => unknown; footer?: ReactNode } // FormDialog renders the <form>
	| { formId: string; footer?: ReactNode }                                     // your own <form id> in children
	| { footer: ReactNode; onSubmit?: … }                                        // multi-step flows with custom buttons
```
```tsx
<FormDialog
	open={open}
	onOpenChange={setOpen}
	title={isEdit ? t('editAccount') : t('newAccount')}
	submitLabel={isEdit ? tCommon('actions.save') : t('create')}
	loading={mutation.isPending}
	error={serverError}
	onSubmit={form.handleSubmit(onValid)}
>
	<Form {...form}>
		<div className='grid gap-4 sm:grid-cols-2'>…FormFields…</div>
	</Form>
</FormDialog>
```
**Custom footers** keep the loading guard: while `loading` the dialog can't be dismissed, the form isn't resubmitted, and every button in the footer is disabled (it renders inside a disabled `<fieldset>`); put a `Loader2` on the busy button yourself. **Breakpoint:** the Dialog/Drawer choice is taken when the dialog opens and kept until it closes, so resizing across `md` doesn't remount the fields. The close X is a 40px target and is disabled while loading.

**Footer order (fixed):** Cancel (`variant='outline'`) on the left, submit on the right; on mobile they stack full-width with submit on top. Never submit-first full-width on desktop, never a ghost Cancel, never omit Cancel, never text-only loading ("Saving…" without the spinner). Field grids inside must collapse to one column on mobile (`grid-cols-1 sm:grid-cols-2`).

### EmojiPicker / ColorSwatchPicker — `components/shared/EmojiPicker.tsx`, `ColorSwatchPicker.tsx` (client)
Shared category icon/color pickers (replace the copies in CategoryFormModal and QuickCategoryCreate).
```ts
interface PickerOption { value: string; label: string }
interface EmojiPickerProps {
	value: string; onChange: (v: string) => void
	options?: readonly PickerOption[]   // default: CATEGORY_EMOJIS (30), labels from common.picker.emojis
	disabled?: boolean; 'aria-labelledby'?: string; className?: string
}
interface ColorSwatchPickerProps {
	value: string; onChange: (v: string) => void  // hex, matched case-insensitively
	options?: readonly PickerOption[]   // default: CATEGORY_COLORS (20), labels from common.picker.colors
	allowCustom?: boolean               // native color input swatch, labelled
	disabled?: boolean; 'aria-labelledby'?: string; className?: string
}
```
```tsx
<FormLabel id='category-icon-label'>{t('icon')}</FormLabel>
<EmojiPicker aria-labelledby='category-icon-label' value={field.value} onChange={field.onChange} />
<ColorSwatchPicker aria-labelledby='category-color-label' value={field.value} onChange={field.onChange} allowCustom />
```
Each option is a 40px toggle button with an accessible name and `aria-pressed`, inside a labelled `fieldset`; the selected color also shows a check mark. Categories created on the fly (quick create, AI import) use `DEFAULT_CATEGORY_COLOR` from the same file.

### Progress — `components/ui/progress.tsx`
```ts
interface ProgressProps extends RadixProgressRootProps {
	value?: number | null   // clamped to [0, max]; null = indeterminate
	max?: number            // default 100
	tone?: 'default' | 'success' | 'warning' | 'destructive' | 'info'
	className?: string      // the track (default h-2)
	indicatorClassName?: string
}
getProgressTone(percent, { warningAt = 80, dangerAt = 100 }) // → 'default' | 'warning' | 'destructive'
```
```tsx
<Progress value={percentUsed} tone={getProgressTone(percentUsed)} aria-label={t('budgetUsed', { name })} />
```
`role='progressbar'` with `aria-valuenow`; always give it an `aria-label`. Replaces every hand-rolled `div` bar.

### Checkbox — `components/ui/checkbox.tsx`
shadcn Checkbox (Radix, `role='checkbox'`, 16px box with a 40px hit area). Pair with `<Label htmlFor>` or `aria-label`. Replaces raw `<input type='checkbox'>`.

### AlertDialog — `components/ui/alert-dialog.tsx`
shadcn AlertDialog primitive. Use `ConfirmDialog` instead of composing it in feature code.

### Buttons and icon buttons
- Shape: `rounded-md` (6px), 40px tall (`size='default'` / `size='icon'`), 36px for `size='sm'` in dense toolbars only.
- **Create:** lucide `Plus` (`mr-2 h-4 w-4`), never `PlusCircle`. Primary variant; label names the object ("New account").
- **Row actions:** a `DropdownMenu` triggered by `MoreHorizontal` in a `variant='ghost' size='icon'` button (40×40) whose `aria-label` is always `tCommon('actions.rowMenu', { name })` ("Acciones de {name}" / "Actions for {name}", naming the row). Not `h-8 w-8 p-0`. Keep it visible on touch and on `focus-within`, not only on hover. A row's **one primary action** may stay visible as a button next to the menu (e.g. "Register payment" on an active loan, "Pay" on a card); everything else (details, edit, delete, cancel) goes in the menu, destructive items last after a separator.
- **Busy buttons:** a `Loader2` (`mr-2 h-4 w-4 animate-spin`, `aria-hidden`) before the unchanged label plus `aria-busy`; never swap the label for "Loading…/Saving…" text alone.
- Every icon-only button has an `aria-label` (a `title` alone is not a name).
- Destructive buttons use `variant='destructive'`; their label color comes from `--destructive-foreground`.

### Cards / containers
`Card` (8px radius, 1px border, `shadow-sm`, `bg-card`). Padding 20–24px. One idea per card; never cards inside cards. Clickable cards use a real `<Link>` (stretched-link pattern) so they are keyboard reachable.

### Tabs
- **Page sections** use `PageTabs` (`components/shared/PageTabs.tsx`, built on Radix `ui/tabs`): dashboard (Overview / Accounts / Transactions / Budgets / Patrimony), transactions (History / Recurring), investments (Stocks / Crypto / Fixed income).
  ```ts
  interface PageTabsProps {
  	tabs: { value: string; label: ReactNode; icon?: ReactNode; content: ReactNode; disabled?: boolean }[]
  	defaultValue: string
  	urlParam?: string | false   // mirrors the tab in the URL, default 'tab'; false = off
  	value?: string; onValueChange?: (v: string) => void  // controlled (e.g. header actions follow the tab)
  	'aria-label'?: string; id?: string; className?: string; listClassName?: string
  }
  ```
  The active tab is mirrored in `?tab=` (or `urlParam`) with `history.replaceState` (Next keeps `useSearchParams` in sync; a `router.replace` would only re-run the server page), so a section can be linked and survives reload. Only the active panel mounts. Below `sm` the tab list scrolls horizontally inside itself (labels stay visible), never the page. Pick another `urlParam` when a filter on the page already uses `tab` (transactions uses `section`, investments `type`). `icon` is an element (`<BarChart3 className='h-4 w-4' />`) so server pages can pass it.
- `AnimatedTabs` (`components/common/animated-tabs.tsx`) only as a **segmented filter control** (All / Income / Expenses) inside a section.
- Never nest one inside the other; never render a tab list with a single tab.

### Charts — `components/charts/chart-theme.ts`
`useChartTheme(fontSize = 12)` is the only theming path for Nivo:
```ts
const { theme, colors, isDark } = useChartTheme()
// colors: { text, mutedText, border, surface, primary, positive, negative, warning, info, series: string[8] }
<ResponsiveBar theme={theme} colors={[colors.positive, colors.negative]} … />
<ResponsivePie theme={theme} colors={colors.series} arcLinkLabelsTextColor={colors.text} … />
```
It reads the CSS tokens (resolved to concrete colors, since Nivo animates with react-spring) keyed on `resolvedTheme` and re-reads them when the `dark` class changes. Also exported: `CHART_TOOLTIP_CLASS` (custom tooltip card), `CHART_SERIES_COUNT`, `pickTicks()`, `useCssHslColors()` (for a token `colors` doesn't expose). Don't read `useTheme().theme` (it is `'system'` for most users), don't pass inline `theme={{…}}` with hex, don't hardcode series hex. Assign series colors in fixed order by entity; past 8, fold into "Other". Use `<EmptyState compact>` when a chart has no data and format values with `useFormatCurrency`.

### Navigation
Sidebar: muted ink items, the active item gets `text-primary`, a 4px primary bar and a `bg-primary/10` fill that slide to it (the nav's one motion), and `aria-current='page'`. Collapse toggle is labelled ("Collapse"/"Expand"). Badges only for a time-limited launch, never a permanent "New". Top bar: small section label, search, notifications, quick actions (`Plus`), user menu.

### Motion
`MotionConfig reducedMotion='user'` wraps the app (`components/common/motion-provider.tsx` in `app/layout.tsx`), so framer-motion components honor the OS setting without per-component checks. Non-framer animation (count-up) checks `useReducedMotion()`. Allowed: a short fade on content mount, the nav indicator slide, dialog/drawer transitions. No staggered entrances on every card, no hover lifts, no pulsing glows.

## Do's and Don'ts

### Do:
- **Do** start every /app page with `<PageShell>` and `<PageHeader title description actions>`; put the create button in `actions`.
- **Do** render money with `<Amount>` (`tone='auto'` for income/expense lists, neutral for balances) and format strings with `useFormatCurrency()`.
- **Do** use `text-success` / `text-destructive` / `text-warning` / `text-info` (and `/10` fills) for status; keep a sign, arrow or label next to the color.
- **Do** show `<EmptyState>` for empty lists/pages (`compact` inside cards and charts) and `<ErrorState onRetry={refetch}>` when a query fails.
- **Do** confirm destructive actions with `<ConfirmDialog destructive>`; delete passkeys/API keys/users through it too.
- **Do** build create/edit modals with `<FormDialog>`: Cancel outline left, submit right with `Loader2` spinner while loading, inline `error`.
- **Do** use `Plus` for create, `MoreHorizontal` in a 40px ghost icon button with `aria-label` for row menus.
- **Do** use `<Progress tone={getProgressTone(pct)} aria-label=…>` for any bar.
- **Do** take chart colors and theme from `useChartTheme()`.
- **Do** switch the UI language only through `switchLocale()` (`lib/i18n/switch-locale.ts`, the one writer of the `locale` cookie).
- **Do** put every user-visible string through next-intl, in both `messages/es.json` and `messages/en.json`. Shared copy lives in `common.*` (`common.actions`, `common.confirm`, `common.error`, `common.empty`, `common.moduleDisabled`, `common.picker`).

### Don't:
- **Don't** use raw palette classes for meaning (`text-green-600`, `text-red-500`, `bg-emerald-50`, `text-blue-600`, `from-purple-500`…). User-chosen category colors are the only raw colors allowed.
- **Don't** use gradients on app surfaces: no `bg-gradient-to-br from-background via-background to-muted/30` page wash, no gradient KPI tiles, no gradient buttons, no gradient text.
- **Don't** call `window.confirm()` or hand-roll a delete `Dialog`.
- **Don't** write local `formatMoney`/`money`/`formatDOP` helpers, inline `Intl.NumberFormat`, or `toFixed(2)` for money, nor `toFixed(1) + '%'` for percentages (use `useFormatPercent`).
- **Don't** repeat the page title in the content ("Gestión de Cuentas" under a "Cuentas" bar); the h1 is the plain section name and there is one per page.
- **Don't** use `PlusCircle`, `h-8 w-8 p-0` icon buttons, or menus that only appear on hover.
- **Don't** nest `PageTabs` and `AnimatedTabs`, use `AnimatedTabs` for page sections, or show a single-tab tab list.
- **Don't** order footers submit-first, use a ghost Cancel, or show a text-only "Saving…" state.
- **Don't** read `useTheme().theme` for colors or pass hex Nivo themes; don't put status colors on chart series.
- **Don't** import shared components through a barrel; import the file.
