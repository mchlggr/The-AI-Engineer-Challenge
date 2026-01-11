import Link from "next/link";
import { cn } from "@/lib/utils";

interface HeaderProps {
	className?: string;
}

export function Header({ className }: HeaderProps) {
	return (
		<header className={cn("w-full", className)}>
			<div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-6 md:px-12">
				{/* Logo - sticker */}
				<Link
					href="/"
					className="sticker-pill tape-accent inline-flex items-center px-6 py-3 font-logo text-3xl leading-none tracking-tight transition-transform duration-200 hover:scale-105"
					style={{ "--cc-rotate": "-2deg" } as React.CSSProperties}
				>
					Calendar Club
				</Link>

				{/* Actions - torn paper */}
				<nav aria-label="Primary" className="flex items-center gap-3">
					<div className="paper-card relative flex items-center gap-4 bg-bg-white p-3 tape-accent">
						<div className="tape absolute -top-3 left-1/2 h-6 w-12 -translate-x-1/2 rotate-[-1deg]" />

						<Link
							href="/"
							className="cc-label text-text-primary transition-colors hover:text-brand-green"
						>
							Discover
						</Link>
						<span className="text-border-light">|</span>
						<Link
							href="/week"
							className="cc-label text-text-primary transition-colors hover:text-brand-green"
						>
							Week
						</Link>
					</div>
				</nav>
			</div>
		</header>
	);
}
