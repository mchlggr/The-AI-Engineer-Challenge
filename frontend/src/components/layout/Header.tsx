import { cn } from "@/lib/utils";

interface HeaderProps {
	className?: string;
}

export function Header({ className }: HeaderProps) {
	return (
		<header
			className={cn(
				"flex w-full items-center justify-between px-6 py-4 md:px-12",
				className,
			)}
		>
			{/* Logo */}
			<div className="flex items-center">
				<div className="rounded-lg bg-brand-green px-5 py-3 shadow-md">
					<span className="font-display text-xl text-white">Calendar Club</span>
				</div>
			</div>

			{/* Navigation */}
			<nav className="flex items-center gap-6">
				<div className="hidden items-center gap-4 rounded-full bg-white px-4 py-2 shadow-sm sm:flex">
					<a
						href="/login"
						className="text-sm font-medium uppercase tracking-wide text-text-primary transition-colors hover:text-brand-green"
					>
						Login
					</a>
					<span className="text-border-light">|</span>
					<a
						href="/subscribe"
						className="text-sm font-medium uppercase tracking-wide text-text-primary transition-colors hover:text-brand-green"
					>
						Subscribe
					</a>
				</div>
				{/* Mobile menu button */}
				<button
					type="button"
					className="flex h-10 w-10 items-center justify-center rounded-lg text-text-primary transition-colors hover:bg-bg-cream sm:hidden"
					aria-label="Open menu"
				>
					<svg
						className="h-6 w-6"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M4 6h16M4 12h16M4 18h16"
						/>
					</svg>
				</button>
			</nav>
		</header>
	);
}
