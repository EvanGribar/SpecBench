export type Role = "admin" | "member";
export type Plan = { name: "Starter" | "Growth"; seatLimit: number };
export type Member = { id: string; name: string; role: Role };
export type Notification = { id: string; message: string; status: "pending" | "sent" | "cancelled"; attempts: number };
const team = { id: "t-acme", name: "Acme Team" }; const plan: Plan = { name: "Starter", seatLimit: 3 };
const members: Member[] = [{ id: "u-admin", name: "Ada Admin", role: "admin" }, { id: "u-member", name: "Mina Member", role: "member" }];
const notifications: Notification[] = [{ id: "n-welcome", message: "Welcome to Acme Team", status: "sent", attempts: 1 }];
export function dashboardFor(_userId: string) { return { team, plan, memberCount: members.length, members, notifications }; }
export function canInvite(userId: string) { return members.find((member) => member.id === userId)?.role === "admin"; }
export function inviteMember(userId: string, name: string) { if (!canInvite(userId)) throw new Error("Only team administrators may invite members"); if (members.length >= plan.seatLimit) throw new Error("This plan has reached its seat limit"); const member = { id: `u-${members.length + 1}`, name, role: "member" as const }; members.push(member); return member; }
export function cancelNotification(notificationId: string) { const notification = notifications.find((item) => item.id === notificationId); if (!notification) throw new Error("Notification not found"); if (notification.status === "sent") throw new Error("Sent notifications cannot be cancelled"); notification.status = "cancelled"; return notification; }
export function retryNotification(notificationId: string) { const notification = notifications.find((item) => item.id === notificationId); if (!notification) throw new Error("Notification not found"); if (notification.status !== "pending") throw new Error("Only pending notifications may be retried"); notification.attempts += 1; return notification; }
