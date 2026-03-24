import { registerAs } from '@nestjs/config';

export class DatabaseConfig {
  host: string = process.env.DB_HOST;
  port: number = +process.env.DB_PORT;
  username: string = process.env.DB_USER;
  password: string = process.env.DB_PASSWORD;
  database: string = process.env.DB_NAME;
  sync: boolean = process.env.DB_SYNC === 'true';
  logging: boolean = process.env.DB_LOGGING === 'true';
}

export default registerAs('database', () => new DatabaseConfig());
