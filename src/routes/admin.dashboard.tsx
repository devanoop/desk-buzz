import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Lock, Loader2, CheckCircle2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminGuard } from "@/components/AdminGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Internal" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AdminGuard redirectPath="/admin/dashboard">
      <AdminDashboard />
    </AdminGuard>
  ),
});

/**
 * Convert a raw company name into a URL-safe slug.
 * "Tata Digital" -> "tata-digital", "Ola Electric!" -> "ola-electric"
 */
export function slugifyCompanyName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

const EMPTY = { name: "", industry: "", location: "" };

function AdminDashboard() {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const slugPreview = form.name ? slugifyCompanyName(form.name) : "";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    const name = form.name.trim();
    if (!name) return toast.error("Company name is required");

    // Derive the URL-safe slug from the raw name immediately before insert:
    // lowercase, spaces -> hyphens, strip special chars.
    const slug = slugifyCompanyName(name);
    if (!slug) return toast.error("Could not derive a valid slug from that name");

    setSubmitting(true);
    const description = [
      form.industry.trim() && `Industry: ${form.industry.trim()}`,
      form.location.trim() && `Headquarters: ${form.location.trim()}`,
    ]
      .filter(Boolean)
      .join(" · ");

    // Explicit payload — `slug` is always included and never null.
    const payload = {
      name,
      slug,
      industry: form.industry.trim() || null,
      description: description || null,
    };

    const { error } = await supabase.from("companies").insert(payload);
    setSubmitting(false);

    if (error) {
      toast.error(error.message || "Failed to add company");
      return;
    }
    toast.success("Company added to database successfully!");
    setSuccess(`${name} (/${slug})`);
    setForm(EMPTY);
  };

  return (
    <div className="min-h-screen bg-secondary/30 py-10">
      <Toaster position="top-center" />
      <main className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                Internal data-entry tools
              </p>
            </div>
          </div>
          <Link
            to="/admin/tele-calling-entry"
            className="text-xs font-medium text-primary hover:underline"
          >
            Tele-calling entry →
          </Link>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
              Add Company
            </h2>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Company Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Tata Digital"
              maxLength={200}
              required
            />
            {slugPreview && (
              <p className="text-xs text-muted-foreground">
                URL slug: <code className="rounded bg-secondary px-1 text-foreground">/{slugPreview}</code>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Industry Verticals</Label>
            <Input
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              placeholder="e.g. Fintech, Consumer Internet"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Headquarters Location</Label>
            <Input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Bengaluru, India"
            />
          </div>

          {success && (
            <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Company added to database successfully!</p>
                <p className="text-xs text-primary/80">{success}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setForm(EMPTY);
                setSuccess(null);
              }}
              disabled={submitting}
            >
              Clear
            </Button>
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Company
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
