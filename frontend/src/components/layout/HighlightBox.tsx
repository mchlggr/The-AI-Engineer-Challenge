import { cn } from "@/lib/utils";

interface HighlightBoxProps {
	children: React.ReactNode;
	className?: string;
}

export function HighlightBox({ children, className }: HighlightBoxProps) {
	return (
		<div
			className={cn(
				"max-w-md -rotate-1 rounded bg-accent-yellow px-4 py-3 shadow-md",
				className,
			)}
		>
			<p className="font-marker text-sm uppercase tracking-wide text-text-primary">
				{children}
			</p>
		</div>
	);
}
