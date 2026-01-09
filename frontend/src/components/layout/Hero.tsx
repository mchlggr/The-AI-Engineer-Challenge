import { cn } from "@/lib/utils";

interface HeroProps {
	className?: string;
}

export function Hero({ className }: HeroProps) {
	return (
		<div className={cn("flex flex-col gap-6", className)}>
			{/* Headline with orange dot accent */}
			<div className="flex items-start gap-3">
				{/* Orange dot accent */}
				<div className="mt-3 h-3 w-3 flex-shrink-0 rounded-full bg-accent-orange" />

				{/* Headline text */}
				<h1 className="text-4xl leading-tight md:text-5xl">
					<span className="hero-accent block">Tune into</span>
					<span className="hero-emphasis block">the signal.</span>
				</h1>
			</div>
		</div>
	);
}
