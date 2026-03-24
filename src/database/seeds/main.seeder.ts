import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';
import PlanSeeder from './plan.seeder';

export default class MainSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<void> {
    await new PlanSeeder().run(dataSource);
  }
}
