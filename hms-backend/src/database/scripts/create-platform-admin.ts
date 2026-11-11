import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { ControlDataSource } from '../data-source';
import { PlatformAdmin } from '../../platform-admin/platform-admin.entity';

dotenv.config();

/**
 * Run as:
 *   npm run seed:platform-admin -- --email=you@yourcompany.com --password=... --name="Your Name"
 *
 * Deliberately the ONLY way to create a platform admin account - there
 * is no API registration endpoint for this, since these accounts have
 * cross-tenant access to every client on the platform.
 */
async function main() {
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const { email, password, name } = args;

  if (!email || !password || !name) {
    console.error('Usage: npm run seed:platform-admin -- --email=you@yourcompany.com --password=... --name="Your Name"');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  await ControlDataSource.initialize();

  const repo = ControlDataSource.getRepository(PlatformAdmin);
  const existing = await repo.findOne({ where: { email } });
  if (existing) {
    console.error(`A platform admin with email "${email}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await repo.save(repo.create({ email, name, passwordHash, isActive: true }));

  console.log(`Created platform admin "${name}" <${email}> (id: ${admin.id})`);
  console.log(`Log in via POST /platform/auth/login`);

  await ControlDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
