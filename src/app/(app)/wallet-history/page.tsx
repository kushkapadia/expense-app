"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { listWalletHistory } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { motion } from "framer-motion";
import { Wallet, History, TrendingUp } from "lucide-react";

export default function WalletHistoryPage() {
	const { user } = useAuth();
	const [selectedWallet, setSelectedWallet] = useState<string>("all");
	
	const { data: history } = useQuery({
		queryKey: ["wallet-history", user?.uid, selectedWallet],
		enabled: !!user,
		queryFn: async () => {
			if (!user) return [] as any[];
			return await listWalletHistory(user.uid, selectedWallet === "all" ? undefined : selectedWallet as any);
		},
	});

	const filteredHistory = history || [];

	return (
		<div className="container mx-auto max-w-4xl py-6 space-y-6 pb-24">
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
									<History className="h-6 w-6" />
									Wallet History
								</CardTitle>
								<p className="text-muted-foreground">Track when and how much was added to your wallets</p>
							</div>
							<div className="flex items-center gap-2">
								<Wallet className="h-4 w-4 text-muted-foreground" />
								<Select value={selectedWallet} onValueChange={setSelectedWallet}>
									<SelectTrigger className="w-40">
										<SelectValue placeholder="Select wallet" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Wallets</SelectItem>
										<SelectItem value="cash">💵 Cash</SelectItem>
										<SelectItem value="gpay">📲 GPay</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</CardHeader>
				</Card>
			</motion.div>

			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.1 }}
				>
					<Card className="rounded-xl shadow-sm">
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
								<TrendingUp className="h-4 w-4" />
								Total Additions
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-green-600">
								₹{filteredHistory.reduce((sum, h: any) => sum + h.amount, 0)}
							</div>
							<div className="text-xs text-muted-foreground">
								{filteredHistory.length} entries
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
							<CardTitle className="text-sm font-medium text-muted-foreground">
								💵 Cash Additions
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-blue-600">
								₹{filteredHistory.filter((h: any) => h.wallet === "cash").reduce((sum, h: any) => sum + h.amount, 0)}
							</div>
							<div className="text-xs text-muted-foreground">
								{filteredHistory.filter((h: any) => h.wallet === "cash").length} entries
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
							<CardTitle className="text-sm font-medium text-muted-foreground">
								📲 GPay Additions
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-purple-600">
								₹{filteredHistory.filter((h: any) => h.wallet === "gpay").reduce((sum, h: any) => sum + h.amount, 0)}
							</div>
							<div className="text-xs text-muted-foreground">
								{filteredHistory.filter((h: any) => h.wallet === "gpay").length} entries
							</div>
						</CardContent>
					</Card>
				</motion.div>
			</div>

			{/* History List */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.4 }}
			>
				<Card className="rounded-xl shadow-sm">
					<CardHeader>
						<CardTitle>Wallet Addition History</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{filteredHistory.map((entry: any) => (
								<div key={entry.id} className="flex items-center justify-between text-sm py-3 border-b last:border-b-0">
									<div className="flex items-center gap-3">
										<div className="text-2xl">
											{entry.wallet === "cash" ? "💵" : "📲"}
										</div>
										<div>
											<div className="font-medium">
												{entry.wallet === "cash" ? "Cash" : "GPay"} Wallet
											</div>
											<div className="text-muted-foreground text-xs">
												{entry.reason}
											</div>
										</div>
									</div>
									<div className="text-right">
										<div className="font-bold text-green-600">
											+₹{entry.amount}
										</div>
										<div className="text-muted-foreground text-xs">
											{new Date(entry.createdAt).toLocaleDateString()} at {new Date(entry.createdAt).toLocaleTimeString()}
										</div>
									</div>
								</div>
							))}
							{filteredHistory.length === 0 && (
								<div className="text-center py-8 text-muted-foreground">
									No wallet additions yet. Add money to your wallets from the Dashboard to see history here.
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</motion.div>
		</div>
	);
}
