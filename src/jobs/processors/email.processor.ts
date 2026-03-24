import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as Nodemailer from 'nodemailer';
import { MailtrapTransport } from 'mailtrap';
import { Logger } from '@nestjs/common';

@Processor('emailQueue')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  async process(job: Job<any>) {
    try {
      const mailtrap = Nodemailer.createTransport(
        MailtrapTransport({
          token: process.env.MAILTRAP_API_KEY,
          sandbox: true,
          testInboxId: +process.env.MAILTRAP_TEST_INBOX_ID,
        }),
      );
      const { data } = job;
      const { email, token, userId } = data;
      this.logger.log(
        `Processing job ${job.id} of type ${job.name} for user ${data.userId}`,
      );
      let subject = '';
      let text = '';
      switch (job.name) {
        case 'welcome.email':
        case 'resend-verify.email':
          subject = 'One Step Closer to SaaS! Please verify your email';
          text = `
            Please click the link below to verify your email address:
            ${process.env.URL_PATH}/auth/verify-email?token=${token}
          `;
          break;
        case 'invite.email':
          const { orgName, inviterName, inviterEmail } = data;
          subject = `You have been invited to join ${orgName}`;
          text = ` ${inviterName} ${inviterEmail} invited you to join ${orgName} as a member.
                Accept invitation: ${process.env.URL_PATH}/invitations/accept?token=${token}
                This link expires in 48 hours.`;
          break;
        case 'forgot-password.email':
          subject = 'Reset your password';
          text = `
            Please click the link below to reset your password:
            ${process.env.URL_PATH}/auth/reset-password?token=${token}
          `;
          break;
        case 'change-email.email':
          subject = 'Change your email address';
          text = `
            Please click the link below to confirm your email address:
            ${process.env.URL_PATH}/users/me/email/confirm?token=${token}
          `;
          break;
        default:
          break;
      }
      //Email system implemented with environment-based configuration (Ethereal in dev, production-ready SMTP integration
      this.logger.log('Sending email....', subject, text, email);
      await mailtrap.sendMail({
        from: {
          address: process.env.MAILTRAP_FROM_EMAIL,
          name: process.env.MAILTRAP_FROM_NAME,
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
