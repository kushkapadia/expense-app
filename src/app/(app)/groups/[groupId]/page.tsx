"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Users, ArrowLeft, Receipt, Calculator, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { 
	getExpenseGroup, 
	getGroupExpenses, 
	createGroupExpense,
	createGroupSettlements,
	getGroupSettlements,
	getUserNames,
	setUserName,
	markSettlementComplete
} from "@/lib/db";
import type { ExpenseGroup, GroupExpense, GroupSettlement } from "@/types/db";
import { getUserDisplayNameById, getUserDisplayName } from "@/lib/user-utils";

export default function GroupPage() {
	const { user } = useAuth();
	const params = useParams();
	const router = useRouter();
	const groupId = params.groupId as string;
	
	const [group, setGroup] = useState<ExpenseGroup | null>(null);
	const [expenses, setExpenses] = useState<GroupExpense[]>([]);
	const [settlements, setSettlements] = useState<GroupSettlement[]>([]);
	const [userNames, setUserNames] = useState<Record<string, string>>({});
	const [loading, setLoading] = useState(true);
	const [addExpenseOpen, setAddExpenseOpen] = useState(false);
	const [settlementModalOpen, setSettlementModalOpen] = useState(false);
	const [selectedSettlement, setSelectedSettlement] = useState<GroupSettlement | null>(null);

	// Add expense form state
	const [expenseAmount, setExpenseAmount] = useState("");
	const [expenseDescription, setExpenseDescription] = useState("");
	const [expenseCategory, setExpenseCategory] = useState("");
	const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
	const [expenseWallet, setExpenseWallet] = useState<"cash" | "gpay">("cash");

	// Settlement form state
	const [settlementWallet, setSettlementWallet] = useState<"cash" | "gpay">("cash");
	const [settlementNotes, setSettlementNotes] = useState("");

	useEffect(() => {
		if (groupId && user) {
			loadGroupData();
		}
	}, [groupId, user]);

	// Initialize selected members when group loads
	useEffect(() => {
		if (group && group.memberIds.length > 0) {
			// By default, select all members
			setSelectedMembers([...group.memberIds]);
		}
	}, [group]);

	const loadGroupData = async () => {
		try {
			setLoading(true);
			console.log("🔄 Starting loadGroupData for group:", groupId);
			
			const [groupData, expensesData] = await Promise.all([
				getExpenseGroup(groupId),
				getGroupExpenses(groupId)
			]);
			
			if (!groupData) {
				toast.error("Group not found");
				router.push("/groups");
				return;
			}
			
			console.log("📊 Group data loaded:", groupData);
			console.log("💰 Expenses loaded:", expensesData);
			
			setGroup(groupData);
			setExpenses(expensesData);
			
			// Store current user's name if not already stored
			if (user) {
				const currentUserName = getUserDisplayName(user);
				await setUserName(user.uid, currentUserName);
			}
			
			// Get user names for all group members
			const names = await getUserNames(groupData.memberIds);
			setUserNames(names);
			
			console.log("👥 User names loaded:", names);
			
			// Create/update settlements in database
			console.log("🔄 Creating/updating settlements...");
			await createGroupSettlements(groupId);
			
			// Load settlements from database
			console.log("📋 Loading settlements from database...");
			const settlementsData = await getGroupSettlements(groupId);
			console.log("✅ Final settlements to display:", settlementsData);
			setSettlements(settlementsData);
		} catch (error) {
			console.error("❌ Error loading group data:", error);
			toast.error("Failed to load group data");
		} finally {
			setLoading(false);
		}
	};

	const handleAddExpense = async () => {
		if (!user || !group || !expenseAmount || !expenseDescription || !expenseCategory) return;
		
		if (selectedMembers.length === 0) {
			toast.error("Please select at least one member to split the expense");
			return;
		}
		
		try {
			const amount = parseFloat(expenseAmount);
			if (isNaN(amount) || amount <= 0) {
				toast.error("Please enter a valid amount");
				return;
			}

			// Create split details - always equal split for now
			const amountPerPerson = amount / selectedMembers.length;
			const splitDetails = selectedMembers
				.map(memberId => ({
					userId: memberId,
					amount: amountPerPerson,
					settled: memberId === user.uid // Person who paid is already "settled"
				}));

			console.log("💸 Creating expense with details:", {
				groupId,
				paidBy: user.uid,
				amount,
				description: expenseDescription,
				category: expenseCategory,
				splitDetails,
				wallet: expenseWallet
			});

			await createGroupExpense(
				groupId,
				user.uid,
				amount,
				expenseDescription,
				expenseCategory,
				"equal", // Always use equal split for now
				splitDetails,
				expenseWallet
			);

			console.log("✅ Expense created successfully!");
			toast.success("Expense added successfully!");
			resetExpenseForm();
			setAddExpenseOpen(false);
			
			// Reload group data and recalculate settlements
			console.log("🔄 Reloading group data after expense creation...");
			await loadGroupData();
		} catch (error) {
			console.error("Error adding expense:", error);
			if (error instanceof Error) {
				toast.error(error.message);
			} else {
				toast.error("Failed to add expense");
			}
		}
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR'
		}).format(amount);
	};

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString('en-IN', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	};

	const getUserName = (userId: string) => {
		return getUserDisplayNameById(userId, user, userNames);
	};

	const toggleMemberSelection = (memberId: string) => {
		setSelectedMembers(prev => {
			if (prev.includes(memberId)) {
				return prev.filter(id => id !== memberId);
			} else {
				return [...prev, memberId];
			}
		});
	};

	const selectAllMembers = () => {
		if (group) {
			setSelectedMembers([...group.memberIds]);
		}
	};

	const deselectAllMembers = () => {
		setSelectedMembers([]);
	};

	const resetExpenseForm = () => {
		setExpenseAmount("");
		setExpenseDescription("");
		setExpenseCategory("");
		setExpenseWallet("cash");
		if (group) {
			setSelectedMembers([...group.memberIds]);
		}
	};

	const resetSettlementForm = () => {
		setSettlementWallet("cash");
		setSettlementNotes("");
		setSelectedSettlement(null);
	};

	const handleMarkSettlement = (settlement: GroupSettlement) => {
		setSelectedSettlement(settlement);
		setSettlementModalOpen(true);
	};

	const handleSettlementComplete = async () => {
		if (!selectedSettlement || !user) return;

		try {
			console.log("🏁 Marking settlement as complete:", {
				settlementId: selectedSettlement.id,
				fromUserId: selectedSettlement.fromUserId,
				toUserId: selectedSettlement.toUserId,
				amount: selectedSettlement.amount,
				wallet: settlementWallet,
				notes: settlementNotes
			});

			// Mark settlement as complete with wallet type and notes
			await markSettlementComplete(
				selectedSettlement.id, 
				settlementWallet, 
				settlementNotes.trim() || undefined
			);
			
			console.log("✅ Settlement marked as completed in database");
			
			// Update local state
			setSettlements(prev => 
				prev.map(s => 
					s.id === selectedSettlement.id 
						? { ...s, status: "completed", completedAt: Date.now() }
						: s
				)
			);

			console.log("🔄 Updated local settlements state");
			toast.success("Settlement marked as completed!");
			setSettlementModalOpen(false);
			resetSettlementForm();
		} catch (error) {
			console.error("❌ Error marking settlement:", error);
			if (error instanceof Error) {
				toast.error(error.message);
			} else {
				toast.error("Failed to mark settlement as completed");
			}
		}
	};

	if (loading) {
		return (
			<div className="container mx-auto max-w-4xl p-6">
				<div className="flex items-center justify-center h-64">
					<div className="text-muted-foreground">Loading group...</div>
				</div>
			</div>
		);
	}

	if (!group) {
		return (
			<div className="container mx-auto max-w-4xl p-6">
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Users className="w-12 h-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-2">Group not found</h3>
						<p className="text-muted-foreground text-center mb-4">
							The group you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
						</p>
						<Button asChild>
							<Link href="/groups">Back to Groups</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-4xl p-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="sm" asChild>
						<Link href="/groups">
							<ArrowLeft className="w-4 h-4 mr-2" />
							Back
						</Link>
					</Button>
					<div>
						<h1 className="text-3xl font-bold">{group.name}</h1>
						{group.description && (
							<p className="text-muted-foreground">{group.description}</p>
						)}
					</div>
				</div>
				<Dialog open={addExpenseOpen} onOpenChange={(open) => {
					setAddExpenseOpen(open);
					if (!open) {
						resetExpenseForm();
					}
				}}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="w-4 h-4 mr-2" />
							Add Expense
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add New Expense</DialogTitle>
							<DialogDescription>
								Add an expense to split with group members
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							<div>
								<Label htmlFor="amount">Amount (₹)</Label>
								<Input
									id="amount"
									type="number"
									placeholder="0.00"
									value={expenseAmount}
									onChange={(e) => setExpenseAmount(e.target.value)}
								/>
							</div>
							<div>
								<Label htmlFor="description">Description</Label>
								<Input
									id="description"
									placeholder="What was this expense for?"
									value={expenseDescription}
									onChange={(e) => setExpenseDescription(e.target.value)}
								/>
							</div>
							<div>
								<Label htmlFor="category">Category</Label>
								<Select value={expenseCategory} onValueChange={setExpenseCategory}>
									<SelectTrigger>
										<SelectValue placeholder="Select category" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="food">Food & Dining</SelectItem>
										<SelectItem value="transport">Transportation</SelectItem>
										<SelectItem value="accommodation">Accommodation</SelectItem>
										<SelectItem value="entertainment">Entertainment</SelectItem>
										<SelectItem value="shopping">Shopping</SelectItem>
										<SelectItem value="utilities">Utilities</SelectItem>
										<SelectItem value="other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label htmlFor="wallet">Pay from</Label>
								<Select value={expenseWallet} onValueChange={(value: "cash" | "gpay") => setExpenseWallet(value)}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="cash">Cash</SelectItem>
										<SelectItem value="gpay">GPay</SelectItem>
									</SelectContent>
								</Select>
							</div>
							
							{/* Member Selection */}
							<div>
								<div className="flex items-center justify-between mb-3">
									<Label>Split with members</Label>
									<div className="flex gap-2">
										<Button 
											type="button" 
											variant="outline" 
											size="sm" 
											onClick={selectAllMembers}
										>
											Select All
										</Button>
										<Button 
											type="button" 
											variant="outline" 
											size="sm" 
											onClick={deselectAllMembers}
										>
											Deselect All
										</Button>
									</div>
								</div>
								<div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-3">
									{group?.memberIds.map((memberId: string) => (
										<div key={memberId} className="flex items-center space-x-2">
											<input
												type="checkbox"
												id={`member-${memberId}`}
												checked={selectedMembers.includes(memberId)}
												onChange={() => toggleMemberSelection(memberId)}
												className="rounded border-gray-300"
											/>
											<Label 
												htmlFor={`member-${memberId}`} 
												className="text-sm font-normal cursor-pointer"
											>
												{getUserName(memberId)}
											</Label>
										</div>
									))}
								</div>
								{selectedMembers.length === 0 && (
									<p className="text-sm text-red-600 mt-1">
										Please select at least one member
									</p>
								)}
							</div>
							
							<Button onClick={handleAddExpense} className="w-full">
								Add Expense
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			</div>

			{/* Group Info */}
			<Card className="mb-6">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Users className="w-5 h-5" />
						Group Information
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div>
							<p className="text-sm text-muted-foreground">Members</p>
							<p className="text-lg font-semibold">{group.memberIds.length}</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground">Total Expenses</p>
							<p className="text-lg font-semibold">{expenses.length}</p>
						</div>
						<div>
							<p className="text-sm text-muted-foreground">Total Amount</p>
							<p className="text-lg font-semibold">
								{formatCurrency(expenses.reduce((sum, expense) => sum + expense.amount, 0))}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Settlements */}
			{settlements.length > 0 && (
				<Card className="mb-6">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Calculator className="w-5 h-5" />
							Settlement Summary
						</CardTitle>
						<CardDescription>
							Who owes what to whom
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{settlements.map((settlement) => (
								<div key={settlement.id} className="p-3 bg-muted rounded-lg">
									<div className="flex items-center justify-between mb-2">
										<div className="flex items-center gap-2">
											<span className="font-medium">{getUserName(settlement.fromUserId)}</span>
											<span className="text-muted-foreground">owes</span>
											<span className="font-medium">{getUserName(settlement.toUserId)}</span>
										</div>
										<Badge variant="outline">
											{formatCurrency(settlement.amount)}
										</Badge>
									</div>
									<div className="flex justify-end">
										{settlement.status === "pending" && settlement.fromUserId === user?.uid && (
											<Button 
												size="sm" 
												variant="outline"
												onClick={() => handleMarkSettlement(settlement)}
											>
												Mark as Settled
											</Button>
										)}
										{settlement.status === "completed" && (
											<Badge variant="default" className="bg-green-600">
												Completed
											</Badge>
										)}
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Expenses List */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Receipt className="w-5 h-5" />
						Recent Expenses
					</CardTitle>
				</CardHeader>
				<CardContent>
					{expenses.length === 0 ? (
						<div className="text-center py-8">
							<Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
							<h3 className="text-lg font-semibold mb-2">No expenses yet</h3>
							<p className="text-muted-foreground mb-4">
								Start by adding the first expense to this group.
							</p>
							<Button onClick={() => setAddExpenseOpen(true)}>
								<Plus className="w-4 h-4 mr-2" />
								Add First Expense
							</Button>
						</div>
					) : (
						<div className="space-y-4">
							{expenses.map((expense) => (
								<div key={expense.id} className="border rounded-lg p-4">
									<div className="flex items-start justify-between mb-3">
										<div>
											<h4 className="font-semibold">{expense.description}</h4>
											<p className="text-sm text-muted-foreground">
												{formatDate(expense.date)} • {expense.category}
											</p>
										</div>
										<div className="text-right">
											<p className="font-semibold">{formatCurrency(expense.amount)}</p>
											<p className="text-sm text-muted-foreground">
												Paid by {getUserName(expense.paidBy)}
											</p>
										</div>
									</div>
									
									<Separator className="my-3" />
									
									<div>
										<p className="text-sm font-medium mb-2">Split Details:</p>
										<div className="space-y-1">
											{expense.splitDetails.map((split: any, index: number) => (
												<div key={index} className="flex items-center justify-between text-sm">
													<div className="flex items-center gap-2">
														<span>{getUserName(split.userId)}</span>
														{split.settled && (
															<CheckCircle className="w-4 h-4 text-green-600" />
														)}
													</div>
													<span className={split.settled ? "text-green-600" : ""}>
														{formatCurrency(split.amount)}
													</span>
												</div>
											))}
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Settlement Modal */}
			<Dialog open={settlementModalOpen} onOpenChange={(open) => {
				setSettlementModalOpen(open);
				if (!open) {
					resetSettlementForm();
				}
			}}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Mark Settlement as Complete</DialogTitle>
						<DialogDescription>
							Confirm that you have paid {selectedSettlement && getUserName(selectedSettlement.toUserId)} the amount of {selectedSettlement && formatCurrency(selectedSettlement.amount)}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label htmlFor="settlementWallet">Payment Method</Label>
							<Select value={settlementWallet} onValueChange={(value: "cash" | "gpay") => setSettlementWallet(value)}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="cash">Cash</SelectItem>
									<SelectItem value="gpay">GPay</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label htmlFor="settlementNotes">Notes (Optional)</Label>
							<Input
								id="settlementNotes"
								placeholder="Add any notes about this payment..."
								value={settlementNotes}
								onChange={(e) => setSettlementNotes(e.target.value)}
							/>
						</div>
						<Button onClick={handleSettlementComplete} className="w-full">
							Mark as Settled
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
