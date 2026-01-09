import type { NextConfig } from "next";

function normalizeOrigin(origin: string): string {
	const trimmed = origin.trim();
	return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function getApiProxyTarget(): string | null {
	const configured = process.env.API_PROXY_TARGET;
	const isDev = process.env.NODE_ENV === "development";

	// Explicit override (dev or prod)
	if (configured && configured.trim().length > 0) {
		return normalizeOrigin(configured);
	}

	// Safe dev default: proxy Next `/api/*` to local FastAPI on :8000
	if (isDev) {
		return "http://127.0.0.1:8000";
	}

	// In production, disable proxying unless explicitly configured.
	return null;
}

const nextConfig: NextConfig = {
	async rewrites() {
		const target = getApiProxyTarget();
		if (!target) return [];

		return [
			{
				source: "/api/:path*",
				destination: `${target}/api/:path*`,
			},
		];
	},
};

export default nextConfig;
