import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Users,
  Database,
  ScrollText,
  Flag,
  PlusCircle,
  XCircle,
} from "lucide-react";
import { ModeratorGuard } from "@/components/ModeratorGuard";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { addCompany } from "@/modules/companies/functions";
import {
  listModerationQueue,
  moderateReviewDecision,
  listOpenDisputes,
  resolveDispute,
} from "@/modules/reviews/functions";
import {
  listAuditLog,
  listIngestionJobs,
  listCompanyReviewCountsBySource,
  listUsers,
  setUserRole,
} from "@/modules/admin/functions";
import type { AppRole } from "@/modules/auth/roles";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Internal" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <ModeratorGuard redirectPath="/admin/dashboard">
      <AdminDashboard />
    </ModeratorGuard>
  ),
});

function AdminDashboard() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [tab, setTab] = useState("moderation");

  return (
    <div className="min-h-screen bg-secondary/30 py-10">
      <Toaster position="top-center" />
      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Admin Dashboard
            </h1>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Administrator" : "Moderator"} access
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="moderation">Moderation</TabsTrigger>
            <TabsTrigger value="disputes">Disputes</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="companies">Add Company</TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="review-counts">Review Sources</TabsTrigger>
            )}
            {isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
            {isAdmin && <TabsTrigger value="ingestion">Ingestion</TabsTrigger>}
            {isAdmin && <TabsTrigger value="audit-log">Audit Log</TabsTrigger>}
          </TabsList>

          <TabsContent value="moderation">
            <ModerationQueueTab />
          </TabsContent>
          <TabsContent value="disputes">
            <DisputesTab />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="companies">
              <AddCompanyTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="review-counts">
              <ReviewCountsTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="users">
              <UsersTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="ingestion">
              <IngestionTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="audit-log">
              <AuditLogTab />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function ModerationQueueTab() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listModerationQueue);
  const decideFn = useServerFn(moderateReviewDecision);
  const { data, isLoading } = useQuery({
    queryKey: ["moderation-queue"],
    queryFn: () => listFn(),
  });

  const mutation = useMutation({
    mutationFn: (input: { reviewId: string; decision: "approve" | "reject" }) =>
      decideFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation-queue"] });
      toast.success("Decision recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel
      title="Moderation queue"
      description="Reviews awaiting approval before they go public."
    >
      {isLoading && (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      )}
      {!isLoading && (data?.reviews.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing pending — queue is clear.
        </p>
      )}
      <div className="space-y-4">
        {data?.reviews.map((r) => (
          <div key={r.id} className="rounded-xl border border-border p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">
                  {r.companyName} — {r.jobTitle}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.submissionSource} ·{" "}
                  {new Date(r.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    mutation.mutate({ reviewId: r.id, decision: "approve" })
                  }
                  disabled={mutation.isPending}
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    mutation.mutate({ reviewId: r.id, decision: "reject" })
                  }
                  disabled={mutation.isPending}
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p className="rounded-lg bg-secondary/50 p-3 text-foreground/90">
                {r.pros}
              </p>
              <p className="rounded-lg bg-secondary/50 p-3 text-foreground/90">
                {r.cons}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DisputesTab() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listOpenDisputes);
  const resolveFn = useServerFn(resolveDispute);
  const { data, isLoading } = useQuery({
    queryKey: ["open-disputes"],
    queryFn: () => listFn(),
  });

  const mutation = useMutation({
    mutationFn: (input: {
      disputeId: string;
      decision: "resolved" | "dismissed";
    }) => resolveFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["open-disputes"] });
      toast.success("Dispute updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel
      title="Open disputes"
      description="Reviews flagged by a company representative for a second look."
    >
      {isLoading && (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      )}
      {!isLoading && (data?.disputes.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">No open disputes.</p>
      )}
      <div className="space-y-4">
        {data?.disputes.map((d) => (
          <div key={d.id} className="rounded-xl border border-border p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">
                  {d.companyName} — {d.reviewJobTitle}
                </p>
                <p className="text-xs text-muted-foreground">
                  From {d.raisedByContact} ·{" "}
                  {new Date(d.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    mutation.mutate({ disputeId: d.id, decision: "resolved" })
                  }
                  disabled={mutation.isPending}
                >
                  <Flag className="mr-1.5 h-3.5 w-3.5" /> Mark resolved
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    mutation.mutate({ disputeId: d.id, decision: "dismissed" })
                  }
                  disabled={mutation.isPending}
                >
                  Dismiss
                </Button>
              </div>
            </div>
            <p className="rounded-lg bg-secondary/50 p-3 text-sm text-foreground/90">
              {d.reason}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AddCompanyTab() {
  const addFn = useServerFn(addCompany);
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: () => addFn({ data: { name } }),
    onSuccess: (res) => {
      toast.success(`${res.company.name} added (/${res.company.slug})`);
      setName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Company name is required");
    mutation.mutate();
  };

  return (
    <Panel
      title="Add a company"
      description="Creates a new company row immediately."
    >
      <form onSubmit={onSubmit} className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs font-medium">Company name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tata Digital"
            maxLength={200}
          />
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <PlusCircle className="mr-1.5 h-4 w-4" />
          )}
          Add
        </Button>
      </form>
    </Panel>
  );
}

function ReviewCountsTab() {
  const listFn = useServerFn(listCompanyReviewCountsBySource);
  const { data, isLoading } = useQuery({
    queryKey: ["review-counts-by-source"],
    queryFn: () => listFn(),
  });

  return (
    <Panel
      title="Reviews per company, by source"
      description="Surfaces admin-on-behalf volume per company."
    >
      {isLoading && (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      )}
      {!isLoading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Company</th>
                <th className="py-2 pr-4">Self-submitted</th>
                <th className="py-2 pr-4">Admin-on-behalf</th>
                <th className="py-2 pr-4">Imported</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.companies.map((c) => (
                <tr key={c.companySlug}>
                  <td className="py-2 pr-4 font-medium text-foreground">
                    {c.companyName}
                  </td>
                  <td className="py-2 pr-4">{c.self_submitted}</td>
                  <td className="py-2 pr-4">
                    {c.admin_on_behalf > 0 ? (
                      <Badge variant="secondary">{c.admin_on_behalf}</Badge>
                    ) : (
                      0
                    )}
                  </td>
                  <td className="py-2 pr-4">{c.imported}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listUsers);
  const setRoleFn = useServerFn(setUserRole);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn({ data: { limit: 100 } }),
  });

  const mutation = useMutation({
    mutationFn: (input: { userId: string; role: AppRole; grant: boolean }) =>
      setRoleFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel title="Users" description="Grant or revoke moderator/admin access.">
      {isLoading && (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      )}
      <div className="space-y-2">
        {data?.users.map((u) => (
          <div
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{u.email}</p>
              <p className="text-xs text-muted-foreground">
                {u.emailVerifiedAt ? "Verified" : "Unverified"} · joined{" "}
                {new Date(u.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              {(["moderator", "admin"] as const).map((role) => {
                const has = u.roles.includes(role);
                return (
                  <Button
                    key={role}
                    size="sm"
                    variant={has ? "default" : "outline"}
                    onClick={() =>
                      mutation.mutate({ userId: u.id, role, grant: !has })
                    }
                    disabled={mutation.isPending}
                  >
                    {role}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function IngestionTab() {
  const listFn = useServerFn(listIngestionJobs);
  const { data, isLoading } = useQuery({
    queryKey: ["ingestion-jobs"],
    queryFn: () => listFn(),
  });

  return (
    <Panel
      title="Ingestion job history"
      description="Status of each salary-data ingestion run."
    >
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Database className="h-3.5 w-3.5" /> Run new ingestion from the server:{" "}
        <code>npm run ingest</code>
      </div>
      {isLoading && (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      )}
      {!isLoading && (data?.jobs.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">
          No ingestion jobs recorded yet.
        </p>
      )}
      <div className="space-y-2">
        {data?.jobs.map((j) => (
          <div
            key={j.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
          >
            <div>
              <span className="font-medium text-foreground">
                {j.sourceName}
              </span>{" "}
              <Badge
                variant={
                  j.status === "success"
                    ? "secondary"
                    : j.status === "failed"
                      ? "destructive"
                      : "outline"
                }
              >
                {j.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {j.rowsIngested ?? 0} ingested, {j.rowsSkipped ?? 0} skipped ·{" "}
              {j.triggeredBy} · {new Date(j.startedAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AuditLogTab() {
  const listFn = useServerFn(listAuditLog);
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => listFn({ data: { limit: 100 } }),
  });

  return (
    <Panel
      title="Audit log"
      description="Immutable record of admin-on-behalf submissions and redactions."
    >
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <ScrollText className="h-3.5 w-3.5" /> Append-only — nothing here can be
        edited or deleted.
      </div>
      {isLoading && (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      )}
      <div className="space-y-2">
        {data?.entries.map((e) => (
          <div
            key={e.id}
            className="rounded-lg border border-border p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-foreground">{e.action}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(e.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              By {e.adminEmail} on {e.targetTable}/{e.targetId}
            </p>
            <p className="mt-2 rounded bg-secondary/50 p-2 text-foreground/90">
              {e.justification}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
