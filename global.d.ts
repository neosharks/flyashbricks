import type { LOCALES } from '@/i18n/config';
import type common from './messages/en/common.json';
import type nav from './messages/en/nav.json';
import type auth from './messages/en/auth.json';
import type errors from './messages/en/errors.json';
import type validation from './messages/en/validation.json';
import type dashboard from './messages/en/dashboard.json';
import type users from './messages/en/users.json';
import type activity from './messages/en/activity.json';
import type rawMaterials from './messages/en/rawMaterials.json';
import type production from './messages/en/production.json';
import type sales from './messages/en/sales.json';
import type customers from './messages/en/customers.json';
import type backup from './messages/en/backup.json';
import type settings from './messages/en/settings.json';
import type notifications from './messages/en/notifications.json';
import type charts from './messages/en/charts.json';
import type staff from './messages/en/staff.json';
import type marketing from './messages/en/marketing.json';

/** English is the reference: a key missing from it is a type error at the call site. */
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof LOCALES)[number];
    Messages: {
      common: typeof common;
      nav: typeof nav;
      auth: typeof auth;
      errors: typeof errors;
      validation: typeof validation;
      dashboard: typeof dashboard;
      users: typeof users;
      activity: typeof activity;
      rawMaterials: typeof rawMaterials;
      production: typeof production;
      sales: typeof sales;
      customers: typeof customers;
      backup: typeof backup;
      settings: typeof settings;
      notifications: typeof notifications;
      charts: typeof charts;
      staff: typeof staff;
      marketing: typeof marketing;
    };
  }
}
