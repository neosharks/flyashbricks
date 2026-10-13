export type DevicePinRow = {
  id: string;
  /** Empty when the browser could not be recognised. */
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  /** The device this page is open on. */
  current: boolean;
};
