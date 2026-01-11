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
				<div className="mt-3 h-4 w-4 flex-shrink-0 rounded-full border-2 border-text-primary bg-accent-orange" />

				{/* Headline text */}
				<h1 className="cc-h1 text-text-primary">
					<span className="hero-accent block">Tune into</span>
					<span className="hero-emphasis block">the signal.</span>
				</h1>
			</div>

			<p className="cc-body text-text-secondary">
				Describe what you&apos;re looking for. Calendar Club finds upcoming tech
				events and lets you download a calendar file for the week.
			</p>
		</div>
	);
}
