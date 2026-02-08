/**
 * Port for email sending service
 */

export interface EmailMessage {
  to: string[];
  subject: string;
  body: string;
  html?: string;
}

export interface EmailSenderPort {
  send(message: EmailMessage): Promise<void>;
}
