export type WalletType = "cash" | "gpay" | "investment";
export type TransactionType = "expense" | "income" | "transfer";

export interface Wallet {
	id: string;
	userId: string;
	type: WalletType;
	name: string;
	balance: number;
	createdAt: number;
	updatedAt: number;
}

export interface Transaction {
	id: string;
	userId: string;
	date: number; // epoch ms
	amount: number; // positive, we derive sign from type
	category: string;
	wallet: WalletType; // primary wallet impacted
	type: TransactionType; // expense/income/transfer
	notes?: string;
	isSettlement?: boolean; // paid for someone else
	settled?: boolean; // marked settled later
	fromWallet?: WalletType; // when type === "transfer"
	toWallet?: WalletType; // when type === "transfer"
	createdAt: number;
	updatedAt: number;
}

export interface Budget {
	id: string;
	userId: string;
	month: string; // YYYY-MM
	category: string;
	limit: number;
	spent: number;
	createdAt: number;
	updatedAt: number;
}

export interface Preset {
	id: string;
	userId: string;
	emoji: string;
	label: string;
	amount: number;
	category: string;
	wallet: WalletType;
	createdAt: number;
	updatedAt: number;
}

export interface Income {
	id: string;
	userId: string;
	month: string; // YYYY-MM
	amount: number;
	createdAt: number;
	updatedAt: number;
}

export interface InvestmentLock {
	id: string;
	userId: string;
	amount: number;
	createdAt: number;
	updatedAt: number;
}

export const collections = {
	wallets: "wallets",
	transactions: "transactions",
	budgets: "budgets",
	presets: "presets",
	incomes: "incomes",
	investmentLocks: "investmentLocks",
} as const;

