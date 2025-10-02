"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { listTransactions, listBudgets, ensureBudgetsForMonth } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from "recharts";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingUp, TrendingDown, DollarSign, Target, Calendar, Handshake, BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
	const { user } = useAuth();
	const [selectedMonth, setSelectedMonth] = useState<string>("");
	
	const { data: transactions } = useQuery({
		queryKey: ["analytics-transactions", user?.uid],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return [] as any[];
			return await listTransactions(user.uid);
		},
	});

	const { data: budgets } = useQuery({
		queryKey: ["analytics-budgets", user?.uid, selectedMonth],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return [] as any[];
			const month = selectedMonth || new Date().toISOString().slice(0, 7);
			return await ensureBudgetsForMonth(user.uid, month);
		},
	});

	// Process transactions to get comprehensive monthly data
	const monthlyData = useMemo(() => {
		if (!transactions) return [];
		
		const monthlyTotals: Record<string, any> = {};
		
		transactions.forEach((tx: any) => {
			const date = new Date(tx.date);
			const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
			
			if (!monthlyTotals[monthKey]) {
				monthlyTotals[monthKey] = {
					month: monthName,
					monthKey,
					total: 0,
					expenses: 0,
					income: 0,
					transfers: 0,
					settlements: 0,
					categories: {},
					wallets: { cash: 0, gpay: 0, investment: 0 },
					transactionCount: 0
				};
			}
			
			monthlyTotals[monthKey].transactionCount++;
			
			if (tx.type === 'expense') {
				monthlyTotals[monthKey].expenses += tx.amount;
				monthlyTotals[monthKey].total -= tx.amount;
				monthlyTotals[monthKey].wallets[tx.wallet] -= tx.amount;
			} else if (tx.type === 'income') {
				monthlyTotals[monthKey].income += tx.amount;
				monthlyTotals[monthKey].total += tx.amount;
				monthlyTotals[monthKey].wallets[tx.wallet] += tx.amount;
			} else if (tx.type === 'transfer') {
				monthlyTotals[monthKey].transfers += tx.amount;
			}
			
			if (tx.isSettlement) {
				monthlyTotals[monthKey].settlements += tx.amount;
			}
			
			// Category breakdown
			if (!monthlyTotals[monthKey].categories[tx.category]) {
				monthlyTotals[monthKey].categories[tx.category] = 0;
			}
			monthlyTotals[monthKey].categories[tx.category] += tx.amount;
		});
		
		// Convert to array and sort by month
		return Object.values(monthlyTotals)
			.sort((a, b) => a.monthKey.localeCompare(b.monthKey))
			.slice(-12); // Show last 12 months
	}, [transactions]);

	// Get available months for selector
	const availableMonths = useMemo(() => {
		return monthlyData.map(m => ({ value: m.monthKey, label: m.month }));
	}, [monthlyData]);

	// Get selected month data
	const selectedMonthData = useMemo(() => {
		if (!selectedMonth) return monthlyData[monthlyData.length - 1]; // Latest month
		return monthlyData.find(m => m.monthKey === selectedMonth);
	}, [selectedMonth, monthlyData]);

	// Process budget data for selected month
	const budgetData = useMemo(() => {
		if (!budgets || !selectedMonthData) return [];
		
		return budgets.map((budget: any) => {
			const spent = selectedMonthData.categories[budget.category] || 0;
			const percentage = budget.limit ? Math.min(100, (spent / budget.limit) * 100) : 0;
			const isOverLimit = spent > budget.limit;
			
			return {
				...budget,
				spent,
				percentage,
				isOverLimit,
				remaining: budget.limit - spent
			};
		});
	}, [budgets, selectedMonthData]);

	// Category pie chart data
	const categoryData = useMemo(() => {
		if (!selectedMonthData) return [];
		
		const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff', '#00ffff', '#ffff00'];
		
		return Object.entries(selectedMonthData.categories)
			.map(([category, amount]: [string, any]) => ({
				name: category,
				value: amount,
				color: colors[Object.keys(selectedMonthData.categories).indexOf(category) % colors.length]
			}))
			.sort((a, b) => b.value - a.value);
	}, [selectedMonthData]);

	return (
		<div className="container mx-auto max-w-7xl py-6 space-y-6 pb-24">
			{/* Header with Month Selector */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
			>
				<Card className="rounded-xl shadow-sm">
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="text-2xl flex items-center gap-2">
									<BarChart3 className="h-6 w-6" />
									Comprehensive Analytics
								</CardTitle>
								<p className="text-muted-foreground">Detailed monthly breakdown with budgets and spending patterns</p>
							</div>
							<div className="flex items-center gap-2">
								<Calendar className="h-4 w-4 text-muted-foreground" />
								<Select value={selectedMonth} onValueChange={setSelectedMonth}>
									<SelectTrigger className="w-40">
										<SelectValue placeholder="Select month" />
									</SelectTrigger>
									<SelectContent>
										{availableMonths.map((month) => (
											<SelectItem key={month.value} value={month.value}>
												{month.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					</CardHeader>
				</Card>
			</motion.div>

			{/* Monthly Overview Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.1 }}
				>
					<Card className="rounded-xl shadow-sm">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
								<TrendingDown className="h-4 w-4" />
								Total Expenses
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-red-600">
								₹{selectedMonthData?.expenses || 0}
							</div>
							<div className="text-xs text-muted-foreground">
								{selectedMonthData?.transactionCount || 0} transactions
							</div>
						</CardContent>
					</Card>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.2 }}
				>
					<Card className="rounded-xl shadow-sm">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
								<TrendingUp className="h-4 w-4" />
								Total Income
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-green-600">
								₹{selectedMonthData?.income || 0}
							</div>
							<div className="text-xs text-muted-foreground">
								Net: ₹{selectedMonthData?.total || 0}
							</div>
						</CardContent>
					</Card>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.3 }}
				>
					<Card className="rounded-xl shadow-sm">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
								<DollarSign className="h-4 w-4" />
								Transfers
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-blue-600">
								₹{selectedMonthData?.transfers || 0}
							</div>
							<div className="text-xs text-muted-foreground">
								Between wallets
							</div>
						</CardContent>
					</Card>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.4 }}
				>
					<Card className="rounded-xl shadow-sm">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
								<Handshake className="h-4 w-4" />
								Settlements
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-purple-600">
								₹{selectedMonthData?.settlements || 0}
							</div>
							<div className="text-xs text-muted-foreground">
								Paid for others
							</div>
						</CardContent>
					</Card>
				</motion.div>
			</div>

			{/* Charts Row */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Monthly Trend Chart */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.5 }}
				>
					<Card className="rounded-xl shadow-sm">
						<CardHeader>
							<CardTitle>12-Month Trend</CardTitle>
						</CardHeader>
						<CardContent>
							<div style={{ height: 300 }}>
								<ResponsiveContainer width="100%" height="100%">
									<AreaChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="month" tick={{ fontSize: 12 }} />
										<YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `₹${value}`} />
										<Tooltip 
											formatter={(value: any, name: string) => [
												`₹${Math.abs(value)}`, 
												name === 'expenses' ? 'Expenses' : 'Income'
											]}
										/>
										<Area type="monotone" dataKey="expenses" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
										<Area type="monotone" dataKey="income" stackId="2" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
									</AreaChart>
								</ResponsiveContainer>
							</div>
						</CardContent>
					</Card>
				</motion.div>

				{/* Category Breakdown */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.6 }}
				>
					<Card className="rounded-xl shadow-sm">
						<CardHeader>
							<CardTitle>Category Breakdown - {selectedMonthData?.month}</CardTitle>
						</CardHeader>
						<CardContent>
							<div style={{ height: 300 }}>
								<ResponsiveContainer width="100%" height="100%">
									<PieChart>
										<Pie
											data={categoryData}
											cx="50%"
											cy="50%"
											outerRadius={80}
											dataKey="value"
											label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
										>
											{categoryData.map((entry, index) => (
												<Cell key={`cell-${index}`} fill={entry.color} />
											))}
										</Pie>
										<Tooltip formatter={(value: any) => [`₹${value}`, 'Amount']} />
									</PieChart>
								</ResponsiveContainer>
							</div>
						</CardContent>
					</Card>
				</motion.div>
			</div>

			{/* Budget Analysis */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.7 }}
			>
				<Card className="rounded-xl shadow-sm">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Target className="h-5 w-5" />
							Budget Analysis - {selectedMonthData?.month}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{budgetData.map((budget: any) => (
								<div key={budget.id} className={`p-4 rounded-lg border ${budget.isOverLimit ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
									<div className="flex items-center justify-between mb-2">
										<div className="flex items-center gap-2">
											<span className="font-medium">{budget.category}</span>
											{budget.isOverLimit && <AlertTriangle className="h-4 w-4 text-red-600" />}
										</div>
										<div className="flex items-center gap-4 text-sm">
											<span className={budget.isOverLimit ? "text-red-600 font-medium" : ""}>
												₹{budget.spent} / ₹{budget.limit}
											</span>
											<Badge variant={budget.isOverLimit ? "destructive" : "secondary"}>
												{budget.percentage.toFixed(0)}%
											</Badge>
										</div>
									</div>
									<Progress value={budget.percentage} className={budget.isOverLimit ? "[&>div]:bg-red-500" : ""} />
									{budget.isOverLimit && (
										<div className="text-xs text-red-600 mt-1">
											Over budget by ₹{Math.abs(budget.remaining)}
										</div>
									)}
								</div>
							))}
							{budgetData.length === 0 && (
								<div className="text-center py-8 text-muted-foreground">
									No budgets set for this month
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</motion.div>

			{/* Wallet Breakdown */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.8 }}
			>
				<Card className="rounded-xl shadow-sm">
					<CardHeader>
						<CardTitle>Wallet Activity - {selectedMonthData?.month}</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div className="text-center p-4 border rounded-lg">
								<div className="text-2xl mb-2">💵</div>
								<div className="font-medium">Cash</div>
								<div className={`text-lg font-bold ${selectedMonthData?.wallets.cash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
									₹{selectedMonthData?.wallets.cash || 0}
								</div>
							</div>
							<div className="text-center p-4 border rounded-lg">
								<div className="text-2xl mb-2">📲</div>
								<div className="font-medium">GPay</div>
								<div className={`text-lg font-bold ${selectedMonthData?.wallets.gpay >= 0 ? 'text-green-600' : 'text-red-600'}`}>
									₹{selectedMonthData?.wallets.gpay || 0}
								</div>
							</div>
							<div className="text-center p-4 border rounded-lg">
								<div className="text-2xl mb-2">📈</div>
								<div className="font-medium">Investment</div>
								<div className={`text-lg font-bold ${selectedMonthData?.wallets.investment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
									₹{selectedMonthData?.wallets.investment || 0}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</motion.div>

			{/* Monthly Comparison Table */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.9 }}
			>
				<Card className="rounded-xl shadow-sm">
					<CardHeader>
						<CardTitle>Monthly Comparison</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b">
										<th className="text-left py-2">Month</th>
										<th className="text-right py-2">Expenses</th>
										<th className="text-right py-2">Income</th>
										<th className="text-right py-2">Net</th>
										<th className="text-right py-2">Transactions</th>
										<th className="text-right py-2">Transfers</th>
										<th className="text-right py-2">Settlements</th>
									</tr>
								</thead>
								<tbody>
									{monthlyData.slice().reverse().map((month: any) => (
										<tr key={month.monthKey} className="border-b hover:bg-gray-50">
											<td className="py-2 font-medium">{month.month}</td>
											<td className="py-2 text-right text-red-600">₹{month.expenses}</td>
											<td className="py-2 text-right text-green-600">₹{month.income}</td>
											<td className={`py-2 text-right font-medium ${month.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
												₹{Math.abs(month.total)}
											</td>
											<td className="py-2 text-right">{month.transactionCount}</td>
											<td className="py-2 text-right text-blue-600">₹{month.transfers}</td>
											<td className="py-2 text-right text-purple-600">₹{month.settlements}</td>
										</tr>
									))}
								</tbody>
							</table>
							{monthlyData.length === 0 && (
								<div className="text-center py-8 text-muted-foreground">
									No transaction data available yet. Start adding transactions to see your analytics!
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</motion.div>
		</div>
	);
}
