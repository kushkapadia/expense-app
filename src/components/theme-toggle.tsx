"use client";

import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { Sun, MoonStar } from "lucide-react";

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const isDark = theme === "dark";
	return (
		<div className="inline-flex items-center gap-2 text-muted-foreground">
			<Sun size={16} className={!isDark ? "text-yellow-500" : "opacity-50"} />
			<Switch id="theme" checked={isDark} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
			<MoonStar size={16} className={isDark ? "text-indigo-400" : "opacity-50"} />
		</div>
	);
}

