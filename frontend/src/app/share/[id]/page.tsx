import type { Metadata } from "next";

interface SharePageProps {
	params: Promise<{ id: string }>;
}

export async function generateMetadata({
	params,
}: SharePageProps): Promise<Metadata> {
	const { id } = await params;
	return {
		title: `Shared Calendar | Calendar Club`,
		description: `View shared calendar ${id}`,
	};
}

export default async function SharePage({ params }: SharePageProps) {
	const { id } = await params;

	return (
		<div className="mx-auto max-w-7xl px-6 py-8 md:px-12">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-text-primary">Shared Calendar</h1>
				<p className="mt-2 text-text-secondary">
					Calendar ID: {id}
				</p>
			</div>

			<div className="rounded-lg border border-border-light bg-white p-8 shadow-sm">
				<p className="text-center text-text-secondary">
					Shared calendar view coming soon...
				</p>
			</div>
		</div>
	);
}
