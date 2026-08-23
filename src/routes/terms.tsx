import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — DeskBuz" },
      {
        name: "description",
        content:
          "DeskBuz Terms of Service. Intermediary status under Section 79 of the IT Act, 2000, user conduct rules, indemnity, and grievance redressal mechanism.",
      },
      { property: "og:title", content: "Terms of Service — DeskBuz" },
      {
        property: "og:description",
        content:
          "Read the DeskBuz Terms of Service, including our intermediary status, user obligations, and grievance officer details.",
      },
    ],
  }),
  component: TermsPage,
});

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function TermsPage() {
  const lastUpdated = "June 6, 2026";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <header className="border-b border-border pb-8">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">
              Legal
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Terms of Service
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              Welcome to DeskBuz. These Terms of Service ("Terms") govern your
              access to and use of the DeskBuz website, applications, and
              services (collectively, the "Platform"). By using the Platform,
              you agree to be bound by these Terms.
            </p>
          </header>

          <div className="mt-10 space-y-12">
            <Section
              id="intermediary"
              title="1. Intermediary Status & Safe Harbor"
            >
              <p>
                DeskBuz operates purely as an "intermediary" as defined under
                Section 2(1)(w) of the Information Technology Act, 2000 (the "IT
                Act"), and is entitled to the safe harbor protections available
                under Section 79 of the IT Act and the Information Technology
                (Intermediary Guidelines and Digital Media Ethics Code) Rules,
                2021.
              </p>
              <p>
                The Platform provides a neutral, technology-enabled venue for
                users to share, view, and discuss workplace information such as
                company reviews, ratings, salary data, and interview
                experiences. All such content is generated, submitted, and
                published by third-party users.
              </p>
              <p>
                DeskBuz does <strong>not</strong> author, originate, initiate,
                select, modify, verify, endorse, or otherwise control the
                user-generated content hosted on the Platform. We do not
                guarantee the accuracy, completeness, or reliability of any
                review, salary listing, or other content posted by users. Any
                reliance you place on such content is strictly at your own risk.
              </p>
            </Section>

            <Section id="conduct" title="2. Prohibited User Conduct">
              <p>
                By using the Platform you agree that you will not host, display,
                upload, modify, publish, transmit, store, update, or share any
                information or content that:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  is defamatory, libelous, slanderous, blasphemous, obscene,
                  pornographic, paedophilic, invasive of another's privacy
                  including bodily privacy, or insulting or harassing on the
                  basis of gender;
                </li>
                <li>
                  is hateful, racially or ethnically objectionable,
                  discriminatory, or relating to or encouraging money laundering
                  or gambling;
                </li>
                <li>
                  infringes any patent, trademark, copyright, trade secret, or
                  other proprietary or intellectual property rights of any
                  party;
                </li>
                <li>
                  identifies, names, targets, or refers to any specific
                  individual manager, employee, colleague, or other natural
                  person by name, nickname, designation combined with
                  identifying details, photograph, or any other personally
                  identifying information;
                </li>
                <li>
                  threatens the unity, integrity, defence, security or
                  sovereignty of India, friendly relations with foreign States,
                  or public order, or causes incitement to the commission of any
                  cognisable offence;
                </li>
                <li>
                  contains software viruses, malicious code, or is otherwise
                  intended to harm the Platform or its users;
                </li>
                <li>
                  is knowingly false, misleading, or intended to deceive readers
                  about the nature of a workplace, salary, or employment
                  experience.
                </li>
              </ul>
              <p>
                <strong>
                  Reviews, ratings, and commentary must focus solely on the
                  corporate entity, its policies, work culture, compensation
                  practices, and overall workplace environment — never on
                  identifiable individual employees.
                </strong>{" "}
                Content that targets a named individual will be removed and may
                result in immediate termination of your access to the Platform.
              </p>
            </Section>

            <Section id="indemnity" title="3. User Responsibility & Indemnity">
              <p>
                You acknowledge and agree that you are{" "}
                <strong>solely and exclusively liable</strong> for any and all
                content, reviews, salary data, comments, or other information
                that you post, submit, or transmit through the Platform. DeskBuz
                bears no responsibility or liability whatsoever for the content
                authored by users.
              </p>
              <p>
                You agree to indemnify, defend, and hold harmless DeskBuz, its
                affiliates, officers, directors, employees, and agents from and
                against any and all claims, demands, losses, liabilities,
                damages, costs, and expenses (including reasonable attorneys'
                fees) arising out of or in connection with: (a) any content you
                submit to the Platform; (b) your breach of these Terms; or (c)
                your violation of any applicable law or the rights of any third
                party.
              </p>
              <p>
                You represent and warrant that any content you submit is your
                own original first-hand experience, is truthful to the best of
                your knowledge, and does not violate any confidentiality
                obligation, non-disclosure agreement, or other contractual or
                legal duty owed to your current or former employer.
              </p>
            </Section>

            <Section
              id="takedown"
              title="4. Content Removal & Statutory Compliance"
            >
              <p>
                In accordance with Rule 3(1)(d) of the Information Technology
                (Intermediary Guidelines and Digital Media Ethics Code) Rules,
                2021, DeskBuz will remove or disable access to any content
                hosted on the Platform within thirty-six (36) hours of receipt
                of a valid order from a court of competent jurisdiction or a
                lawful direction from an authorised government agency.
              </p>
              <p>
                Affected parties may also report violating content through the
                Grievance Redressal Mechanism set out below.
              </p>
            </Section>

            <Section id="grievance" title="5. Grievance Redressal Mechanism">
              <p>
                In compliance with Rule 3(2) of the Information Technology
                (Intermediary Guidelines and Digital Media Ethics Code) Rules,
                2021, DeskBuz has appointed a Grievance Officer to address
                concerns relating to content hosted on the Platform.
              </p>
              <p>
                Any corporate entity, individual, or other affected party
                seeking the removal of defamatory, infringing, or otherwise
                violating content may submit a written complaint to our
                Grievance Officer at the address below. Complaints should
                include: (i) the URL of the specific content; (ii) the nature of
                the grievance and the rule or right alleged to be violated; and
                (iii) verifiable contact details of the complainant.
              </p>
              <div className="rounded-lg border border-border bg-secondary/40 p-5">
                <p className="text-sm font-medium uppercase tracking-wider text-primary">
                  Grievance Officer
                </p>
                <p className="mt-2 text-foreground">
                  Email:{" "}
                  <a
                    href="mailto:grievance@deskbuz.com"
                    className="font-medium text-primary hover:underline"
                  >
                    grievance@deskbuz.com
                  </a>
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  In accordance with Indian statutory timelines, complaints will
                  be acknowledged within twenty-four (24) hours of receipt, and
                  resolved within fifteen (15) days. Content flagged under Rule
                  3(2)(b) (relating to the impersonation or exposure of private
                  parts of an individual) will be actioned within seventy-two
                  (72) hours.
                </p>
              </div>
            </Section>

            <Section id="governing-law" title="6. Governing Law & Jurisdiction">
              <p>
                These Terms shall be governed by and construed in accordance
                with the laws of India. Any dispute arising out of or in
                connection with these Terms or your use of the Platform shall be
                subject to the exclusive jurisdiction of the competent courts
                located in India.
              </p>
            </Section>

            <Section id="changes" title="7. Changes to These Terms">
              <p>
                DeskBuz reserves the right to modify or update these Terms at
                any time. Material changes will be notified through the
                Platform. Your continued use of the Platform after such changes
                constitutes your acceptance of the revised Terms.
              </p>
            </Section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
