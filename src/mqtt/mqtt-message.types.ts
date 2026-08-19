export type TelemetryPayload = {
  temperature?: number;
  humidity?: number;
  battery?: number;
  speed?: number;
  lat: number;
  lng: number;
  eventTime?: Date;
  secret?: string;
  raw: Record<string, unknown>;
};

export type StatusPayload = {
  status?: 'online' | 'offline' | 'booting';
  battery?: number;
  eventTime?: Date;
  raw: Record<string, unknown>;
};

export type ParsedMqttMessage = {
  deviceId: string;
  kind: 'telemetry' | 'status';
  topic: string;
  payload: string;
};
