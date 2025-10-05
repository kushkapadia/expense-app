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
	item?: string;
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

export interface WalletHistory {
	id: string;
	userId: string;
	wallet: WalletType;
	amount: number;
	reason: string;
	createdAt: number;
	updatedAt: number;
}

// Group Expense Sharing Types
export interface ExpenseGroup {
	id: string;
	name: string;
	description?: string;
	ownerId: string; // User who created the group
	memberIds: string[]; // Array of user IDs who are members
	invitationCode: string; // Unique code for joining
	createdAt: number;
	updatedAt: number;
}

export interface GroupInvitation {
	id: string;
	groupId: string;
	invitedBy: string; // User ID who sent the invitation
	invitedEmail?: string; // Email of person being invited (optional)
	invitationCode: string; // Same as group's invitation code
	status: "pending" | "accepted" | "declined" | "expired";
	expiresAt: number;
	createdAt: number;
	updatedAt: number;
}

export interface GroupExpense {
	id: string;
	groupId: string;
	paidBy: string; // User ID who paid
	amount: number;
	description: string;
	category: string;
	splitType: "equal" | "custom"; // How the expense is split
	splitDetails: GroupExpenseSplit[]; // Who owes what
	date: number; // epoch ms
	createdAt: number;
	updatedAt: number;
}

export interface GroupExpenseSplit {
	userId: string;
	amount: number; // How much this user owes
	settled: boolean; // Whether this user has paid their share
	settledAt?: number; // When they settled
	settledBy?: string; // Who marked it as settled
}

export interface GroupSettlement {
	id: string;
	groupId: string;
	fromUserId: string; // Who owes money
	toUserId: string; // Who should receive money
	amount: number;
	status: "pending" | "completed";
	expenseId?: string; // Optional: which expense this settlement is for
	completedAt?: number;
	createdAt: number;
	updatedAt: number;
}

export interface UserName {
	id: string;
	userId: string;
	displayName: string;
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
	expenseGroups: "expenseGroups",
	groupInvitations: "groupInvitations",
	groupExpenses: "groupExpenses",
	groupSettlements: "groupSettlements",
	userNames: "userNames",
} as const;

