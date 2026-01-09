import { cn } from "@/lib/utils";

interface WeekHeaderProps {
	weekStart: Date;
	className?: string;
}

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function isSameDay(date1: Date, date2: Date): boolean {
	return (
		date1.getFullYear() === date2.getFullYear() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getDate() === date2.getDate()
	);
}

function isWeekend(dayIndex: number): boolean {
	return dayIndex === 0 || dayIndex === 6;
}

export function WeekHeader({ weekStart, className }: WeekHeaderProps) {
	const today = new Date();

	const days = Array.from({ length: 7 }, (_, i) => {
		const date = new Date(weekStart);
		date.setDate(weekStart.getDate() + i);
		return date;
	});

	return (
		<div
			className={cn("grid grid-cols-7 border-b border-border-light", className)}
		>
			{days.map((date, index) => {
				const isToday = isSameDay(date, today);
				const weekend = isWeekend(index);

				return (
					<div
						key={date.toISOString()}
						className={cn(
							"flex flex-col items-center py-3",
							weekend ? "bg-bg-cream" : "bg-bg-white",
						)}
					>
						{/* Day label */}
						<span className="day-header">{DAY_LABELS[index]}</span>

						{/* Date number with today indicator */}
						<div className="mt-1 flex items-center gap-1">
							{isToday && (
								<span className="h-2 w-2 rounded-full bg-accent-orange" />
							)}
							<span
								className={cn(
									"text-xl font-semibold",
									weekend ? "text-accent-orange" : "text-text-primary",
								)}
							>
								{date.getDate()}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
}
