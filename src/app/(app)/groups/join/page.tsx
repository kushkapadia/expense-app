"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { joinExpenseGroup, getExpenseGroup } from "@/lib/db";
import { getUserDisplayName } from "@/lib/user-utils";

export default function JoinGroupPage() {
	const { user } = useAuth();
	const searchParams = useSearchParams();
	const router = useRouter();
	const [joinCode, setJoinCode] = useState("");
	const [loading, setLoading] = useState(false);
	const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
	const [groupName, setGroupName] = useState("");

	useEffect(() => {
		// Check if there's a code in the URL
		const codeFromUrl = searchParams.get("code");
		if (codeFromUrl) {
			setJoinCode(codeFromUrl.toUpperCase());
		}
	}, [searchParams]);

	const handleJoinGroup = async () => {
		if (!user || !joinCode.trim()) return;
		
		setLoading(true);
		setStatus("idle");
		
		try {
			// First, try to get group info to show the name
			const groups = await getExpenseGroup(joinCode.trim().toUpperCase());
			if (groups) {
				setGroupName(groups.name);
			}
			
			const userDisplayName = getUserDisplayName(user);
			const groupId = await joinExpenseGroup(user.uid, joinCode.trim().toUpperCase(), userDisplayName);
			if (groupId) {
				setStatus("success");
				toast.success("Successfully joined the group!");
				// Redirect to the group page after a short delay
				setTimeout(() => {
					router.push(`/groups/${groupId}`);
				}, 2000);
			} else {
				setStatus("error");
				toast.error("Invalid invitation code");
			}
		} catch (error) {
			console.error("Error joining group:", error);
			setStatus("error");
			toast.error("Failed to join group");
		} finally {
			setLoading(false);
		}
	};

	if (!user) {
		return (
			<div className="container mx-auto max-w-md p-6">
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Users className="w-12 h-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-2">Please sign in</h3>
						<p className="text-muted-foreground text-center mb-4">
							You need to be signed in to join an expense group.
						</p>
						<Button asChild>
							<a href="/login">Sign In</a>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-md p-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Users className="w-5 h-5" />
						Join Expense Group
					</CardTitle>
					<CardDescription>
						Enter the invitation code to join an expense group
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{status === "success" && (
						<div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
							<CheckCircle className="w-5 h-5 text-green-600" />
							<div>
								<p className="font-medium text-green-800 dark:text-green-200">
									Successfully joined!
								</p>
								{groupName && (
									<p className="text-sm text-green-600 dark:text-green-300">
										Welcome to "{groupName}"
									</p>
								)}
								<p className="text-sm text-green-600 dark:text-green-300">
									Redirecting to group page...
								</p>
							</div>
						</div>
					)}

					{status === "error" && (
						<div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
							<XCircle className="w-5 h-5 text-red-600" />
							<div>
								<p className="font-medium text-red-800 dark:text-red-200">
									Failed to join group
								</p>
								<p className="text-sm text-red-600 dark:text-red-300">
									Please check the invitation code and try again.
								</p>
							</div>
						</div>
					)}

					<div>
						<Label htmlFor="joinCode">Invitation Code</Label>
						<Input
							id="joinCode"
							placeholder="Enter 6-character code"
							value={joinCode}
							onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
							maxLength={6}
							disabled={loading || status === "success"}
						/>
					</div>

					<Button 
						onClick={handleJoinGroup} 
						className="w-full"
						disabled={loading || !joinCode.trim() || status === "success"}
					>
						{loading ? (
							<>
								<Loader2 className="w-4 h-4 mr-2 animate-spin" />
								Joining...
							</>
						) : (
							"Join Group"
						)}
					</Button>

					<div className="text-center">
						<Button variant="link" asChild>
							<a href="/groups">Back to Groups</a>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
