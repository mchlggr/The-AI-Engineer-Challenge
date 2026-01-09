"use client";

import { cn, cssVars, deterministicRotationDeg } from "@/lib/utils";
import type { CalendarEvent, EventCategory } from "./types";

interface EventCardProps {
	event: CalendarEvent;
	onClick?: (event: CalendarEvent) => void;
	onHover?: (event: CalendarEvent | null, element?: HTMLElement) => void;
	className?: string;
}

const categoryStyles: Record<EventCategory, string> = {
	meetup: "category-meetup",
	startup: "category-startup",
	community: "category-community",
	ai: "category-ai",
};

const categoryLabels: Record<EventCategory, string> = {
	meetup: "Meetup",
	startup: "Startup",
	community: "Community",
	ai: "AI",
};

const categoryBadgeStyles: Record<EventCategory, string> = {
	meetup: "bg-accent-orange text-white",
	startup: "bg-brand-green text-white",
	community: "bg-accent-teal text-white",
	ai: "bg-accent-blue text-white",
};

const categoryTapeColors: Record<EventCategory, string> = {
	meetup: "var(--color-accent-orange)",
	startup: "var(--color-brand-green)",
	community: "var(--color-accent-teal)",
	ai: "var(--color-accent-blue)",
};

function formatTime(date: Date): string {
	const hours = date.getHours();
	const ampm = hours >= 12 ? "PM" : "AM";
	const hour12 = hours % 12 || 12;
	return `${hour12}${ampm}`;
}

export function EventCard({
	event,
	onClick,
	onHover,
	className,
}: EventCardProps) {
	const tiltDeg = deterministicRotationDeg(event.id, {
		min: -2,
		max: 2,
		step: 0.5,
	});

	const handleClick = () => {
		onClick?.(event);
		if (event.canonicalUrl) {
			window.open(event.canonicalUrl, "_blank", "noopener,noreferrer");
		}
	};

	return (
		<button
			type="button"
			className={cn(
				"paper-card event-sticker w-full cursor-pointer p-3 text-left",
				categoryStyles[event.category],
				className,
			)}
			style={cssVars({ "--cc-rotate": `${tiltDeg}deg` })}
			onClick={handleClick}
			onMouseEnter={(e) => onHover?.(event, e.currentTarget)}
			onMouseLeave={() => onHover?.(null)}
		>
			{/* Color tape */}
			<div
				className="event-tape"
				style={{
					backgroundColor: categoryTapeColors[event.category],
					rotate: "-2deg",
				}}
			/>

			<div className="pt-2">
				<div className="flex items-center justify-between gap-2">
					<span className="event-time-pill">{formatTime(event.startTime)}</span>
					<span
						className={cn("event-badge", categoryBadgeStyles[event.category])}
					>
						{categoryLabels[event.category]}
					</span>
				</div>

				{/* Title */}
				<h3 className="mt-2 line-clamp-2 text-[13px] font-bold text-text-primary">
					{event.title}
				</h3>
			</div>
		</button>
	);
}
