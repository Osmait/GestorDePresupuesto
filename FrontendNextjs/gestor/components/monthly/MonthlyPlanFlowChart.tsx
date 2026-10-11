'use client'

import type { MonthFlow } from '@/lib/monthlyPlanUtils'
import { cn } from '@/lib/utils'

const WIDTH = 300
const PLOT_BOTTOM = 112
const PLOT_HEIGHT = 104
const HEIGHT = 132

export interface FlowChartGeometry {
	line: string
	area: string
	/** y of the zero line when the projection dips below zero. */
	zeroY: number | null
	incomeDots: { day: number; x: number; y: number }[]
	low: { x: number; y: number }
	ticks: { day: number; x: number; anchor: 'start' | 'middle' | 'end' }[]
	columns: { day: number; x: number; width: number; balance: number }[]
}

const round = (value: number) => Math.round(value * 10) / 10

/** Pure geometry of the step chart (exported for tests): x = day from today to month end, y = balance. */
export function buildFlowChartGeometry(flow: MonthFlow): FlowChartGeometry {
	const span = Math.max(flow.monthDays - flow.today, 1)
	const balances = flow.points.map((point) => point.balance)
	const lo = Math.min(0, ...balances)
	const rawHi = Math.max(0, ...balances)
	const hi = rawHi === lo ? lo + 1 : rawHi + (rawHi - lo) * 0.06
	const x = (day: number) => round(((day - flow.today) / span) * WIDTH)
	const y = (value: number) => round(PLOT_BOTTOM - ((value - lo) / (hi - lo)) * PLOT_HEIGHT)

	let line = `M0 ${y(flow.points[0].balance)}`
	for (const point of flow.points.slice(1)) line += ` H${x(point.day)} V${y(point.balance)}`
	const area = `${line} V${PLOT_BOTTOM} H0 Z`

	const balanceOn = (day: number) => flow.points.find((point) => point.day === day)?.balance ?? flow.start
	const incomeDays = Array.from(
		new Set(flow.events.filter((event) => event.item.type === 'income').map((event) => event.day)),
	)

	const middle = [15, 20, 25].filter((day) => day - flow.today >= 3 && flow.monthDays - day >= 3)
	const tickDays = [flow.today, ...middle, flow.monthDays]

	return {
		line,
		area,
		zeroY: lo < 0 ? y(0) : null,
		incomeDots: incomeDays.map((day) => ({ day, x: x(day), y: y(balanceOn(day)) })),
		low: { x: x(flow.low.day), y: y(flow.low.balance) },
		ticks: tickDays.map((day, index) => ({
			day,
			x: x(day),
			anchor: index === 0 ? 'start' : index === tickDays.length - 1 ? 'end' : 'middle',
		})),
		columns: flow.points
			.filter((point, index, all) => all.findIndex((other) => other.day === point.day) === index)
			.map((point) => ({
				day: point.day,
				x: Math.max(x(point.day) - WIDTH / span / 2, 0),
				width: WIDTH / span,
				balance: point.balance,
			})),
	}
}

interface MonthlyPlanFlowChartProps {
	flow: MonthFlow
	/** Full description of the chart for screen readers. */
	label: string
	todayLabel: string
	/** Native hover tooltip of a day column ("12 oct: RD$80,000.00"). */
	describeDay: (day: number, balance: number) => string
	className?: string
}

/**
 * Light step chart of the projected balance (inline SVG, token colors): today's
 * balance on the left, a step on every day with plan items, green dots on the
 * incomes and an amber ring on the lowest point.
 */
export function MonthlyPlanFlowChart({ flow, label, todayLabel, describeDay, className }: MonthlyPlanFlowChartProps) {
	const geometry = buildFlowChartGeometry(flow)
	const lowNegative = flow.low.balance < 0

	return (
		<svg
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			width='100%'
			role='img'
			aria-label={label}
			className={cn('block overflow-visible', className)}
		>
			<path d={geometry.area} className='fill-foreground/5' />
			{geometry.zeroY !== null && (
				<line
					x1={0}
					x2={WIDTH}
					y1={geometry.zeroY}
					y2={geometry.zeroY}
					className='stroke-destructive/60'
					strokeDasharray='3 3'
				/>
			)}
			<line x1={0} x2={0} y1={0} y2={PLOT_BOTTOM} className='stroke-muted-foreground/60' strokeDasharray='3 3' />
			<path d={geometry.line} fill='none' className='stroke-foreground' strokeWidth={2} strokeLinejoin='round' />
			{geometry.incomeDots.map((dot) => (
				<circle key={dot.day} cx={dot.x} cy={dot.y} r={4} className='fill-success stroke-card' strokeWidth={2} />
			))}
			<circle
				cx={geometry.low.x}
				cy={geometry.low.y}
				r={4.5}
				className={cn('fill-card', lowNegative ? 'stroke-destructive' : 'stroke-warning')}
				strokeWidth={2.5}
			/>
			{geometry.ticks.map((tick) => (
				<text
					key={tick.day}
					x={tick.x}
					y={HEIGHT - 4}
					textAnchor={tick.anchor}
					className='fill-muted-foreground text-xs'
				>
					{tick.day === flow.today ? todayLabel : tick.day}
				</text>
			))}
			{/* Hover targets: one column per day with a native tooltip. */}
			{geometry.columns.map((column) => (
				<rect
					key={column.day}
					x={column.x}
					y={0}
					width={column.width}
					height={PLOT_BOTTOM}
					fill='transparent'
					className='hover:fill-foreground/5'
				>
					<title>{describeDay(column.day, column.balance)}</title>
				</rect>
			))}
		</svg>
	)
}
