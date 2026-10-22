/**
 * Demo data: one company with three months of realistic activity, written
 * through the same service functions the app uses, so every balance, ledger
 * row, invoice number and audit entry is exactly what real use would produce.
 *
 * Synthetic only. Refuses to run with NODE_ENV=production, or against any
 * database that is not on this machine or the local Docker network, unless
 * `--force-demo` is passed — the demo sign-ins have a published password
 * (features/auth/demo-accounts.ts), so this is for a demo server only. The
 * demo company is its own organisation; nothing of another one is touched.
 *
 * Usage: pnpm db:seed [--days 90] [--force-demo]
 */
import { parseArgs } from 'node:util';
import { connectDb, disconnectDb } from '../lib/db';
import { hashPassword } from '../lib/password';
import { addDays, DEFAULT_TIMEZONE, todayKey } from '../lib/dates';
import type { SessionUser } from '../lib/permissions';
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
import type { MaterialKind, Unit } from '../models/constants';
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  demoAccount,
  type DemoAccount,
} from '../features/auth/demo-accounts';

const DEFAULT_DAYS = 90;
const TZ = DEFAULT_TIMEZONE;

/** Deterministic pseudo-random numbers, so every seed produces the same month. */
let state = 20_261_012;
function random(): number {
  state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
  return state / 2 ** 31;
}
const between = (min: number, max: number) => Math.round(min + random() * (max - min));

