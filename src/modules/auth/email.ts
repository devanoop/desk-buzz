// Transactional email abstraction. No provider is wired in — the user
// declined Resend and didn't name an alternative, so this ships with a
// console-logging sender that makes verification/reset links visible in
// server logs (functional for local dev and for you to test the flows end
// to end) but sends nothing anywhere. Swap `defaultSender` for a real
// implementation of EmailSender before deploying — every call site in this
// codebase goes through getEmailSender(), so that's a one-file change.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      `[email:dev-console] No real email provider is configured — this message was not sent anywhere.\n` +
        `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`,
    );
  }
}

let sender: EmailSender = new ConsoleEmailSender();

export function getEmailSender(): EmailSender {
  return sender;
}

/** Swap in a real provider (or a test double) — see the module comment above. */
export function setEmailSender(next: EmailSender): void {
  sender = next;
}
