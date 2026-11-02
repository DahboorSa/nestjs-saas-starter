import { logError } from '../../common/utils/log-error.util';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as Nodemailer from 'nodemailer';
import { MailtrapTransport } from 'mailtrap';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { EmailJobData } from '../job-data.types';

type EmailTemplate = (data: EmailJobData) => { subject: string; text: string };

const buildTemplates = (baseUrl: string): Record<string, EmailTemplate> => ({
  'welcome.email': ({ token }) => ({
    subject: 'One Step Closer to SaaS! Please verify your email',
    text: `Please click the link below to verify your email address:\n${baseUrl}/verify-email?token=${token}`,
  }),
  'resend-verify.email': ({ token }) => ({
    subject: 'One Step Closer to SaaS! Please verify your email',
    text: `Please click the link below to verify your email address:\n${baseUrl}/verify-email?token=${token}`,
  }),
  'invite.email': ({ token, orgName, inviterName, inviterEmail }) => ({
    subject: `You have been invited to join ${orgName}`,
    text: `${inviterName} ${inviterEmail} invited you to join ${orgName} as a member.\nAccept invitation: ${baseUrl}/invitations/accept?token=${token}\nThis link expires in 48 hours.`,
  }),
  // Sent instead of creating anything when someone registers with an email
  // that already has an account, so POST /auth/register can answer identically
  // for new and existing emails (no account enumeration).
  'account-exists.email': () => ({
    subject: 'You already have an account',
    text: `Someone (hopefully you) tried to register with this email address, but an account already exists.\nLog in: ${baseUrl}/login\nForgot your password? ${baseUrl}/forgot-password\nIf this was not you, you can safely ignore this email.`,
  }),
  'forgot-password.email': ({ token }) => ({
    subject: 'Reset your password',
    text: `Please click the link below to reset your password:\n${baseUrl}/reset-password?token=${token}`,
  }),
  'change-email.email': ({ token }) => ({
    subject: 'Change your email address',
    text: `Please click the link below to confirm your email address:\n${baseUrl}/confirm-email?token=${token}`,
  }),
});

@Injectable()
@Processor('emailQueue')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly templates: Record<string, EmailTemplate>;
  private readonly isProduction: boolean;
  private readonly sesClient: SESClient;
  private readonly mailtrapTransport: Nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    super();
    this.templates = buildTemplates(
      this.configService.getOrThrow<string>('URL_PATH'),
    );
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (this.isProduction) {
      this.sesClient = new SESClient({
        region: this.configService.getOrThrow<string>('AWS_REGION'),
        credentials: {
          accessKeyId:
            this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.getOrThrow<string>(
            'AWS_SECRET_ACCESS_KEY',
          ),
        },
      });
      this.logger.log('Email transport: AWS SES (production)');
    } else {
      this.mailtrapTransport = Nodemailer.createTransport(
        MailtrapTransport({
          token: this.configService.getOrThrow<string>('MAILTRAP_API_KEY'),
          sandbox: true,
          testInboxId: +this.configService.getOrThrow<number>(
            'MAILTRAP_TEST_INBOX_ID',
          ),
        }),
      );
      this.logger.log('Email transport: Mailtrap (non-production)');
    }
  }

  async process(job: Job<EmailJobData>) {
    try {
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

      if (this.isProduction) {
        await this.sesClient.send(
          new SendEmailCommand({
            Destination: { ToAddresses: [email] },
            Message: {
              Body: { Text: { Charset: 'UTF-8', Data: text } },
              Subject: { Charset: 'UTF-8', Data: subject },
            },
            Source: this.configService.getOrThrow<string>('SES_FROM_EMAIL'),
          }),
        );
      } else {
        await this.mailtrapTransport.sendMail({
          from: {
            address: this.configService.getOrThrow<string>(
              'MAILTRAP_FROM_EMAIL',
            ),
            name: this.configService.getOrThrow<string>('MAILTRAP_FROM_NAME'),
          },
          to: [email],
          subject,
          text,
        });
      }

      this.logger.log('Email sent successfully', userId);
    } catch (error) {
      logError(this.logger, `Email job ${job.id} failed`, error);
      throw error;
    }
  }
}
