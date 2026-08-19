export const REALTIME_NAMESPACE = 'caspex';

export type RealtimeChannelType = 'vehicle' | 'order' | 'device';

export type RealtimeSubscription = {
  type: RealtimeChannelType;
  id: string;
};

export type RealtimeSubscriptionResult = {
  ok: boolean;
  error?: string;
};

export type RealtimeTelemetryEvent = {
  deviceId: string;
  vehicleId: string | null;
  orderId: string | null;
  temperature?: number | null;
  humidity?: number | null;
  battery?: number | null;
  speedKmh?: number | null;
  lat: number;
  lng: number;
  eventTime: string;
  createdAt: string;
};

export type RealtimeStatusEvent = {
  deviceId: string;
  vehicleId: string | null;
  status?: 'online' | 'offline' | 'booting';
  battery?: number | null;
  eventTime?: string;
};

export type RealtimeAlertEvent = {
  id: string;
  deviceId: string;
  vehicleId: string | null;
  orderId: string | null;
  metric: string;
  value: number;
  severity: string;
  message: string;
  createdAt: string;
};

export function realtimeRoom(channel: RealtimeChannelType, id: string): string {
  return `live.${channel}.${id}`;
}
