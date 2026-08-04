import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, Plus, Building2, Loader2 } from "lucide-react";
import { searchCompanies, addCompany } from "@/lib/companies.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CompanySearch() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const search = useServerFn(searchCompanies);
  const add = useServerFn(addCompany);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["companies-search", debounced],
    queryFn: () => search({ data: { q: debounced } }),
    enabled: debounced.length > 0,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const addMut = useMutation({
    mutationFn: (name: string) => add({ data: { name } }),
    onSuccess: ({ company }) => {
      toast.success(`Added ${company.name}`);
      navigate({ to: "/companies/$slug", params: { slug: company.slug } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const companies = data?.companies ?? [];
  const showAdd =
    debounced.length > 0 &&
    !isFetching &&
    !companies.some((c) => c.name.toLowerCase() === debounced.toLowerCase());

  return (
    <div ref={wrapRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search for a company..."
          className="h-16 w-full rounded-2xl border border-border bg-card pl-14 pr-5 text-base text-foreground shadow-lg shadow-primary/5 outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:shadow-xl focus:shadow-primary/10"
        />
        {isFetching && (
          <Loader2 className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && debounced.length > 0 && (
        <div className="absolute left-0 right-0 top-[72px] z-30 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
          {companies.length > 0 && (
            <ul className="max-h-80 overflow-y-auto py-2">
              {companies.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      navigate({ to: "/companies/$slug", params: { slug: c.slug } });
                    }}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-secondary"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{c.name}</div>
                      {c.industry && (
                        <div className="text-xs text-muted-foreground">{c.industry}</div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showAdd && (
            <div className="border-t border-border bg-secondary/40 p-3">
              <div className="mb-2 px-2 text-xs text-muted-foreground">
                Can't find "{debounced}"?
              </div>
              <Button
                onClick={() => addMut.mutate(debounced)}
                disabled={addMut.isPending}
                variant="outline"
                className="w-full justify-start"
              >
                {addMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add this Company
              </Button>
            </div>
          )}
          {!isFetching && companies.length === 0 && !showAdd && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No results
            </div>
          )}
        </div>
      )}
    </div>
  );
}
