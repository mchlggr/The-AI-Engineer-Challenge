export default function Home() {
	return (
		<div className="bg-notebook-grid min-h-screen">
			<div className="mx-auto max-w-3xl px-6 py-16 md:px-12 md:py-24">
				{/* Hero Section */}
				<div className="mb-12 text-center">
					<h1 className="mb-4 text-5xl md:text-6xl">
						<span className="font-serif italic text-brand-green">Tune into</span>
						<br />
						<span className="font-sans font-bold text-text-primary">the signal.</span>
					</h1>
					<p className="font-mono text-sm tracking-caps text-text-primary">
						A curated directory of the best technical meetups.
						<br />
						No noise, just deep cuts.
					</p>
				</div>

				{/* Discovery Chat Card */}
				<div className="rounded-xl border border-border-light bg-white p-8 shadow-md">
					<h2 className="mb-6 text-lg font-medium text-text-secondary">
						What are you looking for?
					</h2>

					{/* Search Input */}
					<div className="mb-6">
						<input
							type="text"
							placeholder="Find AI meetups this weekend..."
							className="w-full rounded-lg border border-border-light bg-white px-4 py-3 text-text-primary placeholder:text-text-secondary focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
						/>
					</div>

					{/* Quick Picks */}
					<div className="mb-6">
						<p className="mb-3 text-xs font-medium tracking-caps text-text-secondary">
							Quick picks
						</p>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								className="rounded-full bg-bg-cream px-4 py-2 text-sm font-medium text-text-primary hover:bg-accent-yellow transition-colors"
							>
								This weekend
							</button>
							<button
								type="button"
								className="rounded-full bg-bg-cream px-4 py-2 text-sm font-medium text-text-primary hover:bg-accent-yellow transition-colors"
							>
								AI/Tech
							</button>
							<button
								type="button"
								className="rounded-full bg-bg-cream px-4 py-2 text-sm font-medium text-text-primary hover:bg-accent-yellow transition-colors"
							>
								Startups
							</button>
							<button
								type="button"
								className="rounded-full bg-bg-cream px-4 py-2 text-sm font-medium text-text-primary hover:bg-accent-yellow transition-colors"
							>
								Free events
							</button>
						</div>
					</div>
				</div>

				{/* Tape Accent Callout */}
				<div className="mt-8 flex justify-center">
					<div className="tape-accent inline-block rounded bg-accent-yellow px-4 py-2 text-sm font-bold text-text-primary">
						Starts Here!
					</div>
				</div>
			</div>
		</div>
	);
}
