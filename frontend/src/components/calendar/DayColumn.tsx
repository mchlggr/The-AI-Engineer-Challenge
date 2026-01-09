import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DayColumnProps {
	date: Date;
	isWeekend: boolean;
	isToday: boolean;
	eventCount?: number;
	children?: ReactNode;
	className?: string;
}

export function DayColumn({
	date,
	isWeekend,
	isToday,
	eventCount = 0,
	children,
	className,
}: DayColumnProps) {
	const hasHighDensity = eventCount >= 3;

	return (
		<div
			className={cn(
				"flex min-h-[200px] flex-col gap-2 border-r border-border-light p-2 last:border-r-0",
				isWeekend ? "weekend-column" : "bg-bg-white",
				isToday && "today-column",
				hasHighDensity && "density-high",
				className,
			)}
			data-date={date.toISOString().split("T")[0]}
		>
			{children}
		</div>
	);
}
