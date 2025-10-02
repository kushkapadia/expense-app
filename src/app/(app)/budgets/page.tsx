"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { listBudgets, upsertBudget, listTransactions, ensureBudgetsForMonth } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { toast } from "sonner";

export default function BudgetsPage() {
	const { user } = useAuth();
	const month = new Date().toISOString().slice(0, 7);
	const categoryRef = useRef<HTMLInputElement>(null);
	const limitRef = useRef<HTMLInputElement>(null);

	const { data: budgets } = useQuery({
		queryKey: ["budgets", user?.uid, month],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return [] as any[];
			return await ensureBudgetsForMonth(user.uid, month);
		},
	});
	const { data: allTx } = useQuery({
		queryKey: ["tx-all", user?.uid],
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

	async function addBudget() {
		if (!user) return;
		const category = categoryRef.current?.value?.trim();
		const limit = Number(limitRef.current?.value || 0);
		if (!category || !limit) return;
		await upsertBudget(user.uid, { month, category, limit });
		toast.success("Budget saved");
		categoryRef.current!.value = "";
		limitRef.current!.value = "";
	}

	return (
		<div className="container mx-auto max-w-3xl py-6 space-y-6 pb-24">
			<Card>
				<CardHeader>
					<CardTitle>Budgets for {month}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid sm:grid-cols-3 gap-2">
						<div className="sm:col-span-2">
							<Label>Category</Label>
							<Input ref={categoryRef} placeholder="Food, Travel, Fuel..." />
						</div>
						<div>
							<Label>Limit (₹)</Label>
							<Input ref={limitRef} type="number" placeholder="10000" />
						</div>
						<div className="sm:col-span-3">
							<Button onClick={addBudget} className="w-full">Save Budget</Button>
						</div>
					</div>

					<div className="space-y-3 pt-2">
						{(budgets || []).map((b: any) => {
							const spent = monthTotals[b.category] || 0;
							const pct = b.limit ? Math.min(100, Math.round((spent / b.limit) * 100)) : 0;
							const isOverLimit = spent > b.limit;
							return (
								<div key={b.id} className={isOverLimit ? "border border-red-200 rounded p-2 bg-red-50" : ""}>
									<div className="flex justify-between text-sm mb-1">
										<span className={isOverLimit ? "text-red-600 font-medium" : ""}>{b.category}</span>
										<div className="flex items-center gap-1">
											{isOverLimit && <AlertTriangle size={14} className="text-red-600" />}
											<span className={isOverLimit ? "text-red-600 font-medium" : ""}>₹{spent} / ₹{b.limit}</span>
										</div>
									</div>
									<Progress value={pct} className={isOverLimit ? "[&>div]:bg-red-500" : ""} />
									{isOverLimit && (
										<div className="text-xs text-red-600 mt-1 flex items-center gap-1">
											<AlertTriangle size={12} />
											Over budget by ₹{spent - b.limit}
										</div>
									)}
								</div>
							);
						})}
						{(budgets || []).length === 0 && (
							<div className="text-muted-foreground text-sm">
								No budgets yet. Create one above to see budget tracking with over-limit alerts.
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
