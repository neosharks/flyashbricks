/**
 * The message that carries a backup. Bilingual for the same reason as the
 * stock alerts: the recipient's language preference lives in their browser.
 * It never contains the passphrase — that travels by another channel.
 */
export function backupEmail(input: {
  appName: string;
  requestedBy: string | null;
  records: number;
  scheduled: boolean;
}): { subject: string; text: string; html: string } {
  const who = input.scheduled ? 'the scheduled backup job' : (input.requestedBy ?? 'an admin');
  const whoHi = input.scheduled ? 'निर्धारित बैकअप' : (input.requestedBy ?? 'एडमिन');
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

  return {
    subject: `${input.appName} backup · बैकअप`,
    text: [
      `Attached is an encrypted backup of all your ${input.appName} data (${input.records} records), sent by ${who}.`,
      'Open it with the passphrase that was set for it, using `pnpm backup:decrypt`. Keep this file somewhere safe.',
      '',
      `संलग्न फ़ाइल आपके पूरे डेटा (${input.records} रिकॉर्ड) का एन्क्रिप्टेड बैकअप है, जिसे ${whoHi} ने भेजा है।`,
      'इसे खोलने के लिए वही पासफ़्रेज़ चाहिए जो बैकअप बनाते समय रखा गया था। फ़ाइल सुरक्षित जगह रखें।',
    ].join('\n'),
    html: `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#2a2622;max-width:560px">
<p>Attached is an encrypted backup of all your ${escape(input.appName)} data (<strong>${input.records}</strong> records), sent by ${escape(who)}.</p>
<p>Open it with the passphrase that was set for it. Keep this file somewhere safe.</p>
<p lang="hi">संलग्न फ़ाइल आपके पूरे डेटा (<strong>${input.records}</strong> रिकॉर्ड) का एन्क्रिप्टेड बैकअप है, जिसे ${escape(whoHi)} ने भेजा है।</p>
<p lang="hi">इसे खोलने के लिए वही पासफ़्रेज़ चाहिए जो बैकअप बनाते समय रखा गया था। फ़ाइल सुरक्षित जगह रखें।</p>
</body></html>`,
  };
}
