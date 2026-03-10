"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TeamInvite } from "@/queries/team";
import { Copy, Trash2 } from "lucide-react";

type InvitesTabProps = {
    pendingInvites: TeamInvite[];
    canManageInvites: boolean;
    isRevoking: boolean;
    feedback: string | null;
    onRevokeInvite: (inviteId: string) => void;
    onFeedback: (value: string | null) => void;
};

export function InvitesTab({
    pendingInvites,
    canManageInvites,
    isRevoking,
    feedback,
    onRevokeInvite,
    onFeedback,
}: InvitesTabProps) {
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Invitations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {pendingInvites.length === 0 ? <p className="text-sm text-muted-foreground">No invites yet.</p> : null}
                    {pendingInvites.map((invite) => (
                        <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                            <div className="space-y-1">
                                <div className="font-medium">{invite.invitedEmail}</div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">{invite.role}</Badge>
                                    <Badge variant="secondary">{invite.status}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Expires {new Date(invite.expiresAt).toLocaleString()}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={async () => {
                                        await navigator.clipboard.writeText(invite.inviteLink);
                                        onFeedback("Invite link copied.");
                                    }}
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy link
                                </Button>
                                {canManageInvites ? (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        onClick={() => onRevokeInvite(invite.id)}
                                        disabled={isRevoking}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Revoke
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
            {feedback ? <p className="text-sm text-muted-foreground">{feedback}</p> : null}
        </div>
    );
}
