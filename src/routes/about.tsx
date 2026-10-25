import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Scale, Eye, Mail, Phone } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About DeskBuz" },
      {
        name: "description",
        content:
          "DeskBuz is the home for 100% anonymous, unbiased, and transparent workplace intelligence — honest reviews, salary insights, and company culture ratings.",
      },
      { property: "og:title", content: "About DeskBuz" },
      {
        property: "og:description",
        content:
          "The home for 100% anonymous, unbiased, and transparent workplace intelligence.",
      },
    ],
  }),
  component: AboutPage,
});

const OFFERINGS = [
  {
    icon: ShieldCheck,
    title: "100% Anonymous Employee Reviews",
    description:
      "We prioritize reviewer safety above all else. Our platform is engineered to protect user identities, allowing current and former employees to share their real, candid workplace experiences without fear of retaliation.",
  },
  {
    icon: Scale,
    title: "Unbiased Corporate Intelligence",
    description:
      "We maintain strict editorial independence. Reviews are genuine user experiences — unfiltered, unbiased, and unedited by corporate influence or employer sponsorships.",
  },
  {
    icon: Eye,
    title: "Transparent Career Insights",
    description:
      "Job seekers, professionals, and industry observers gain access to authentic workplace metrics, culture ratings, and internal corporate realities to make smarter career decisions.",
  },
] as const;

function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-secondary/50 to-transparent" />
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">
              About DeskBuz
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              The Home for 100% Anonymous, Unbiased, and Transparent Workplace
              Intelligence
            </h1>
          </div>
        </section>

        <div className="mx-auto max-w-3xl space-y-16 px-4 pb-20 sm:px-6 lg:px-8">
          {/* Mission */}
          <section className="scroll-mt-24">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Our Mission
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              At DeskBuz, we believe true corporate accountability and honest
              workplace insights can only exist when employees have a safe,
              completely anonymous voice. Our platform is built to strip away
              corporate PR filters and deliver transparent, authentic, and
              unbiased reviews about workplace culture, management, salaries,
              and company environments.
            </p>
          </section>

          {/* What We Offer */}
          <section className="scroll-mt-24">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              What We Offer
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-4">
              {OFFERINGS.map((o) => (
                <Card key={o.title}>
                  <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <o.icon className="h-5 w-5" />
                    </span>
                    <CardTitle className="text-lg leading-snug">
                      {o.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {o.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Vision */}
          <section className="scroll-mt-24">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Our Vision
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              By fostering a space of absolute transparency, DeskBuz aims to
              level the playing field between employers and candidates. We
              empower professionals through verified community truth while
              encouraging companies to build healthier, more accountable
              corporate cultures.
            </p>
          </section>

          {/* Contact & Publishing Info */}
          <section id="contact" className="scroll-mt-24">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Contact &amp; Publishing Info
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              DeskBuz is independently operated with a commitment to privacy,
              data security, and transparent publisher standards.
            </p>

            <div className="mt-6 rounded-lg border border-border bg-secondary/40 p-5">
              <p className="text-sm font-medium uppercase tracking-wider text-primary">
                Platform: DeskBuz
              </p>
              <div className="mt-3 space-y-2 text-foreground">
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href="mailto:contact@deskbuz.com"
                    className="font-medium text-primary hover:underline"
                  >
                    contact@deskbuz.com
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a
                    href="tel:+918097265942"
                    className="font-medium text-primary hover:underline"
                  >
                    +91 80972 65942
                  </a>
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
