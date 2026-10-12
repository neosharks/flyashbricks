/**
 * Demo data: one company with a month of realistic activity, written through
 * the same service functions the app uses, so every balance, ledger row,
 * invoice number and audit entry is exactly what real use would produce.
 *
 * Synthetic only. Refuses to run with NODE_ENV=production, and against any
 * database that is not on this machine or the local Docker network unless
 * `--force-demo` is passed — a demo admin with a published password must
 * never land in a real company's database.
 *
 * Usage: pnpm db:seed [--force-demo]
 */
import { parseArgs } from 'node:util';
import { connectDb, disconnectDb } from '../lib/db';
import { hashPassword } from '../lib/password';
import { addDays, DEFAULT_TIMEZONE, todayKey } from '../lib/dates';
import { NO_ACCESS, type Permissions, type SessionUser } from '../lib/permissions';
import { defaultPrefs } from '../features/notifications/prefs';
import { nextAvatarVariant } from '../features/people/avatar';
import { Organization } from '../models/organization';
import { User } from '../models/user';
import { RawMaterial } from '../models/raw-material';
import { Sale } from '../models/sale';
import { Notification } from '../models/notification';
import { createMaterial, recordPurchase } from '../features/raw-materials/service';
import { createProduct } from '../features/stock/service';
import { logProduction } from '../features/production/service';
import { createCustomer } from '../features/customers/service';
import { addPayment, createSale } from '../features/sales/service';
import { CreateMaterialSchema, PurchaseSchema } from '../features/raw-materials/schema';
import { CreateProductSchema } from '../features/stock/schema';
import { LogProductionSchema } from '../features/production/schema';
import { CreateCustomerSchema } from '../features/customers/schema';
import { AddPaymentSchema, CreateSaleSchema } from '../features/sales/schema';
import {
  AttendanceSheetSchema,
  CreateStaffSchema,
  StaffPaymentSchema,
} from '../features/staff/schema';
import { createStaff, markAttendance, recordStaffPayment } from '../features/staff/service';
import type { Gender, MaterialKind, Unit } from '../models/constants';

const DEMO_PASSWORD = 'demo-password-123';
const DAYS = 30;
const TZ = DEFAULT_TIMEZONE;

/** Deterministic pseudo-random numbers, so every seed produces the same month. */
let state = 20_261_012;
function random(): number {
  state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
  return state / 2 ** 31;
}
const between = (min: number, max: number) => Math.round(min + random() * (max - min));

async function createUser(
  orgId: string,
  name: string,
  nameHi: string,
  phone: string,
  role: 'admin' | 'employee',
  permissions: Permissions,
  gender: Gender,
  extra: { email?: string; jobTitle?: string } = {},
): Promise<SessionUser> {
  const user = await User.create({
    orgId,
    name,
    nameHi,
    phone,
    email: extra.email ?? null,
    jobTitle: extra.jobTitle ?? null,
    passwordHash: await hashPassword(DEMO_PASSWORD),
    role,
    permissions,
    // Demo accounts skip the forced first-time password change.
    mustChangePassword: false,
    notificationPrefs: defaultPrefs(role),
    gender,
    // Same rotation the app uses, so the demo team all look different.
    avatarVariant: await nextAvatarVariant(orgId),
  });
  return { id: user._id.toString(), orgId, name, role, permissions, mustChangePassword: false };
}

const MATERIALS: {
  name: string;
  nameHi: string;
  kind: MaterialKind;
  unit: Unit;
  low: string;
  capacity: string;
  opening: string;
}[] = [
  {
    name: 'Fly ash',
    nameHi: 'फ्लाई ऐश',
    kind: 'fly_ash',
    unit: 'tonne',
    low: '25',
    capacity: '120',
    opening: '60',
  },
  {
    name: 'Stone dust',
    nameHi: 'पत्थर का चूरा',
    kind: 'sand',
    unit: 'tonne',
    low: '12',
    capacity: '60',
    opening: '30',
  },
  {
    name: 'Cement (OPC 43)',
    nameHi: 'सीमेंट (OPC 43)',
    kind: 'cement',
    unit: 'bag',
    low: '60',
    capacity: '400',
    opening: '220',
  },
  {
    name: 'Lime',
    nameHi: 'चूना',
    kind: 'lime',
    unit: 'kg',
    low: '200',
    capacity: '2000',
    opening: '900',
  },
  {
    name: 'Gypsum',
    nameHi: 'जिप्सम',
    kind: 'gypsum',
    unit: 'kg',
    low: '100',
    capacity: '1000',
    opening: '450',
  },
];

