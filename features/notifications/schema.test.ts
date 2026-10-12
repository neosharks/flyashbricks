import { describe, expect, it } from 'vitest';
import { PreferencesSchema } from './schema';

describe('PreferencesSchema', () => {
  it('turns checked boxes into channel preferences and absent ones into off', () => {
    const prefs = PreferencesSchema.parse({ pref_stock_email: 'on', pref_payments_sms: 'on' });
    expect(prefs.stock).toEqual({ email: true, sms: false, whatsapp: false });
    expect(prefs.payments.sms).toBe(true);
    expect(prefs.team).toEqual({ email: false, sms: false, whatsapp: false });
  });

  it('rejects unknown categories or channels', () => {
    expect(PreferencesSchema.safeParse({ pref_stock_pigeon: 'on' }).success).toBe(false);
    expect(PreferencesSchema.safeParse({ pref_weather_email: 'on' }).success).toBe(false);
  });
});
