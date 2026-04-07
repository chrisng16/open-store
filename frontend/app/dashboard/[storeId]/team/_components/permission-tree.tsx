"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

export type PermissionTreeNode = {
    key: string;
    label: string;
    children: { key: string; label: string }[];
};

export const ROLE_PERMISSION_TREE: PermissionTreeNode[] = [
    {
        key: "dashboard",
        label: "Dashboard",
        children: [
            { key: "dashboard.access", label: "Access dashboard" },
        ],
    },
    {
        key: "team",
        label: "Team",
        children: [
            { key: "team.members.read", label: "View members" },
            { key: "team.members.write", label: "Edit member roles" },
            { key: "team.roles.read", label: "View role catalog" },
            { key: "team.roles.write", label: "Edit roles" },
            { key: "team.invites.read", label: "View invites" },
            { key: "team.invites.write", label: "Send and revoke invites" },
        ],
    },
    {
        key: "catalog",
        label: "Catalog",
        children: [
            { key: "products.read", label: "View products" },
            { key: "products.write", label: "Create and edit products" },
            { key: "products.pricing.write", label: "Update product prices" },
            { key: "categories.write", label: "Manage categories" },
        ],
    },
    {
        key: "orders",
        label: "Orders",
        children: [
            { key: "orders.read", label: "View orders" },
            { key: "orders.write", label: "Update order status" },
            { key: "orders.refund", label: "Issue refunds" },
        ],
    },
];

type PermissionTreeProps = {
    selected: string[];
    onChange: (next: string[]) => void;
};

export function PermissionTree({ selected, onChange }: PermissionTreeProps) {
    const selectedSet = useMemo(() => new Set(selected), [selected]);
    const [openKeys, setOpenKeys] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(ROLE_PERMISSION_TREE.map((group) => [group.key, false]))
    );

    const toggleLeaf = (permissionKey: string, checked: boolean) => {
        const next = new Set(selectedSet);
        if (checked) {
            next.add(permissionKey);
        } else {
            next.delete(permissionKey);
        }
        onChange(Array.from(next).sort());
    };

    const toggleGroup = (group: PermissionTreeNode, checked: boolean) => {
        const next = new Set(selectedSet);
        for (const child of group.children) {
            if (checked) {
                next.add(child.key);
            } else {
                next.delete(child.key);
            }
        }
        onChange(Array.from(next).sort());
    };

    return (
        <div className="space-y-2">
            {ROLE_PERMISSION_TREE.map((group) => {
                const selectedChildren = group.children.filter((child) => selectedSet.has(child.key)).length;
                const allSelected = selectedChildren === group.children.length;
                const partiallySelected = selectedChildren > 0 && !allSelected;
                const isOpen = openKeys[group.key] ?? false;

                return (
                    <Collapsible
                        key={group.key}
                        open={isOpen}
                        onOpenChange={(open) => setOpenKeys((prev) => ({ ...prev, [group.key]: open }))}
                        className="rounded-md border"
                    >
                        <div className="flex items-center justify-between px-3 py-2">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={allSelected ? true : partiallySelected ? "indeterminate" : false}
                                    onCheckedChange={(value) => toggleGroup(group, value === true)}
                                />
                                <span className="text-sm font-medium">{group.label}</span>
                                <span className="text-xs text-muted-foreground">
                                    {selectedChildren}/{group.children.length}
                                </span>
                            </div>
                            <CollapsibleTrigger className="rounded p-1 hover:bg-muted" aria-label={`Toggle ${group.label}`}>
                                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                            <div className="space-y-2 border-t px-3 py-2">
                                {group.children.map((child) => (
                                    <label key={child.key} className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={selectedSet.has(child.key)}
                                            onCheckedChange={(value) => toggleLeaf(child.key, value === true)}
                                        />
                                        <span>{child.label}</span>
                                        <code className="text-xs text-muted-foreground">{child.key}</code>
                                    </label>
                                ))}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                );
            })}
        </div>
    );
}