/** Truckloads that arrive when stock runs down: quantity and price per unit in rupees. */
const RESTOCK: Record<string, { qty: number; rate: number; supplier: string }> = {
  'Fly ash': { qty: 40, rate: 650, supplier: 'NTPC Dadri' },
  'Stone dust': { qty: 20, rate: 900, supplier: 'Balaji Crushers' },
  'Cement (OPC 43)': { qty: 200, rate: 345, supplier: 'Shree Cement Dealer' },
};

/** Mostly local (Uttar Pradesh) buyers, and one across the border for an IGST bill. */
const CUSTOMERS: {
  name: string;
  nameHi: string;
  phone: string;
  city: string;
  cityHi: string;
  stateCode: '09' | '08';
  gstin?: string;
}[] = [
  {
    name: 'Ramesh Kumar Contractor',
    nameHi: 'रमेश कुमार ठेकेदार',
    phone: '9810012345',
    city: 'Ghaziabad',
    cityHi: 'ग़ाज़ियाबाद',
    stateCode: '09',
  },
  {
    name: 'Sharma Builders',
    nameHi: 'शर्मा बिल्डर्स',
    phone: '9811023456',
    city: 'Noida',
    cityHi: 'नोएडा',
    stateCode: '09',
  },
  {
    name: 'Mahesh Yadav',
    nameHi: 'महेश यादव',
    phone: '9927034567',
    city: 'Meerut',
    cityHi: 'मेरठ',
    stateCode: '09',
  },
  {
    name: 'Gupta Construction',
    nameHi: 'गुप्ता कंस्ट्रक्शन',
    phone: '9837045678',
    city: 'Hapur',
    cityHi: 'हापुड़',
    stateCode: '09',
  },
  {
    name: 'Suresh Meena',
    nameHi: 'सुरेश मीणा',
    phone: '9719056789',
    city: 'Bulandshahr',
    cityHi: 'बुलंदशहर',
    stateCode: '09',
  },
  {
    name: 'Agarwal Developers',
    nameHi: 'अग्रवाल डेवलपर्स',
    phone: '9958067890',
    city: 'Greater Noida',
    cityHi: 'ग्रेटर नोएडा',
    stateCode: '09',
  },
  {
    name: 'Prakash Choudhary',
    nameHi: 'प्रकाश चौधरी',
    phone: '9012078901',
    city: 'Dadri',
    cityHi: 'दादरी',
    stateCode: '09',
  },
  {
    name: 'Verma Infra (Jaipur)',
    nameHi: 'वर्मा इंफ्रा (जयपुर)',
    phone: '9829089012',
    city: 'Jaipur',
    cityHi: 'जयपुर',
    stateCode: '08',
    gstin: '08PQRST5678K1Z2',
  },
  {
    name: 'Dinesh Saini',
    nameHi: 'दिनेश सैनी',
    phone: '9760090123',
    city: 'Modinagar',
    cityHi: 'मोदीनगर',
    stateCode: '09',
  },
  {
    name: 'Kailash Tyagi',
    nameHi: 'कैलाश त्यागी',
    phone: '9917101234',
    city: 'Muradnagar',
    cityHi: 'मुरादनगर',
    stateCode: '09',
  },
];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'mongo']);

