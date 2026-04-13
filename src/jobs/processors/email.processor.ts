import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

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
  private readonly sesClient: SESClient;
  constructor(private readonly configService: ConfigService) {
    super();
    this.templates = buildTemplates(this.configService.get<string>('URL_PATH'));
    this.sesClient = new SESClient({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  async process(job: Job<any>) {
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

      const sendEmailCommand = new SendEmailCommand({
        Destination: {
          ToAddresses: [email],
        },
        Message: {
          Body: {
            Text: {
              Charset: 'UTF-8',
              Data: text,
            },
          },
          Subject: {
            Charset: 'UTF-8',
            Data: subject,
          },
        },
        Source: this.configService.get<string>('SES_FROM_EMAIL'),
      });
      await this.sesClient.send(sendEmailCommand);

      this.logger.log('Email sent successfully', userId);
    } catch (error) {
      this.logger.error(error);
      throw error; // Rethrow the error to trigger retry
    }
  }
}
