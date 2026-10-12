/**
 * Creates an organisation and its first admin. There is no public sign-up:
 * this is how a new company gets onto the system.
 *
 * Usage:
 *   pnpm org:create --org "Shree Bricks" --name "Owner Name" --phone 9876543210 [--email a@b.com]
 *
 * Prints a temporary password once; the admin must change it at first sign-in.
 */
import { parseArgs } from 'node:util';
import { connectDb, disconnectDb } from '../lib/db';
import { hashPassword } from '../lib/password';
import { normalizePhone } from '../lib/phone';
import { generateTemporaryPassword, temporaryPasswordExpiry } from '../lib/ids';
import { NO_ACCESS } from '../lib/permissions';
import { defaultPrefs } from '../features/notifications/prefs';
import { Organization } from '../models/organization';
import { User } from '../models/user';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      org: { type: 'string' },
      name: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string' },
    },
  });

  const phone = values.phone ? normalizePhone(values.phone) : null;
  if (!values.org?.trim() || !values.name?.trim() || !phone) {
    console.error(
      'Usage: pnpm org:create --org "Company" --name "Admin name" --phone 9876543210 [--email you@example.com]',
    );
    process.exitCode = 1;
    return;
  }

  await connectDb();
  try {
    if (await User.exists({ phone })) {
      console.error(`A user with phone ${phone} already exists.`);
      process.exitCode = 1;
      return;
    }

    const org = await Organization.create({ name: values.org.trim() });
    const temporaryPassword = generateTemporaryPassword();
    await User.create({
      orgId: org._id,
      name: values.name.trim(),
      phone,
      email: values.email?.trim().toLowerCase() ?? null,
      passwordHash: await hashPassword(temporaryPassword),
      role: 'admin',
      permissions: NO_ACCESS,
      mustChangePassword: true,
      temporaryPasswordExpiresAt: temporaryPasswordExpiry(),
      notificationPrefs: defaultPrefs('admin'),
    });

    console.log(`\nOrganisation "${org.name}" created.`);
    console.log(`Admin sign-in: ${phone}`);
    console.log(`Temporary password (shown once, valid 72 hours): ${temporaryPassword}\n`);
  } finally {
    await disconnectDb();
  }
}

main().catch((err: unknown) => {
  console.error('Failed:', err);
  process.exit(1);
});
