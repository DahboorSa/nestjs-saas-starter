import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig, { DatabaseConfig } from '../config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: async (config: DatabaseConfig) => ({
        type: 'postgres',
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        database: config.database,
        synchronize: config.sync,
        logging: config.logging,
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      }),
    }),
  ],
  controllers: [],
  providers: [],
})
export class DatabaseModule {}
