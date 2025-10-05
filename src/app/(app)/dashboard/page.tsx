"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { LoadingButton } from "@/components/ui/loading-button";
import { useLoading } from "@/hooks/use-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { getWallets, applyPreset, adjustWalletBalance, listRecentTransactions, listTransactions, listPresets, ensureBudgetsForMonth, getGroupSettlements, getUserExpenseGroups } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useMemo, useRef, useState } from "react";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { motion } from "framer-motion";
import TransferModal from "./transfer-modal";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function DashboardPage() {
	const { user } = useAuth();
	const { isLoading, withLoading } = useLoading();
	const router = useRouter();
	const [openModals, setOpenModals] = useState<Record<string, boolean>>({});
	const { data: wallets, refetch } = useQuery({
		queryKey: ["wallets", user?.uid],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return null;
			return await getWallets(user.uid);
		},
	});

    const { data: recent } = useQuery({
		queryKey: ["recent-dashboard", user?.uid],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return [];
			return await listRecentTransactions(user.uid, 50);
		},
	});

    const { data: recentList } = useQuery({
		queryKey: ["recent-list", user?.uid],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return [];
            const items = await listRecentTransactions(user.uid, 8);
            return items.sort((a: { date?: number }, b: { date?: number }) => (b.date ?? 0) - (a.date ?? 0));
		},
	});

	const month = new Date().toISOString().slice(0, 7);
	const { data: budgets } = useQuery({
		queryKey: ["budgets-snippet", user?.uid, month],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return [] as any[];
			return await ensureBudgetsForMonth(user.uid, month);
		},
	});

	const { data: presets } = useQuery({
		queryKey: ["presets", user?.uid],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return [] as any[];
			return await listPresets(user.uid);
		},
	});
	const { data: allTx } = useQuery({
		queryKey: ["tx-all-dashboard", user?.uid],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return [] as any[];
			return await listTransactions(user.uid);
		},
	});

	const monthTotals = useMemo(() => {
		const start = new Date(`${month}-01T00:00:00`).getTime();
		const end = new Date(new Date(`${month}-01T00:00:00`).setMonth(new Date(`${month}-01T00:00:00`).getMonth() + 1)).getTime();
		const totals: Record<string, number> = {};
		(allTx || []).forEach((t: any) => {
			if (t.type !== "expense") return;
			if (t.date < start || t.date >= end) return;
			totals[t.category] = (totals[t.category] || 0) + t.amount;
		});
		return totals;
	}, [allTx, month]);

	const { data: settlements } = useQuery({
		queryKey: ["settlements-snippet", user?.uid],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return { individual: [], group: [] };
			
			// Fetch individual settlements
			const allTransactions = await listTransactions(user.uid);
			const individualSettlements = allTransactions.filter((t: any) => t.isSettlement && !t.settled).slice(0, 3);
			
			// Fetch group settlements where user is involved
			const userGroups = await getUserExpenseGroups(user.uid);
			const groupSettlements: any[] = [];
			
			for (const group of userGroups) {
				const settlements = await getGroupSettlements(group.id);
				const userSettlements = settlements.filter(s => 
					s.fromUserId === user.uid || s.toUserId === user.uid
				);
				groupSettlements.push(...userSettlements);
			}
			
			// Limit group settlements to 2 for dashboard
			return { individual: individualSettlements, group: groupSettlements.slice(0, 2) };
		},
	});

	async function onPreset(presetId: string, wallet: "cash" | "gpay") {
		if (!user) return;
		await applyPreset(user.uid, presetId, wallet);
		toast.success(`Applied preset via ${wallet}`);
		setOpenModals(prev => ({ ...prev, [presetId]: false }));
		refetch();
	}

	const cash = wallets?.cash?.balance ?? 0;
	const gpay = wallets?.gpay?.balance ?? 0;
	const invest = wallets?.investment?.balance ?? 0;
	const balanceLeft = cash + gpay;

	const addCashRef = useRef<HTMLInputElement>(null);
	const addGpayRef = useRef<HTMLInputElement>(null);

	async function addBalance(type: "cash" | "gpay") {
		if (!user) return;
		const input = type === "cash" ? addCashRef.current : addGpayRef.current;
		const value = Number(input?.value || 0);
		if (!value) return;
		await adjustWalletBalance(user.uid, type, value, "Manual addition");
		toast.success(`Added ₹${value} to ${type}`);
		input!.value = "";
		refetch();
	}

	const categoryData = useMemo(() => {
		const map: Record<string, number> = {};
		(recent || []).forEach((t: any) => {
			if (t.type !== "expense") return;
			map[t.category] = (map[t.category] || 0) + t.amount;
		});
		return Object.entries(map).map(([name, value]) => ({ name, value }));
	}, [recent]);

	const colors = ["#6366F1", "#22C55E", "#F97316", "#EC4899", "#06B6D4", "#F59E0B"];

	return (
		<div className="container mx-auto max-w-5xl py-6 space-y-6 pb-24">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{[
					{ label: "💵 Cash", value: cash, inputRef: addCashRef, key: "cash" },
					{ label: "📲 GPay", value: gpay, inputRef: addGpayRef, key: "gpay" },
					{ label: "📈 Investment", value: invest, key: "investment" },
					{ label: "💼 Balance Left", value: balanceLeft, key: "left" },
				].map((c, i) => (
					<motion.div key={c.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
						<Card className="rounded-xl shadow-sm">
							<CardHeader>
								<CardTitle className="text-sm">{c.label}</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2">
								<div className="text-2xl font-semibold">₹{c.value}</div>
								{c.inputRef && (
									<div className="flex gap-2">
										<Input ref={c.inputRef as any} type="number" placeholder="Add ₹" />
										<Button size="sm" onClick={() => addBalance(c.key as any)}>Add</Button>
									</div>
								)}
							</CardContent>
						</Card>
					</motion.div>
				))}
			</div>

			<div className="flex items-center justify-end"><TransferModal userId={user?.uid || ""} after={() => refetch()} /></div>

			<Tabs defaultValue="overview" className="w-full">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="overview">📊 Overview</TabsTrigger>
					<TabsTrigger value="budgets">⚡ Budgets</TabsTrigger>
					<TabsTrigger value="settlements">🤝 Settlements</TabsTrigger>
				</TabsList>
				<TabsContent value="overview" className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Card className="rounded-xl shadow-sm">
							<CardHeader>
								<CardTitle>Monthly Spend by Category</CardTitle>
							</CardHeader>
							<CardContent style={{ height: 260 }}>
								<ResponsiveContainer width="100%" height="100%">
									<PieChart>
										<Pie 
											dataKey="value" 
											data={categoryData} 
											cx="50%" 
											cy="50%" 
											outerRadius={80}
											label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
											labelLine={false}
										>
											{categoryData.map((_, idx) => (<Cell key={idx} fill={colors[idx % colors.length]} />))}
										</Pie>
										<Tooltip 
											formatter={(value: any) => [`₹${value}`, 'Amount']}
											labelFormatter={(label) => `Category: ${label}`}
										/>
										<Legend />
									</PieChart>
								</ResponsiveContainer>
							</CardContent>
						</Card>
						<Card className="rounded-xl shadow-sm">
							<CardHeader>
								<CardTitle>Recent Transactions</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2">
								<div className="divide-y">
									{(recentList || []).map((t: any) => (
										<div key={t.id ?? t.createdAt} className="flex items-center justify-between py-2 text-sm">
											<div>
											<div className="font-medium">{t.category} {t.item ? `• ${t.item}` : ""} • {t.type}</div>
												<div className="text-muted-foreground">{new Date(t.date).toLocaleDateString()} • {t.wallet}</div>
											</div>
											<div className={t.type === "income" ? "text-green-600" : t.type === "expense" ? "text-red-600" : ""}>₹{t.amount}</div>
										</div>
									))}
									{(recentList || []).length === 0 && <div className="text-muted-foreground">No transactions</div>}
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>
				<TabsContent value="budgets">
					<Card className="rounded-xl shadow-sm">
						<CardHeader>
							<CardTitle>Budgets</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{(budgets || []).slice(0,3).map((b: any) => {
								const spent = monthTotals[b.category] || 0;
								const pct = b.limit ? Math.min(100, Math.round((spent / b.limit) * 100)) : 0;
								const isOverLimit = spent > b.limit;
								return (
									<div key={b.id}>
										<div className="flex justify-between text-sm mb-1">
											<span className={isOverLimit ? "text-red-600 font-medium" : ""}>{b.category}</span>
											<div className="flex items-center gap-1">
												{isOverLimit && <AlertTriangle size={14} className="text-red-600" />}
												<span className={isOverLimit ? "text-red-600 font-medium" : ""}>₹{spent} / ₹{b.limit}</span>
											</div>
										</div>
										<Progress value={pct} className={isOverLimit ? "[&>div]:bg-red-500" : ""} />
									</div>
								);
							})}
							{(budgets || []).length === 0 && <div className="text-sm text-muted-foreground">No budgets yet</div>}
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="settlements">
					<Card className="rounded-xl shadow-sm">
						<CardHeader>
							<CardTitle>Pending Settlements</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							{/* Individual Settlements */}
							{(settlements?.individual || []).map((t: any) => (
								<div key={t.id} className="text-sm flex items-center justify-between">
									<div>{t.category} • ₹{t.amount}</div>
									<div className="text-muted-foreground">{new Date(t.date).toLocaleDateString()}</div>
								</div>
							))}
							
							{/* Group Settlements */}
							{(settlements?.group || []).map((s: any) => (
								<div key={s.id} className="text-sm flex items-center justify-between">
									<div>Group • ₹{s.amount}</div>
									<div className="text-muted-foreground">{s.status === "pending" ? "Pending" : "Completed"}</div>
								</div>
							))}
							
							{((settlements?.individual || []).length + (settlements?.group || []).length) === 0 && (
								<div className="text-sm text-muted-foreground">No pending settlements</div>
							)}
							<Separator />
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<Card className="rounded-xl shadow-sm">
				<CardHeader>
					<CardTitle>Quick Add Presets</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					{(presets || []).map((p: any) => (
						<Dialog key={p.id} open={openModals[p.id] || false} onOpenChange={(open) => setOpenModals(prev => ({ ...prev, [p.id]: open }))}>
							<DialogTrigger asChild>
								<Badge variant="secondary" className="cursor-pointer">
									{p.emoji} {p.label} ₹{p.amount}
								</Badge>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Apply preset via</DialogTitle>
								</DialogHeader>
								<div className="grid gap-3">
									<LoadingButton 
										loading={isLoading(`apply-preset-dash-${p.id}`)}
										loadingText="Applying..."
										onClick={() => withLoading(`apply-preset-dash-${p.id}`, async () => onPreset(p.id, "cash"))}
										className="w-full"
									>
										💵 Cash
									</LoadingButton>
									<LoadingButton 
										loading={isLoading(`apply-preset-dash-${p.id}`)}
										loadingText="Applying..."
										onClick={() => withLoading(`apply-preset-dash-${p.id}`, async () => onPreset(p.id, "gpay"))}
										className="w-full"
									>
										📲 GPay
									</LoadingButton>
								</div>
							</DialogContent>
						</Dialog>
					))}
					{(presets || []).length === 0 && (
						<div className="text-sm text-muted-foreground">No presets yet. Create them in Settings.</div>
					)}
				</CardContent>
			</Card>

			{/* Floating Action Button navigates to Transactions */}
			<motion.button onClick={() => router.push("/transactions")} className="sm:hidden fixed bottom-16 right-4 z-40 rounded-full bg-indigo-600 text-white shadow-lg px-5 py-3" whileTap={{ scale: 0.95 }}>
				+ Add
			</motion.button>
		</div>
	);
}

