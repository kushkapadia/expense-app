"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ReceiptText, Target, Handshake, Settings, BarChart3, History, Users, Wifi, WifiOff } from "lucide-react";
import { useOffline } from "@/hooks/use-offline";

const links = [
	{ href: "/dashboard", label: "Home", icon: Home },
	{ href: "/transactions", label: "Transactions", icon: ReceiptText },
	{ href: "/budgets", label: "Budgets", icon: Target },
	{ href: "/groups", label: "Groups", icon: Users },
	{ href: "/analytics", label: "Analytics", icon: BarChart3 },
	{ href: "/wallet-history", label: "History", icon: History },
	{ href: "/settlements", label: "Settle", icon: Handshake },
	{ href: "/settings", label: "Settings", icon: Settings },
];

export default function NavBar() {
	const { user } = useAuth();
	const { isOffline } = useOffline();
	const pathname = usePathname();
	return (
		<>
			{/* Desktop top navbar */}
			<header className="hidden sm:block sticky top-0 z-30 w-full border-b bg-background/80 backdrop-blur">
				<div className="container mx-auto max-w-5xl h-14 flex items-center justify-between gap-3 px-3">
					<Link href="/dashboard" className="font-semibold">💸 Expense Manager</Link>
					<nav className="flex items-center gap-4 text-sm">
						{links.map((l) => (
							<Link key={l.href} href={l.href} className={pathname.startsWith(l.href) ? "font-medium" : "text-muted-foreground hover:text-foreground"}>{l.label}</Link>
						))}
					</nav>
					<div className="flex items-center gap-3">
						{/* Connection Status Indicator */}
						<div className="flex items-center gap-1 text-xs">
							{isOffline ? (
								<>
									<WifiOff className="h-3 w-3 text-orange-500" />
									<span className="text-orange-500 hidden lg:inline">Offline</span>
								</>
							) : (
								<>
									<Wifi className="h-3 w-3 text-green-500" />
									<span className="text-green-500 hidden lg:inline">Online</span>
								</>
							)}
						</div>
						<ThemeToggle />
						{!user && (
							<Button asChild size="sm"><Link href="/login">Login</Link></Button>
						)}
					</div>
				</div>
			</header>

			{/* Mobile connection status indicator */}
			<div className="sm:hidden fixed top-4 right-4 z-40">
				<div className="flex items-center gap-1 bg-background/90 backdrop-blur rounded-full px-2 py-1 border">
					{isOffline ? (
						<WifiOff className="h-3 w-3 text-orange-500" />
					) : (
						<Wifi className="h-3 w-3 text-green-500" />
					)}
				</div>
			</div>

			{/* Mobile bottom nav with icons */}
			<nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur pb-[calc(env(safe-area-inset-bottom))]">
				<div className="mx-auto max-w-5xl grid grid-cols-8 text-[10px]">
					{links.map((l) => {
						const Icon = l.icon;
						const active = pathname.startsWith(l.href);
						return (
							<Link key={l.href} href={l.href} className={`py-2 text-center flex flex-col items-center gap-1 ${active ? "text-foreground" : "text-muted-foreground"}`}>
								<div className={`p-1.5 rounded-lg ${active ? "bg-primary/10" : ""}`}>
									<Icon size={16} />
								</div>
								<span className="font-medium">{l.label}</span>
							</Link>
						);
					})}
				</div>
			</nav>
		</>
	);
}
