import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Menu,
  MessageSquarePlus,
  Banknote,
  LogOut,
  LogIn,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AuthGatedLink } from "@/components/AuthGatedLink";
import { useAuth } from "@/components/AuthProvider";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            D
          </span>
          DeskBuz
        </Link>

        {/* Desktop actions */}
        <div className="hidden items-center gap-1 sm:flex">
          <Button asChild variant="ghost">
            <Link to="/salaries">Salary Explorer</Link>
          </Button>
          <Button asChild variant="ghost">
            <AuthGatedLink to="/review">Write a Review</AuthGatedLink>
          </Button>
          <Button asChild className="ml-2">
            <AuthGatedLink to="/share-salary">Share Salary</AuthGatedLink>
          </Button>
          {user ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              aria-label="Sign out"
              className="ml-1"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              asChild
              variant="ghost"
              size="icon"
              aria-label="Sign in"
              className="ml-1"
            >
              <Link to="/login">
                <LogIn className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="sm:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open menu"
                className="h-11 w-11"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm p-0">
              <SheetHeader className="border-b border-border px-6 py-5 text-left">
                <SheetTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                    D
                  </span>
                  DeskBuz
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 px-4 py-5">
                <SheetClose asChild>
                  <Link
                    to="/salaries"
                    className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-medium text-foreground hover:bg-secondary active:bg-secondary"
                  >
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Salary Explorer
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <AuthGatedLink
                    to="/review"
                    className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-medium text-foreground hover:bg-secondary active:bg-secondary"
                  >
                    <MessageSquarePlus className="h-5 w-5 text-primary" />
                    Write a Review
                  </AuthGatedLink>
                </SheetClose>
                <SheetClose asChild>
                  <AuthGatedLink
                    to="/share-salary"
                    className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-medium text-foreground hover:bg-secondary active:bg-secondary"
                  >
                    <Banknote className="h-5 w-5 text-primary" />
                    Share Salary
                  </AuthGatedLink>
                </SheetClose>
              </nav>
              <div className="mt-2 border-t border-border px-4 py-4 space-y-2">
                <SheetClose asChild>
                  <Button asChild size="lg" className="h-12 w-full">
                    <AuthGatedLink to="/share-salary">
                      Share Salary
                    </AuthGatedLink>
                  </Button>
                </SheetClose>
                {user ? (
                  <Button
                    variant="ghost"
                    size="lg"
                    className="h-12 w-full"
                    onClick={signOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                ) : (
                  <SheetClose asChild>
                    <Button
                      asChild
                      variant="ghost"
                      size="lg"
                      className="h-12 w-full"
                    >
                      <Link to="/login">
                        <LogIn className="mr-2 h-4 w-4" /> Sign in
                      </Link>
                    </Button>
                  </SheetClose>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
