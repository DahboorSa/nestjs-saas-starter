import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as Nodemailer from 'nodemailer';
import { MailtrapTransport } from 'mailtrap';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type EmailTemplate = (data: any) => { subject: string; text: string };

const buildTemplates = (baseUrl: string): Record<string, EmailTemplate> => ({
  'welcome.email': ({ token }) => ({
    subject: 'One Step Closer to SaaS! Please verify your email',
    text: `Please click the link below to verify your email address:\n${baseUrl}/auth/verify-email?token=${token}`,
  }),
  'resend-verify.email': ({ token }) => ({
    subject: 'One Step Closer to SaaS! Please verify your email',
    text: `Please click the link below to verify your email address:\n${baseUrl}/auth/verify-email?token=${token}`,
  }),
  'invite.email': ({ token, orgName, inviterName, inviterEmail }) => ({
    subject: `You have been invited to join ${orgName}`,
    text: `${inviterName} ${inviterEmail} invited you to join ${orgName} as a member.\nAccept invitation: ${baseUrl}/invitations/accept?token=${token}\nThis link expires in 48 hours.`,
  }),
  'forgot-password.email': ({ token }) => ({
    subject: 'Reset your password',
    text: `Please click the link below to reset your password:\n${baseUrl}/auth/reset-password?token=${token}`,
  }),
  'change-email.email': ({ token }) => ({
    subject: 'Change your email address',
    text: `Please click the link below to confirm your email address:\n${baseUrl}/users/me/email/confirm?token=${token}`,
  }),
});

@Injectable()
@Processor('emailQueue')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly templates: Record<string, EmailTemplate>;

  constructor(private readonly configService: ConfigService) {
    super();
    this.templates = buildTemplates(this.configService.get<string>('URL_PATH'));
  }

  async process(job: Job<any>) {
    try {
      const mailtrap = Nodemailer.createTransport(
        MailtrapTransport({
          token: this.configService.get<string>('MAILTRAP_API_KEY'),
          sandbox: true,
          testInboxId: +this.configService.get<number>(
            'MAILTRAP_TEST_INBOX_ID',
          ),
        }),
      );
      const { data } = job;
      const { email, userId } = data;
      this.logger.log(
        `Processing job ${job.id} of type ${job.name} for user ${userId}`,
      );

      const template = this.templates[job.name];
      if (!template) {
        this.logger.warn(`No email template found for job type: ${job.name}`);
        return;
      }
      const { subject, text } = template(data);

      await mailtrap.sendMail({
        from: {
          address: this.configService.get<string>('MAILTRAP_FROM_EMAIL'),
          name: this.configService.get<string>('MAILTRAP_FROM_NAME'),
        },
        to: [email],
        subject,
        text,
      });
      this.logger.log('Email sent successfully', userId);
    } catch (error) {
      this.logger.error(error);
      throw error; // Rethrow the error to trigger retry
    }
  }
}
