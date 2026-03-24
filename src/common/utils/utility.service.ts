import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class UtilityService {
  constructor() {}

  generateSlug(str: string, addSuffix?: boolean): string {
    return addSuffix
      ? str
          .toLowerCase()
          .replace(/[^\w ]+/g, '')
          .replace(/ +/g, '-')
          .concat('-' + randomUUID().slice(0, 8))
      : str
          .toLowerCase()
          .replace(/[^\w ]+/g, '')
          .replace(/ +/g, '-');
  }

  formatYYMM(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    return `${year}${month}`;
  }

  getEndOfMonthTTL(): number {
    const now = new Date();
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );
    return Math.floor((endOfMonth.getTime() - now.getTime()) / 1000);
  }
}
