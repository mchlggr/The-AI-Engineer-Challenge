import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Week View | Calendar Club",
	description: "Browse technical meetups by week",
};

export default function WeekPage() {
	return (
		<div className="mx-auto max-w-7xl px-6 py-8 md:px-12">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-text-primary">Week View</h1>
				<p className="mt-2 text-text-secondary">
					Browse upcoming technical meetups
				</p>
			</div>

			{/* WeekView component will be implemented in calendar/WeekView.tsx */}
			<div className="rounded-lg border border-border-light bg-white p-8 shadow-sm">
				<p className="text-center text-text-secondary">
					Week view calendar coming soon...
				</p>
			</div>
		</div>
	);
}
