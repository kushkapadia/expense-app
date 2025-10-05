"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { createTransaction, listTransactions, markSettlement, adjustWalletBalance, updateTransaction, deleteTransaction } from "@/lib/db";
import type { WalletType } from "@/types/db";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input as UITextInput } from "@/components/ui/input";
import { Label as UILabel } from "@/components/ui/label";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { LoadingButton } from "@/components/ui/loading-button";
import { useLoading } from "@/hooks/use-loading";

const schema = z.object({
	date: z.string(),
	amount: z.coerce.number().positive(),
	category: z.string().min(1),
	item: z.string().min(1, { message: "Item is required" }),
	wallet: z.enum(["cash", "gpay", "investment"] as const),
	type: z.enum(["expense", "income", "transfer"] as const),
	notes: z.string().optional(),
	isSettlement: z.boolean().optional(),
});

export default function TransactionsPage() {
	const { user } = useAuth();
	const { isLoading, withLoading } = useLoading();
	const [walletFilter, setWalletFilter] = useState<WalletType | "all">("all");
	const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income" | "transfer">("all");
	const [openEditModals, setOpenEditModals] = useState<Record<string, boolean>>({});
	const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; transactionId: string | null; transactionItem: string }>({
		isOpen: false,
		transactionId: null,
		transactionItem: "",
	});
	const { data: recent, refetch } = useQuery({
		queryKey: ["all-transactions", user?.uid],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return [] as any[];
			return await listTransactions(user.uid);
		},
	});

	const form = useForm({
		resolver: zodResolver(schema),
		defaultValues: {
			date: new Date().toISOString().slice(0, 10),
			amount: 0,
			category: "",
			item: "",
			wallet: "cash",
			type: "expense",
			notes: "",
			isSettlement: false,
		},
	});

	async function onSubmit(values: z.infer<typeof schema>) {
		if (!user) return;
		await withLoading("create-transaction", async () => {
			await createTransaction(user.uid, {
				date: new Date(values.date).getTime(),
				amount: values.amount,
				category: values.category,
				item: values.item,
				wallet: values.wallet as WalletType,
				type: values.type,
				notes: values.notes,
				isSettlement: values.isSettlement,
				settled: values.type === "transfer" ? true : false,
			});
			// Wallet balance updates are now handled in createTransaction
			toast.success("Transaction added");
			form.reset({ ...form.getValues(), amount: 0, category: "", isSettlement: false });
			refetch();
		});
	}


	async function settle(txId: string, wallet: WalletType) {
		if (!user) return;
		await withLoading(`settle-${txId}`, async () => {
			await markSettlement(user.uid, txId);
			// Add the settlement amount to the selected wallet
			const tx = recent?.find((t: any) => t.id === txId);
			if (tx) {
				await adjustWalletBalance(user.uid, wallet, tx.amount, `Settlement: ${tx.category}`);
			}
			toast.success(`Settled via ${wallet}`);
			refetch();
		});
	}

    const filtered = (recent || [])
        .filter((t: any) => (walletFilter === "all" || t.wallet === walletFilter) && (typeFilter === "all" || t.type === typeFilter))
        .sort((a: any, b: any) => (b.date ?? 0) - (a.date ?? 0));

	return (
		<div className="container mx-auto max-w-4xl py-6 space-y-6 pb-24">
			<Card>
				<CardHeader>
					<CardTitle>Add Transaction</CardTitle>
				</CardHeader>
				<CardContent>
					<form className="grid sm:grid-cols-2 gap-3" onSubmit={form.handleSubmit(onSubmit)}>
						<div>
							<Label htmlFor="date">Date</Label>
							<Input id="date" type="date" {...form.register("date")} />
						</div>
						<div>
							<Label htmlFor="amount">Amount</Label>
							<Input id="amount" type="number" step="0.01" {...form.register("amount", { valueAsNumber: true })} />
						</div>
						<div>
							<Label>Category</Label>
							<Input {...form.register("category")} placeholder="Food, Travel..." />
						</div>
		<div>
			<Label>Item</Label>
			<Input {...form.register("item")} placeholder="e.g., Coffee, Bus Ticket" />
		</div>
						<div>
							<Label>Wallet</Label>
							<Select defaultValue={form.getValues("wallet")} onValueChange={(v) => form.setValue("wallet", v as any)}>
								<SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
								<SelectContent>
									<SelectItem value="cash">Cash</SelectItem>
									<SelectItem value="gpay">GPay</SelectItem>
									<SelectItem value="investment">Investment</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label>Type</Label>
							<Select defaultValue={form.getValues("type")} onValueChange={(v) => form.setValue("type", v as any)}>
								<SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
								<SelectContent>
									<SelectItem value="expense">Expense</SelectItem>
									<SelectItem value="income">Income</SelectItem>
									<SelectItem value="transfer">Transfer</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center gap-2">
							<input id="settlement" type="checkbox" {...form.register("isSettlement")} />
							<Label htmlFor="settlement">Paid for someone else</Label>
						</div>
						<div className="sm:col-span-2">
							<Label>Notes</Label>
							<Input {...form.register("notes")} placeholder="Optional" />
						</div>
						<div className="sm:col-span-2">
							<LoadingButton 
								type="submit" 
								className="w-full"
								loading={isLoading("create-transaction")}
								loadingText="Adding..."
							>
								Add
							</LoadingButton>
						</div>
					</form>
					<div className="mt-3 flex flex-wrap gap-2">
						<Button variant="outline" size="sm" onClick={() => {
							if (!user) return;
							createTransaction(user.uid, {
								date: new Date().getTime(),
								amount: 60,
								category: "Metro",
								wallet: "cash",
								type: "expense",
								notes: "Quick add: Metro"
							}).then(() => { toast.success("Added Metro"); refetch(); });
						}}>🚇 Metro ₹60</Button>
						<Button variant="outline" size="sm" onClick={() => {
							if (!user) return;
							createTransaction(user.uid, {
								date: new Date().getTime(),
								amount: 40,
								category: "Coffee",
								wallet: "cash",
								type: "expense",
								notes: "Quick add: Coffee"
							}).then(() => { toast.success("Added Coffee"); refetch(); });
						}}>☕ Coffee ₹40</Button>
						<Button variant="outline" size="sm" onClick={() => {
							if (!user) return;
							createTransaction(user.uid, {
								date: new Date().getTime(),
								amount: 200,
								category: "Fuel",
								wallet: "cash",
								type: "expense",
								notes: "Quick add: Fuel"
							}).then(() => { toast.success("Added Fuel"); refetch(); });
						}}>🛵 Fuel ₹200</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Recent Transactions</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex gap-2">
						<Select defaultValue="all" onValueChange={(v) => setWalletFilter(v as any)}>
							<SelectTrigger className="w-40"><SelectValue placeholder="Wallet" /></SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Wallets</SelectItem>
								<SelectItem value="cash">Cash</SelectItem>
								<SelectItem value="gpay">GPay</SelectItem>
								<SelectItem value="investment">Investment</SelectItem>
							</SelectContent>
						</Select>
						<Select defaultValue="all" onValueChange={(v) => setTypeFilter(v as any)}>
							<SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Types</SelectItem>
								<SelectItem value="expense">Expense</SelectItem>
								<SelectItem value="income">Income</SelectItem>
								<SelectItem value="transfer">Transfer</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="divide-y">
						{filtered.map((t: any) => (
							<div key={t.id ?? t.createdAt} className="flex items-center justify-between py-2 text-sm">
								<div>
								<div className="font-medium">{t.category} {t.item ? `• ${t.item}` : ""} • {t.type}</div>
									<div className="text-muted-foreground">{new Date(t.date).toLocaleDateString()} • {t.wallet}</div>
									{t.notes && <div className="text-muted-foreground text-xs">{t.notes}</div>}
								</div>
								<div className="flex items-center gap-2">
									<div className={t.type === "income" ? "text-green-600" : t.type === "expense" ? "text-red-600" : ""}>₹{t.amount}</div>
									{/* Edit */}
									<Dialog open={openEditModals[t.id] || false} onOpenChange={(open) => setOpenEditModals(prev => ({ ...prev, [t.id]: open }))}>
										<DialogTrigger asChild>
											<Button variant="outline" size="sm">Edit</Button>
										</DialogTrigger>
										<DialogContent>
											<DialogHeader>
												<DialogTitle>Edit transaction</DialogTitle>
											</DialogHeader>
											<div className="grid gap-3">
												<UILabel>Amount</UILabel>
												<UITextInput defaultValue={t.amount} type="number" id={`amt-${t.id}`} />
												<UILabel>Category</UILabel>
												<UITextInput defaultValue={t.category} id={`cat-${t.id}`} />
												<UILabel>Item</UILabel>
												<UITextInput defaultValue={t.item || ""} id={`itm-${t.id}`} />
												<UILabel>Notes</UILabel>
												<UITextInput defaultValue={t.notes || ""} id={`note-${t.id}`} />
												<LoadingButton 
													loading={isLoading(`update-transaction-${t.id}`)}
													loadingText="Saving..."
													onClick={async () => {
														if (!user) return;
														await withLoading(`update-transaction-${t.id}`, async () => {
															const amt = Number((document.getElementById(`amt-${t.id}`) as HTMLInputElement)?.value || t.amount);
															const cat = (document.getElementById(`cat-${t.id}`) as HTMLInputElement)?.value || t.category;
															const itm = (document.getElementById(`itm-${t.id}`) as HTMLInputElement)?.value || t.item;
															const note = (document.getElementById(`note-${t.id}`) as HTMLInputElement)?.value || t.notes;
															await updateTransaction(user.uid, t.id, { amount: amt, category: cat, item: itm, notes: note });
															toast.success("Transaction updated");
															setOpenEditModals(prev => ({ ...prev, [t.id]: false }));
															refetch();
														});
													}}
												>
													Save
												</LoadingButton>
											</div>
										</DialogContent>
									</Dialog>
									{/* Delete */}
									<Button variant="destructive" size="sm" onClick={() => {
										setDeleteModal({
											isOpen: true,
											transactionId: t.id,
											transactionItem: t.item || t.category,
										});
									}}>Delete</Button>
									{t.isSettlement && !t.settled && (
										<Dialog>
											<DialogTrigger asChild>
												<Button variant="outline" size="sm">Settle</Button>
											</DialogTrigger>
											<DialogContent>
												<DialogHeader>
													<DialogTitle>Settle via</DialogTitle>
												</DialogHeader>
												<div className="grid gap-3">
													<LoadingButton 
														loading={isLoading(`settle-${t.id}`)}
														loadingText="Settling..."
														onClick={() => settle(t.id, "cash")} 
														className="w-full"
													>
														💵 Cash
													</LoadingButton>
													<LoadingButton 
														loading={isLoading(`settle-${t.id}`)}
														loadingText="Settling..."
														onClick={() => settle(t.id, "gpay")} 
														className="w-full"
													>
														📲 GPay
													</LoadingButton>
												</div>
											</DialogContent>
										</Dialog>
									)}
								</div>
							</div>
						))}
						{filtered.length === 0 && <div className="text-muted-foreground">No transactions yet</div>}
					</div>
				</CardContent>
			</Card>

			{/* Delete Confirmation Modal */}
			<ConfirmationModal
				isOpen={deleteModal.isOpen}
				onClose={() => setDeleteModal({ isOpen: false, transactionId: null, transactionItem: "" })}
				onConfirm={async () => {
					if (!user || !deleteModal.transactionId) return;
					await withLoading(`delete-transaction-${deleteModal.transactionId || ''}`, async () => {
						await deleteTransaction(user.uid, deleteModal.transactionId!);
						toast.success("Transaction deleted");
						refetch();
					});
				}}
				title="Delete Transaction"
				description={`Are you sure you want to delete "${deleteModal.transactionItem}"? This action cannot be undone.`}
				confirmText="Delete"
				cancelText="Cancel"
				isLoading={isLoading(`delete-transaction-${deleteModal.transactionId || ''}`)}
			/>
		</div>
	);
}
