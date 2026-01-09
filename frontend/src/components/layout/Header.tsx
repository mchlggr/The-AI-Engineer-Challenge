import Link from "next/link";

export function Header() {
	return (
		<header className="sticky top-0 z-50 w-full border-b border-border-light bg-bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-bg-cream/60">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-12">
				<Link href="/" className="flex items-center gap-2">
					<span className="text-xl font-bold text-brand-green">
						Calendar Club
					</span>
				</Link>

				<nav className="flex items-center gap-4">
					<Link
						href="/week"
						className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
					>
						Week View
					</Link>
					<button
						type="button"
						className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
					>
						Login
					</button>
					<button
						type="button"
						className="rounded-full bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green/90 transition-colors"
					>
						Subscribe
					</button>
				</nav>
			</div>
		</header>
	);
}