/** True when every host in the connection string is this machine or the dev compose service. */
function isLocalDatabase(uri: string): boolean {
  const match = /^mongodb:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri);
  if (!match?.[1]) return false;
  return match[1].split(',').every((host) => {
    const name = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0];
    return LOCAL_HOSTS.has((name ?? '').toLowerCase());
  });
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { 'force-demo': { type: 'boolean', default: false } } });

  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed demo data into a production environment.');
    process.exitCode = 1;
    return;
  }
  if (!isLocalDatabase(process.env.MONGODB_URI ?? '') && !values['force-demo']) {
    console.error(
      'Refusing to seed demo data into a database that is not local. Pass --force-demo if this really is a scratch database.',
    );
    process.exitCode = 1;
    return;
  }

  await connectDb();
  try {
    if (await User.exists({ phone: '9000000001' })) {
      console.log('Demo data is already there (admin 9000000001). Nothing to do.');
      return;
    }

    const today = todayKey(TZ);
    const start = addDays(today, -DAYS);

    const org = await Organization.create({
      name: 'Shree Ganesh Fly Ash Bricks',
      nameHi: 'श्री गणेश फ्लाई ऐश ब्रिक्स',
      address: 'Plot 14, UPSIDC Industrial Area, Bulandshahr Road',
      addressHi: 'प्लॉट 14, यूपीएसआईडीसी औद्योगिक क्षेत्र, बुलंदशहर रोड',
      city: 'Ghaziabad',
      pincode: '201009',
      stateCode: '09',
      phone: '9000000001',
      gstin: '09ABCDE1234F1ZY',
      gstRateBps: 500,
      hsnCode: '6815',
      invoicePrefix: 'SGB',
      bank: {
        accountName: 'Shree Ganesh Fly Ash Bricks',
        accountNumber: '50200012345678',
        ifsc: 'HDFC0001234',
        bankName: 'HDFC Bank, Bagru',
      },
      upiId: 'shreeganeshbricks@okhdfcbank',
      invoiceTerms: 'Goods once sold will not be taken back. Payment due within 30 days.',
    });
    const orgId = org._id.toString();

    const admin = await createUser(
      orgId,
      'Vikram Singh',
      'विक्रम सिंह',
      '9000000001',
      'admin',
      NO_ACCESS,
      'male',
      {
        jobTitle: 'Owner',
        email: 'owner@example.com',
      },
    );
    const supervisor = await createUser(
      orgId,
      'Rajesh Sharma',
      'राजेश शर्मा',
      '9000000002',
      'employee',
      { ...NO_ACCESS, rawMaterials: 'write', production: 'write' },
      'male',
      { jobTitle: 'Plant supervisor' },
    );
    const clerk = await createUser(
      orgId,
      'Pooja Saini',
      'पूजा सैनी',
      '9000000003',
      'employee',
      { ...NO_ACCESS, sales: 'write', production: 'read' },
      'female',
      { jobTitle: 'Sales & accounts' },
    );

    console.log('→ raw materials');
    const materialIds = new Map<string, string>();
    for (const material of MATERIALS) {
      const input = CreateMaterialSchema.parse({
        name: material.name,
        nameHi: material.nameHi,
        kind: material.kind,
        unit: material.unit,
        lowThresholdMilli: material.low,
        capacityMilli: material.capacity,
        openingMilli: material.opening,
        isActive: 'on',
      });
      materialIds.set(material.name, await createMaterial(supervisor, input, TZ, start));
    }

    console.log('→ brick type');
    // Per 1,000 bricks of ~2.5 kg: 60% fly ash, 30% stone dust, 10% cement (5 bags).
    const productId = await createProduct(
      admin,
      CreateProductSchema.parse({
        name: 'Fly ash brick',
        nameHi: 'फ्लाई ऐश ईंट',
        size: '230 × 110 × 75 mm',
        defaultRatePaise: '6.50',
        recipeBatchSize: '1000',
        recipe: [
          { materialId: materialIds.get('Fly ash'), qtyMilli: '1.5' },
          { materialId: materialIds.get('Stone dust'), qtyMilli: '0.75' },
          { materialId: materialIds.get('Cement (OPC 43)'), qtyMilli: '5' },
        ],
        lowStockThreshold: '5000',
        isActive: 'on',
      }),
    );

    console.log('→ customers');
    const customerIds: string[] = [];
    for (const customer of CUSTOMERS) {
      const created = await createCustomer(
        clerk,
        CreateCustomerSchema.parse({
          name: customer.name,
          nameHi: customer.nameHi,
          phones: [customer.phone],
          city: customer.city,
          cityHi: customer.cityHi,
          gstin: customer.gstin ?? '',
          stateCode: customer.stateCode,
        }),
      );
      customerIds.push(created._id.toString());
    }

    console.log(`→ ${DAYS} days of purchases, production, sales and payments`);
    const openSales: string[] = [];
    let salesCount = 0;

    for (let offset = DAYS; offset >= 0; offset -= 1) {
      const day = addDays(today, -offset);

      // A truck arrives before a material drops to its low mark, as in a
      // well-run yard. Cement is left to run low in the last few days, so the
      // demo shows one low-stock alert without stopping production.
      for (const [name, restock] of Object.entries(RESTOCK)) {
        if (name.startsWith('Cement') && offset < 4) continue;
        const material = await RawMaterial.findById(materialIds.get(name)).lean();
        const dailyUse = name === 'Fly ash' ? 6_000 : name === 'Stone dust' ? 3_000 : 20_000;
        if (material && material.quantityMilli < material.lowThresholdMilli + dailyUse * 2) {
          await recordPurchase(
            supervisor,
            PurchaseSchema.parse({
              materialId: materialIds.get(name),
              qtyMilli: String(restock.qty),
              costPaise: String(restock.qty * restock.rate),
              supplier: restock.supplier,
              date: day,
              note: '',
            }),
            TZ,
          );
        }
      }

      // Sundays the press is off.
      const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
      if (weekday !== 0) {
        const made = between(3_200, 4_400);
        const broken = Math.round(made * (0.015 + random() * 0.03));
        try {
          await logProduction(
            supervisor,
            LogProductionSchema.parse({
              productId,
              date: day,
              goodQty: String(made - broken),
              defectiveQty: String(broken),
              note: '',
            }),
            TZ,
            today,
          );
        } catch {
          // Material ran out: no production that day, exactly as in a real yard.
        }
      }

      // Up to two loads leave the yard on a working day.
      const loads = weekday === 0 ? 0 : between(0, 2);
      for (let load = 0; load < loads; load += 1) {
        const customerId = customerIds[between(0, customerIds.length - 1)] ?? customerIds[0];
        const bricks = between(2, 5) * 500;
        const paysNow = random();
        const totalGuess = Math.round(bricks * 6.5 * 1.05);
        const payment =
          paysNow > 0.55 ? totalGuess : paysNow > 0.3 ? Math.round(totalGuess * 0.5) : 0;
        try {
          const sale = await createSale(
            clerk,
            CreateSaleSchema.parse({
              customerMode: 'existing',
              customerId,
              date: day,
              lines: [{ productId, qty: String(bricks), rate: '6.50' }],
              delivery: random() > 0.5 ? String(between(3, 8) * 100) : '',
              discount: '',
              vehicleNo: `UP14 AT ${between(1000, 9999)}`,
              deliveryAddress: '',
              note: '',
              paymentAmount: payment > 0 ? String(Math.min(payment, bricks * 6)) : '',
              paymentMode: random() > 0.5 ? 'upi' : 'cash',
            }),
            TZ,
          );
          salesCount += 1;
          openSales.push(sale.id);
        } catch {
          // Not enough bricks in the yard for this load today: skip it.
        }
      }

      // Older bills get paid off over time, the way contractors actually pay.
      if (offset % 4 === 0) {
        for (const saleId of openSales.splice(0, 3)) {
          if (random() < 0.35) continue;
          try {
            const sale = await Sale.findById(saleId).select('duePaise').lean();
            if (!sale || sale.duePaise <= 0) continue;
            await addPayment(
              clerk,
              AddPaymentSchema.parse({
                saleId,
                amount: (sale.duePaise / 100).toFixed(2),
                mode: 'bank',
                date: day,
                note: '',
              }),
              TZ,
            );
          } catch {
            // Already settled.
          }
        }
      }
    }

    console.log('→ staff, attendance and wages');
    // Most of the yard's people never sign in: they exist for attendance and pay.
    const WORKERS = [
      {
        name: 'Ramesh Pal',
        role: 'moulder',
        gender: 'male',
        wageType: 'per_thousand_bricks',
        rate: '450',
      },
      {
        name: 'Suresh Kumar',
        role: 'moulder',
        gender: 'male',
        wageType: 'per_thousand_bricks',
        rate: '450',
      },
      { name: 'Sunita Devi', role: 'labour', gender: 'female', wageType: 'daily', rate: '400' },
      { name: 'Geeta Devi', role: 'labour', gender: 'female', wageType: 'daily', rate: '400' },
      {
        name: 'Mohan Lal',
        role: 'machine_operator',
        gender: 'male',
        wageType: 'daily',
        rate: '650',
      },
      { name: 'Raju Yadav', role: 'loader', gender: 'male', wageType: 'daily', rate: '450' },
      { name: 'Salim Khan', role: 'driver', gender: 'male', wageType: 'monthly', rate: '18000' },
      {
        name: 'Anil Sharma',
        role: 'supervisor',
        gender: 'male',
        wageType: 'monthly',
        rate: '25000',
      },
    ] as const;
    const workerIds: { id: string; wageType: string }[] = [];
    for (const worker of WORKERS) {
      const id = await createStaff(
        admin,
        CreateStaffSchema.parse({
          name: worker.name,
          nameHi: '',
          role: worker.role,
          gender: worker.gender,
          title: '',
          phone: '',
          wageType: worker.wageType,
          wageRatePaise: worker.rate,
          overtimeRatePaise: worker.wageType === 'daily' ? '60' : '',
          joinedOn: addDays(today, -DAYS - 60),
          leftOn: '',
          isActive: 'on',
          userId: '',
          address: '',
          notes: '',
        }),
        TZ,
      );
      workerIds.push({ id, wageType: worker.wageType });
    }

    for (let offset = DAYS; offset >= 0; offset -= 1) {
      const day = addDays(today, -offset);
      const sunday = new Date(`${day}T12:00:00Z`).getUTCDay() === 0;
      const entries = workerIds.map(({ id, wageType }) => {
        const roll = random();
        const status = sunday
          ? 'holiday'
          : roll < 0.08
            ? 'absent'
            : roll < 0.13
              ? 'half_day'
              : roll < 0.16
                ? 'leave'
                : 'present';
        const working = status === 'present' || status === 'half_day';
        return {
          staffId: id,
          status,
          overtimeHours: working && wageType === 'daily' && random() > 0.8 ? '2' : '0',
          bricks: working && wageType === 'per_thousand_bricks' ? String(between(1400, 2000)) : '0',
        };
      });
      await markAttendance(admin, AttendanceSheetSchema.parse({ date: day, entries }), TZ);

      // Daily-wage and piece-rate people are paid every Saturday; one advance mid-month.
      const saturday = new Date(`${day}T12:00:00Z`).getUTCDay() === 6;
      for (const { id, wageType } of workerIds) {
        if (saturday && wageType !== 'monthly') {
          await recordStaffPayment(
            admin,
            StaffPaymentSchema.parse({
              staffId: id,
              type: 'wage',
              amount: String(wageType === 'daily' ? between(22, 30) * 100 : between(40, 52) * 100),
              mode: random() > 0.5 ? 'cash' : 'upi',
              date: day,
              periodFrom: addDays(day, -6),
              periodTo: day,
              note: '',
            }),
            TZ,
          );
        }
      }
      if (offset === 15) {
        const borrower = workerIds[2];
        if (borrower) {
          await recordStaffPayment(
            admin,
            StaffPaymentSchema.parse({
              staffId: borrower.id,
              type: 'advance',
              amount: '2000',
              mode: 'cash',
              date: day,
              periodFrom: '',
              periodTo: '',
              note: 'Family function',
            }),
            TZ,
          );
        }
      }
    }
    for (const { id, wageType } of workerIds) {
      if (wageType !== 'monthly') continue;
      await recordStaffPayment(
        admin,
        StaffPaymentSchema.parse({
          staffId: id,
          type: 'wage',
          amount: wageType === 'monthly' ? '15000' : '0',
          mode: 'bank',
          date: addDays(today, -DAYS + 1),
          periodFrom: '',
          periodTo: '',
          note: 'Last month salary',
        }),
        TZ,
      );
    }

    // Weeks of alerts would have been read by now; keep only the newest few unread.
    const recent = await Notification.find({ orgId: org._id })
      .sort({ _id: -1 })
      .limit(4)
      .select('_id')
      .lean();
    await Notification.updateMany(
      { orgId: org._id, _id: { $nin: recent.map((notification) => notification._id) } },
      { $set: { readAt: new Date() } },
    );

    console.log(`\nSeeded "${org.name}" with ${salesCount} sales over ${DAYS} days.`);
    console.log('Sign in with (password for all three):', DEMO_PASSWORD);
    console.log('  9000000001  Vikram Singh   admin');
    console.log('  9000000002  Rajesh Sharma  supervisor (raw materials + production)');
    console.log('  9000000003  Pooja Saini    sales & accounts');
  } finally {
    await disconnectDb();
  }
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
