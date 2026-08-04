import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — DeskBuz" },
      {
        name: "description",
        content:
          "DeskBuz Privacy Policy. DPDP Act compliant: purpose of collection, anonymity safeguards, no third-party sharing, and your right to data access and erasure.",
      },
      { property: "og:title", content: "Privacy Policy — DeskBuz" },
      {
        property: "og:description",
        content:
          "How DeskBuz collects, protects, and anonymises your data in compliance with India's Digital Personal Data Protection Act.",
      },
    ],
  }),
  component: PrivacyPage,
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

function PrivacyPage() {
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
              Privacy Policy
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              DeskBuz ("we", "us", "our") is committed to protecting your
              personal data. This Privacy Policy explains how we collect, use,
              store, and protect your information, in compliance with India's
              Digital Personal Data Protection Act, 2023 (the "DPDP Act") and
              the Information Technology Act, 2000.
            </p>
          </header>

          <div className="mt-10 space-y-12">
            <Section id="purpose" title="1. Purpose of Collection">
              <p>
                DeskBuz collects only the minimum personal data required to
                operate the Platform safely and lawfully. Specifically, we
                collect your <strong>email address</strong> strictly for the
                following purposes:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  <strong>Authentication:</strong> to create and secure your
                  account, verify your identity at sign-in, and allow password
                  reset.
                </li>
                <li>
                  <strong>Abuse prevention:</strong> to prevent spam, automated
                  bot submissions, duplicate reviews, and other forms of misuse
                  of the Platform.
                </li>
              </ul>
              <p>
                We do <strong>not</strong> collect your name, employer name,
                phone number, address, or any other directly identifying
                personal information for the purpose of public listings. Any
                profile metadata you choose to submit (such as job role,
                experience band, or city) is collected solely as aggregate
                workplace data and is not linked back to you.
              </p>
            </Section>

            <Section id="anonymity" title="2. Absolute Anonymity Safeguard">
              <p>
                Your anonymity on the Platform is a foundational guarantee, not
                a feature. We have engineered our systems so that personal
                identifiers and public content live in <strong>completely
                separate, decoupled data stores</strong>:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  Your email address is stored only in our private,
                  access-controlled authentication database, protected by
                  encryption in transit and at rest.
                </li>
                <li>
                  The reviews, salary breakdowns, ratings, and other content
                  you submit are stored independently and contain{" "}
                  <strong>no link, foreign key, or join path</strong> back to
                  your authentication identity in any public-facing query or
                  API response.
                </li>
                <li>
                  No employee, administrator, or third party can look up a
                  review or salary entry and trace it back to a specific user
                  email through the public Platform.
                </li>
              </ul>
              <p>
                <strong>
                  Every review and salary listing visible on DeskBuz is 100%
                  anonymous to the public, to corporate entities, and to other
                  users.
                </strong>
              </p>
            </Section>

            <Section id="no-sharing" title="3. No Third-Party Sharing">
              <p>
                DeskBuz <strong>never sells, rents, leases, trades, or
                shares</strong> your individual professional identity, email
                address, account record, or any personally identifiable
                information with:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  Employer corporations, recruiters, HR departments, or
                  background verification agencies;
                </li>
                <li>
                  Third-party marketing companies, advertising networks, or
                  data brokers;
                </li>
                <li>
                  Any external entity for the purpose of profiling, retargeting,
                  or commercial solicitation.
                </li>
              </ul>
              <p>
                We may share strictly anonymised, aggregated statistics (for
                example, "average software engineer salary in Bangalore") that
                cannot be used to identify any individual user. We may also
                disclose information when required by a valid legal order from
                a court or government authority of competent jurisdiction
                under Indian law.
              </p>
            </Section>

            <Section id="storage" title="4. Data Storage & Security">
              <p>
                All personal data is stored on secure servers with industry
                standard safeguards including encryption in transit (TLS),
                encryption at rest, access controls, audit logging, and the
                principle of least privilege. We retain authentication data
                only for as long as your account remains active, or as
                required by applicable law.
              </p>
            </Section>

            <Section id="rights" title="5. Your Rights as a Data Principal">
              <p>
                Under the DPDP Act, you (as a "Data Principal") have the
                following rights with respect to your personal data held by
                DeskBuz (the "Data Fiduciary"):
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  <strong>Right to Access:</strong> You may request a summary
                  of the personal data we hold about you and the purposes for
                  which it is processed.
                </li>
                <li>
                  <strong>Right to Correction:</strong> You may request that
                  inaccurate or incomplete personal data be corrected or
                  updated.
                </li>
                <li>
                  <strong>Right to Erasure ("Right to Be Forgotten"):</strong>{" "}
                  You may request the deletion of your account and associated
                  personal data at any time. On verified request, your
                  authentication record will be permanently deleted. Public,
                  anonymised content you previously submitted may remain on the
                  Platform as it cannot be linked back to you.
                </li>
                <li>
                  <strong>Right to Grievance Redressal:</strong> You may raise
                  any concern relating to your data through the contact below.
                </li>
                <li>
                  <strong>Right to Nominate:</strong> You may nominate another
                  individual to exercise your rights in the event of your
                  death or incapacity, as provided under the DPDP Act.
                </li>
              </ul>
              <p>
                To exercise any of these rights, please email us at{" "}
                <a
                  href="mailto:privacy@deskbuz.com"
                  className="font-medium text-primary hover:underline"
                >
                  privacy@deskbuz.com
                </a>{" "}
                from the email address associated with your account. We will
                acknowledge your request promptly and act on it within the
                timelines prescribed by the DPDP Act.
              </p>
            </Section>

            <Section id="consent" title="6. Consent & Withdrawal">
              <p>
                By creating an account on DeskBuz, you provide free, specific,
                informed, and unambiguous consent to the processing of your
                personal data for the purposes described in this Policy. You
                may withdraw your consent at any time by deleting your account
                via the process described in Section 5. Withdrawal of consent
                will not affect the lawfulness of processing carried out
                before such withdrawal.
              </p>
            </Section>

            <Section id="contact" title="7. Contact & Data Protection Officer">
              <div className="rounded-lg border border-border bg-secondary/40 p-5">
                <p className="text-sm font-medium uppercase tracking-wider text-primary">
                  Privacy Contact
                </p>
                <p className="mt-2 text-foreground">
                  Email:{" "}
                  <a
                    href="mailto:privacy@deskbuz.com"
                    className="font-medium text-primary hover:underline"
                  >
                    privacy@deskbuz.com
                  </a>
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  For all questions regarding this Privacy Policy, requests to
                  access or delete your data, or any concern about how DeskBuz
                  handles your personal information, please write to the
                  address above.
                </p>
              </div>
            </Section>

            <Section id="changes" title="8. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time to reflect
                changes in law or our practices. Material changes will be
                notified through the Platform. Your continued use of DeskBuz
                after such changes constitutes acceptance of the updated
                Policy.
              </p>
            </Section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
