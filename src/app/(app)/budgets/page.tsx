"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { upsertBudget, listTransactions, ensureBudgetsForMonth, updateBudget, deleteBudget } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { LoadingButton } from "@/components/ui/loading-button";
import { useLoading } from "@/hooks/use-loading";

export default function BudgetsPage() {
	const { user } = useAuth();
	const { isLoading, withLoading } = useLoading();
	const month = new Date().toISOString().slice(0, 7);
	const categoryRef = useRef<HTMLInputElement>(null);
	const limitRef = useRef<HTMLInputElement>(null);
	const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; budgetCategory: string | null }>({
		isOpen: false,
		budgetCategory: null,
	});

	const { data: budgets, refetch: refetchBudgets } = useQuery({
		queryKey: ["budgets", user?.uid, month],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return [];
			return await ensureBudgetsForMonth(user.uid, month);
		},
	});
	const { data: allTx } = useQuery({
		queryKey: ["tx-all", user?.uid],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return [];
			return await listTransactions(user.uid);
		},
	});

	const monthTotals = useMemo(() => {
		const start = new Date(`${month}-01T00:00:00`).getTime();
		const end = new Date(new Date(`${month}-01T00:00:00`).setMonth(new Date(`${month}-01T00:00:00`).getMonth() + 1)).getTime();
		const totals: Record<string, number> = {};
		(allTx || []).forEach((t: { type: string; date: number; category: string; amount: number }) => {
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
		await withLoading("add-budget", async () => {
			await upsertBudget(user.uid, { month, category, limit });
			toast.success("Budget saved");
			categoryRef.current!.value = "";
			limitRef.current!.value = "";
			refetchBudgets();
		});
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
							<LoadingButton 
								onClick={addBudget} 
								className="w-full"
								loading={isLoading("add-budget")}
								loadingText="Saving..."
							>
								Save Budget
							</LoadingButton>
						</div>
					</div>

					<div className="space-y-3 pt-2">
						{(budgets || []).map((b: { id: string; category: string; limit: number }) => {
							const spent = monthTotals[b.category] || 0;
							const pct = b.limit ? Math.min(100, Math.round((spent / b.limit) * 100)) : 0;
							const isOverLimit = spent > b.limit;
							return (
								<div key={b.id} className={isOverLimit ? "border border-red-200 rounded p-2 bg-red-50" : ""}>
								<div className="flex justify-between text-sm mb-1">
										<span className={isOverLimit ? "text-red-600 font-medium" : ""}>{b.category}</span>
									<div className="flex items-center gap-2">
											{isOverLimit && <AlertTriangle size={14} className="text-red-600" />}
											<span className={isOverLimit ? "text-red-600 font-medium" : ""}>₹{spent} / ₹{b.limit}</span>
										<LoadingButton 
											variant="outline" 
											size="sm" 
											loading={isLoading(`edit-budget-${b.category}`)}
											loadingText="Updating..."
											onClick={async () => {
												const newLimit = Number(prompt("New limit", String(b.limit)) || b.limit);
												if (!user) return; 
												await withLoading(`edit-budget-${b.category}`, async () => {
													await updateBudget(user.uid, month, b.category, { limit: newLimit }); 
													toast.success("Budget updated");
													refetchBudgets();
												});
											}}
										>
											Edit
										</LoadingButton>
										<Button variant="destructive" size="sm" onClick={() => {
											setDeleteModal({
												isOpen: true,
												budgetCategory: b.category,
											});
										}}>
											Delete
										</Button>
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

			{/* Delete Confirmation Modal */}
			<ConfirmationModal
				isOpen={deleteModal.isOpen}
				onClose={() => setDeleteModal({ isOpen: false, budgetCategory: null })}
				onConfirm={async () => {
					if (!user || !deleteModal.budgetCategory) return;
					await withLoading(`delete-budget-${deleteModal.budgetCategory || ''}`, async () => {
						await deleteBudget(user.uid, month, deleteModal.budgetCategory!);
						toast.success("Budget deleted");
						refetchBudgets();
					});
				}}
				title="Delete Budget"
				description={`Are you sure you want to delete the budget for "${deleteModal.budgetCategory}"? This action cannot be undone.`}
				confirmText="Delete"
				cancelText="Cancel"
				isLoading={isLoading(`delete-budget-${deleteModal.budgetCategory || ''}`)}
			/>
		</div>
	);
}
