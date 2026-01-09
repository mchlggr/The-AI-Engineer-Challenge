import type { Metadata } from "next";
import {
	Instrument_Serif,
	Inter,
	JetBrains_Mono,
	Permanent_Marker,
	Tilt_Warp,
} from "next/font/google";
import "@/styles/globals.css";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { TelemetryProvider } from "@/components/TelemetryProvider";
import { QueryProvider } from "@/lib/query-provider";

const brandSans = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
	display: "swap",
	weight: ["400", "500", "600", "700"],
});

const brandMono = JetBrains_Mono({
	variable: "--font-jetbrains-mono",
	subsets: ["latin"],
	display: "swap",
	weight: ["400", "500", "600"],
});

const brandDisplay = Instrument_Serif({
	variable: "--font-instrument-serif",
	subsets: ["latin"],
	display: "swap",
	style: ["normal", "italic"],
	weight: "400",
});

const brandLogo = Tilt_Warp({
	variable: "--font-logo",
	subsets: ["latin"],
	display: "swap",
	weight: "400",
});

const brandHand = Permanent_Marker({
	variable: "--font-hand",
	subsets: ["latin"],
	display: "swap",
	weight: "400",
});

export const metadata: Metadata = {
	title: "Calendar Club | Discover Local Tech Events",
	description:
		"A curated directory of the best technical meetups. No noise, just deep cuts.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${brandSans.variable} ${brandMono.variable} ${brandDisplay.variable} ${brandLogo.variable} ${brandHand.variable} min-h-screen bg-page font-sans antialiased`}
			>
				<TelemetryProvider>
					<QueryProvider>
						<Header />
						<main>{children}</main>
						<Footer />
					</QueryProvider>
				</TelemetryProvider>
			</body>
		</html>
	);
}
