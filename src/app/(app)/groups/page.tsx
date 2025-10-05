"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { 
	createExpenseGroup, 
	getUserExpenseGroups, 
	joinExpenseGroup
} from "@/lib/db";
import type { ExpenseGroup } from "@/types/db";
import { getUserDisplayName } from "@/lib/user-utils";

export default function GroupsPage() {
	const { user } = useAuth();
	const [groups, setGroups] = useState<ExpenseGroup[]>([]);
	const [loading, setLoading] = useState(true);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [joinDialogOpen, setJoinDialogOpen] = useState(false);
	const [joinCode, setJoinCode] = useState("");

	// Create group form state
	const [groupName, setGroupName] = useState("");
	const [groupDescription, setGroupDescription] = useState("");

	useEffect(() => {
		if (user) {
			loadGroups();
		}
	}, [user]);

	const loadGroups = async () => {
		if (!user) return;
		try {
			setLoading(true);
			const userGroups = await getUserExpenseGroups(user.uid);
			setGroups(userGroups);
		} catch (error) {
			console.error("Error loading groups:", error);
			toast.error("Failed to load groups");
		} finally {
			setLoading(false);
		}
	};

	const handleCreateGroup = async () => {
		if (!user || !groupName.trim()) return;
		
		try {
			await createExpenseGroup(user.uid, groupName.trim(), groupDescription.trim() || undefined);
			toast.success("Group created successfully!");
			setCreateDialogOpen(false);
			setGroupName("");
			setGroupDescription("");
			await loadGroups();
		} catch (error) {
			console.error("Error creating group:", error);
			toast.error("Failed to create group");
		}
	};

	const handleJoinGroup = async () => {
		if (!user || !joinCode.trim()) return;
		
		try {
			const userDisplayName = getUserDisplayName(user);
			const groupId = await joinExpenseGroup(user.uid, joinCode.trim().toUpperCase(), userDisplayName);
			if (groupId) {
				toast.success("Successfully joined the group!");
				setJoinDialogOpen(false);
				setJoinCode("");
				await loadGroups();
			} else {
				toast.error("Invalid invitation code");
			}
		} catch (error) {
			console.error("Error joining group:", error);
			toast.error("Failed to join group");
		}
	};

	const copyInvitationCode = (code: string) => {
		navigator.clipboard.writeText(code);
		toast.success("Invitation code copied to clipboard!");
	};

	const copyInvitationLink = (code: string) => {
		const link = `${window.location.origin}/groups/join?code=${code}`;
		navigator.clipboard.writeText(link);
		toast.success("Invitation link copied to clipboard!");
	};


	if (loading) {
		return (
			<div className="container mx-auto max-w-4xl p-6">
				<div className="flex items-center justify-center h-64">
					<div className="text-muted-foreground">Loading groups...</div>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-4xl p-6">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-3xl font-bold">Expense Groups</h1>
					<p className="text-muted-foreground">Create and manage shared expense groups with friends</p>
				</div>
				<div className="flex gap-2">
					<Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
						<DialogTrigger asChild>
							<Button variant="outline">
								<Users className="w-4 h-4 mr-2" />
								Join Group
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Join a Group</DialogTitle>
								<DialogDescription>
									Enter the invitation code to join an expense group
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4">
								<div>
									<Label htmlFor="joinCode">Invitation Code</Label>
									<Input
										id="joinCode"
										placeholder="Enter 6-character code"
										value={joinCode}
										onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
										maxLength={6}
									/>
								</div>
								<Button onClick={handleJoinGroup} className="w-full">
									Join Group
								</Button>
							</div>
						</DialogContent>
					</Dialog>

					<Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
						<DialogTrigger asChild>
							<Button>
								<Plus className="w-4 h-4 mr-2" />
								Create Group
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create New Group</DialogTitle>
								<DialogDescription>
									Create a new expense group to share expenses with friends
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4">
								<div>
									<Label htmlFor="groupName">Group Name</Label>
									<Input
										id="groupName"
										placeholder="e.g., Trip to Goa"
										value={groupName}
										onChange={(e) => setGroupName(e.target.value)}
									/>
								</div>
								<div>
									<Label htmlFor="groupDescription">Description (Optional)</Label>
									<Textarea
										id="groupDescription"
										placeholder="Describe what this group is for..."
										value={groupDescription}
										onChange={(e) => setGroupDescription(e.target.value)}
									/>
								</div>
								<Button onClick={handleCreateGroup} className="w-full">
									Create Group
								</Button>
							</div>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			{groups.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Users className="w-12 h-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-2">No groups yet</h3>
						<p className="text-muted-foreground text-center mb-4">
							Create your first expense group or join an existing one to start sharing expenses with friends.
						</p>
						<div className="flex gap-2">
							<Button onClick={() => setCreateDialogOpen(true)}>
								<Plus className="w-4 h-4 mr-2" />
								Create Group
							</Button>
							<Button variant="outline" onClick={() => setJoinDialogOpen(true)}>
								<Users className="w-4 h-4 mr-2" />
								Join Group
							</Button>
						</div>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{groups.map((group) => (
						<Card key={group.id} className="hover:shadow-md transition-shadow">
							<CardHeader>
								<div className="flex items-start justify-between">
									<div>
										<CardTitle className="text-lg">{group.name}</CardTitle>
										{group.description && (
											<CardDescription className="mt-1">
												{group.description}
											</CardDescription>
										)}
									</div>
									{group.ownerId === user?.uid && (
										<Badge variant="secondary">Owner</Badge>
									)}
								</div>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">Members:</span>
										<span>{group.memberIds.length}</span>
									</div>
									
									<div className="space-y-2">
										<div className="flex items-center justify-between text-sm">
											<span className="text-muted-foreground">Invitation Code:</span>
											<div className="flex items-center gap-1">
												<code className="bg-muted px-2 py-1 rounded text-xs font-mono">
													{group.invitationCode}
												</code>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => copyInvitationCode(group.invitationCode)}
													className="h-6 w-6 p-0"
												>
													<Copy className="w-3 h-3" />
												</Button>
											</div>
										</div>
										
										<Button
											variant="outline"
											size="sm"
											onClick={() => copyInvitationLink(group.invitationCode)}
											className="w-full"
										>
											<ExternalLink className="w-3 h-3 mr-2" />
											Copy Invite Link
										</Button>
									</div>
									
									<Button className="w-full" asChild>
										<a href={`/groups/${group.id}`}>
											View Group
										</a>
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

		</div>
	);
}
