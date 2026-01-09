export interface CalendarEvent {
	id: string;
	title: string;
	startTime: Date;
	endTime: Date;
	category: "meetup" | "startup" | "community" | "ai";
	venue?: string;
	neighborhood?: string;
	canonicalUrl: string;
	sourceId: string;
}

export type EventCategory = CalendarEvent["category"];