async function createUser(orgId: string, account: DemoAccount): Promise<SessionUser> {
  const { name, nameHi, phone, role, permissions, gender } = account;
  const user = await User.create({
    orgId,
    name,
    nameHi,
    phone,
    email: account.email ?? null,
    jobTitle: account.jobTitle,
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
const RESTOCK: Record<
  string,
  { qty: number; rate: number; supplier: string; dailyUseMilli: number }
> = {
  'Fly ash': { qty: 40, rate: 650, supplier: 'NTPC Dadri', dailyUseMilli: 15_000 },
  'Stone dust': { qty: 20, rate: 900, supplier: 'Balaji Crushers', dailyUseMilli: 7_500 },
  'Cement (OPC 43)': {
    qty: 200,
    rate: 345,
    supplier: 'Shree Cement Dealer',
    dailyUseMilli: 55_000,
  },
};

/** Mostly local (Uttar Pradesh) buyers, and a few across the border for IGST bills. */
const CUSTOMERS: {
  name: string;
  nameHi: string;
  phone: string;
  city: string;
  cityHi: string;
  stateCode: '09' | '08' | '06' | '07';
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
  {
    name: 'Bansal Homes',
    nameHi: 'बंसल होम्स',
    phone: '9818112345',
    city: 'Ghaziabad',
    cityHi: 'ग़ाज़ियाबाद',
    stateCode: '09',
    gstin: '09BANSL1234H1ZI',
  },
  {
    name: 'Naresh Chauhan',
    nameHi: 'नरेश चौहान',
    phone: '9456123456',
    city: 'Sikandrabad',
    cityHi: 'सिकंदराबाद',
    stateCode: '09',
  },
  {
    name: 'Tyagi Buildcon',
    nameHi: 'त्यागी बिल्डकॉन',
    phone: '9837134567',
    city: 'Meerut',
    cityHi: 'मेरठ',
    stateCode: '09',
    gstin: '09TYAGI5678B1ZG',
  },
  {
    name: 'Rakesh Gurjar',
    nameHi: 'राकेश गुर्जर',
    phone: '9759145678',
    city: 'Dankaur',
    cityHi: 'दनकौर',
    stateCode: '09',
  },
  {
    name: 'Om Sai Constructions',
    nameHi: 'ओम साई कंस्ट्रक्शंस',
    phone: '9873156789',
    city: 'Noida',
    cityHi: 'नोएडा',
    stateCode: '09',
  },
  {
    name: 'Sanjay Bhati',
    nameHi: 'संजय भाटी',
    phone: '9910167890',
    city: 'Greater Noida',
    cityHi: 'ग्रेटर नोएडा',
    stateCode: '09',
  },
  {
    name: 'Jindal Realty (Faridabad)',
    nameHi: 'जिंदल रियल्टी (फ़रीदाबाद)',
    phone: '9811178901',
    city: 'Faridabad',
    cityHi: 'फ़रीदाबाद',
    stateCode: '06',
    gstin: '06JINDL4321R1Z7',
  },
  {
    name: 'Ashok Kumar Mistri',
    nameHi: 'अशोक कुमार मिस्त्री',
    phone: '9568189012',
    city: 'Hapur',
    cityHi: 'हापुड़',
    stateCode: '09',
  },
  {
    name: 'Gram Panchayat Bhojpur',
    nameHi: 'ग्राम पंचायत भोजपुर',
    phone: '9412190123',
    city: 'Bhojpur',
    cityHi: 'भोजपुर',
    stateCode: '09',
  },
  {
    name: 'Mittal Traders',
    nameHi: 'मित्तल ट्रेडर्स',
    phone: '9837201234',
    city: 'Bulandshahr',
    cityHi: 'बुलंदशहर',
    stateCode: '09',
    gstin: '09MITTL8765T1Z3',
  },
  {
    name: 'Vinod Nagar',
    nameHi: 'विनोद नागर',
    phone: '9761212345',
    city: 'Dadri',
    cityHi: 'दादरी',
    stateCode: '09',
  },
  {
    name: 'Saraswati Shiksha Trust',
    nameHi: 'सरस्वती शिक्षा ट्रस्ट',
    phone: '9997223456',
    city: 'Modinagar',
    cityHi: 'मोदीनगर',
    stateCode: '09',
  },
  {
    name: 'Imran Qureshi',
    nameHi: 'इमरान क़ुरैशी',
    phone: '9719234567',
    city: 'Muradnagar',
    cityHi: 'मुरादनगर',
    stateCode: '09',
  },
  {
    name: 'Delhi Metro Housing (Delhi)',
    nameHi: 'दिल्ली मेट्रो हाउसिंग (दिल्ली)',
    phone: '9899245678',
    city: 'New Delhi',
    cityHi: 'नई दिल्ली',
    stateCode: '07',
    gstin: '07DMHPL2468D1Z1',
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

/** The yard's people. Most never sign in: they exist for attendance and pay. */
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
  {
    name: 'Bablu Prajapati',
    role: 'moulder',
    gender: 'male',
    wageType: 'per_thousand_bricks',
    rate: '450',
  },
  {
    name: 'Lakhan Singh',
    role: 'moulder',
    gender: 'male',
    wageType: 'per_thousand_bricks',
    rate: '475',
  },
  { name: 'Sunita Devi', role: 'labour', gender: 'female', wageType: 'daily', rate: '400' },
  { name: 'Geeta Devi', role: 'labour', gender: 'female', wageType: 'daily', rate: '400' },
  { name: 'Kamla Devi', role: 'labour', gender: 'female', wageType: 'daily', rate: '400' },
  { name: 'Pappu Kumar', role: 'labour', gender: 'male', wageType: 'daily', rate: '420' },
  { name: 'Mohan Lal', role: 'machine_operator', gender: 'male', wageType: 'daily', rate: '650' },
  {
    name: 'Devendra Rana',
    role: 'machine_operator',
    gender: 'male',
    wageType: 'daily',
    rate: '650',
  },
  { name: 'Raju Yadav', role: 'loader', gender: 'male', wageType: 'daily', rate: '450' },
  { name: 'Shankar Lal', role: 'loader', gender: 'male', wageType: 'daily', rate: '450' },
  { name: 'Salim Khan', role: 'driver', gender: 'male', wageType: 'monthly', rate: '18000' },
  { name: 'Gurpreet Singh', role: 'driver', gender: 'male', wageType: 'monthly', rate: '18000' },
  { name: 'Anil Sharma', role: 'supervisor', gender: 'male', wageType: 'monthly', rate: '25000' },
  { name: 'Neha Verma', role: 'office', gender: 'female', wageType: 'monthly', rate: '16000' },
] as const;

const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'force-demo': { type: 'boolean', default: false },
      days: { type: 'string', default: String(DEFAULT_DAYS) },
    },
  });
  const days = Number(values.days);
  if (!Number.isInteger(days) || days < 7 || days > 366) {
    console.error('--days must be a whole number from 7 to 366.');
    process.exitCode = 1;
    return;
  }

  if (process.env.NODE_ENV === 'production' && !values['force-demo']) {
    console.error(
      'Refusing to seed demo data into a production environment. Pass --force-demo if this is a demo server.',
    );
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
    const taken = await User.find({ phone: { $in: DEMO_ACCOUNTS.map(({ phone }) => phone) } })
      .select('phone')
      .lean();
    if (taken.length > 0) {
      console.log(
        `Demo data is already there (${taken.map(({ phone }) => phone).join(', ')}). Nothing to do.`,
      );
      return;
    }

    const today = todayKey(TZ);
    const start = addDays(today, -days);
    const owner = demoAccount('owner');

    const org = await Organization.create({
      name: 'Shree Ganesh Fly Ash Bricks',
      nameHi: 'श्री गणेश फ्लाई ऐश ब्रिक्स',
      address: 'Plot 14, UPSIDC Industrial Area, Bulandshahr Road',
      addressHi: 'प्लॉट 14, यूपीएसआईडीसी औद्योगिक क्षेत्र, बुलंदशहर रोड',
      city: 'Ghaziabad',
      pincode: '201009',
      stateCode: '09',
      phone: owner.phone,
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

    const admin = await createUser(orgId, owner);
    const supervisor = await createUser(orgId, demoAccount('supervisor'));
    const clerk = await createUser(orgId, demoAccount('sales'));
    const munshi = await createUser(orgId, demoAccount('munshi'));
    // The partner only looks; nothing is written in their name.
    await createUser(orgId, demoAccount('viewer'));

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

    console.log('→ brick types');
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
    // The stronger brick for load-bearing walls takes more cement and sells for more.
    const strongProductId = await createProduct(
      admin,
      CreateProductSchema.parse({
        name: 'Fly ash brick (Class 10)',
        nameHi: 'फ्लाई ऐश ईंट (क्लास 10)',
        size: '230 × 110 × 75 mm',
        defaultRatePaise: '7.50',
        recipeBatchSize: '1000',
        recipe: [
          { materialId: materialIds.get('Fly ash'), qtyMilli: '1.4' },
          { materialId: materialIds.get('Stone dust'), qtyMilli: '0.8' },
          { materialId: materialIds.get('Cement (OPC 43)'), qtyMilli: '7' },
        ],
        lowStockThreshold: '2000',
        isActive: 'on',
      }),
    );
    const products = [
      { id: productId, rate: 6.5, share: 0.88 },
      { id: strongProductId, rate: 7.5, share: 1 },
    ];

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

    console.log(`→ ${days} days of purchases, production, sales and payments`);
    const openSales: string[] = [];
    let salesCount = 0;

    for (let offset = days; offset >= 0; offset -= 1) {
      const day = addDays(today, -offset);

      // A truck arrives before a material drops to its low mark, as in a
      // well-run yard. Cement is left to run low in the last few days, so the
      // demo shows one low-stock alert without stopping production.
      for (const [name, restock] of Object.entries(RESTOCK)) {
        if (name.startsWith('Cement') && offset < 4) continue;
        const material = await RawMaterial.findById(materialIds.get(name)).lean();
        if (
          material &&
          material.quantityMilli < material.lowThresholdMilli + restock.dailyUseMilli * 2
        ) {
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

      // Sundays the press is off. Class 10 runs on alternate days.
      const weekday = weekdayOf(day);
      if (weekday !== 0) {
        const runs = [{ id: productId, made: between(6_000, 8_000) }];
        if (weekday % 2 === 1) runs.push({ id: strongProductId, made: between(1_500, 2_500) });
        for (const run of runs) {
          const broken = Math.round(run.made * (0.015 + random() * 0.03));
          try {
            await logProduction(
              supervisor,
              LogProductionSchema.parse({
                productId: run.id,
                date: day,
                goodQty: String(run.made - broken),
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
      }

      // Two to five loads leave the yard on a working day.
      const loads = weekday === 0 ? 0 : between(2, 5);
      for (let load = 0; load < loads; load += 1) {
        const customerId = customerIds[between(0, customerIds.length - 1)] ?? customerIds[0];
        const pick = random();
        const product = products.find(({ share }) => pick < share) ?? products[0];
        if (!product) continue;
        const bricks = between(3, 8) * 500;
        // Regular buyers haggle a little off the list rate.
        const rate = product.rate - (random() > 0.7 ? 0.25 : 0);
        const paysNow = random();
        const totalGuess = Math.round(bricks * rate * 1.05);
        const payment =
          paysNow > 0.55 ? totalGuess : paysNow > 0.3 ? Math.round(totalGuess * 0.5) : 0;
        try {
          const sale = await createSale(
            clerk,
            CreateSaleSchema.parse({
              customerMode: 'existing',
              customerId,
              date: day,
              lines: [{ productId: product.id, qty: String(bricks), rate: rate.toFixed(2) }],
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

      // Older bills get paid off over time, the way contractors actually pay;
      // some stay due, so the dues screen has a real list.
      if (offset % 3 === 0) {
        for (const saleId of openSales.splice(0, 6)) {
          if (random() < 0.3) continue;
          try {
            const sale = await Sale.findById(saleId).select('duePaise').lean();
            if (!sale || sale.duePaise <= 0) continue;
            await addPayment(
              clerk,
              AddPaymentSchema.parse({
                saleId,
                amount: (sale.duePaise / 100).toFixed(2),
                mode: random() > 0.3 ? 'bank' : 'cheque',
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
    const workerIds: { id: string; wageType: string; rate: number }[] = [];
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
          joinedOn: addDays(today, -days - 60),
          leftOn: '',
          isActive: 'on',
          userId: '',
          address: '',
          notes: '',
        }),
        TZ,
      );
      workerIds.push({ id, wageType: worker.wageType, rate: Number(worker.rate) });
    }

    const ADVANCE_NOTES = ['Family function', 'Medical', 'School fees', 'Going home for harvest'];
    for (let offset = days; offset >= 0; offset -= 1) {
      const day = addDays(today, -offset);
      const weekday = weekdayOf(day);
      const entries = workerIds.map(({ id, wageType }) => {
        const roll = random();
        const status =
          weekday === 0
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
      await markAttendance(munshi, AttendanceSheetSchema.parse({ date: day, entries }), TZ);

      // Daily-wage and piece-rate people are paid every Saturday.
      for (const { id, wageType } of workerIds) {
        if (weekday === 6 && wageType !== 'monthly') {
          await recordStaffPayment(
            munshi,
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

      // Salaries for the month just ended go out on the 1st.
      if (day.endsWith('-01')) {
        for (const { id, wageType, rate } of workerIds) {
          if (wageType !== 'monthly') continue;
          await recordStaffPayment(
            admin,
            StaffPaymentSchema.parse({
              staffId: id,
              type: 'wage',
              amount: String(rate),
              mode: 'bank',
              date: day,
              periodFrom: addDays(day, -30),
              periodTo: addDays(day, -1),
              note: 'Monthly salary',
            }),
            TZ,
          );
        }
      }

      // Now and then someone needs an advance.
      if (weekday !== 0 && random() < 0.06) {
        const borrower = workerIds[between(0, workerIds.length - 1)];
        if (borrower) {
          await recordStaffPayment(
            admin,
            StaffPaymentSchema.parse({
              staffId: borrower.id,
              type: 'advance',
              amount: String(between(5, 30) * 100),
              mode: 'cash',
              date: day,
              periodFrom: '',
              periodTo: '',
              note: ADVANCE_NOTES[between(0, ADVANCE_NOTES.length - 1)] ?? '',
            }),
            TZ,
          );
        }
      }
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

    console.log(`\nSeeded "${org.name}" with ${salesCount} sales over ${days} days.`);
    console.log(`Sign in with (password for all of them): ${DEMO_PASSWORD}`);
    for (const account of DEMO_ACCOUNTS) {
      console.log(`  ${account.phone}  ${account.name.padEnd(14)} ${account.jobTitle}`);
    }
  } finally {
    await disconnectDb();
  }
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
