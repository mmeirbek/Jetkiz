import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { connect, MqttClient } from 'mqtt';
import { CamerasService } from '../../cameras/cameras.service';
import { TelemetryConsumerService } from './telemetry-consumer.service';

@Injectable()
export class MqttClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttClientService.name);
  private readonly prefix = process.env.MQTT_TOPIC_PREFIX ?? 'caspex';
  private client: MqttClient | null = null;

  constructor(
    private readonly telemetryConsumer: TelemetryConsumerService,
    private readonly camerasService: CamerasService,
  ) {}

  onModuleInit() {
    const url = process.env.MQTT_URL;
    if (!url) {
      this.logger.warn('MQTT_URL is not configured, MQTT client disabled');
      return;
    }

    this.client = connect(url, {
      protocolVersion: 5,
      reconnectPeriod: 5000,
      connectTimeout: 10_000,
      clean: true,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker at ${url}`);
      this.client?.subscribe(
        [
          `${this.prefix}/+/telemetry`,
          `${this.prefix}/+/status`,
          `${this.prefix}/+/camera`,
        ],
        { qos: 1 },
      );
    });

    this.client.on('message', (topic, payload) =>
      this.onMessage(topic, payload),
    );

    this.client.on('error', (err) =>
      this.logger.error(`MQTT error: ${err.message}`),
    );
    this.client.on('close', () => this.logger.warn('MQTT connection closed'));
    this.client.on('reconnect', () => this.logger.warn('MQTT reconnecting...'));
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.end();
    }
  }

  publish(
    topic: string,
    payload: string | Buffer,
    qos: 0 | 1 | 2 = 1,
  ): boolean {
    if (!this.client || !this.client.connected) {
      return false;
    }
    this.client.publish(topic, payload, { qos });
    return true;
  }

  private onMessage(topic: string, payload: Buffer) {
    const parts = topic.split('/');
    if (parts.length !== 3 || parts[0] !== this.prefix) {
      return;
    }

    const [deviceId, kind] = [parts[1], parts[2]];
    const text = payload.toString('utf8');

    if (kind === 'telemetry') {
      void this.telemetryConsumer.handleTelemetry(deviceId, text);
    } else if (kind === 'status') {
      void this.telemetryConsumer.handleStatus(deviceId, text);
    } else if (kind === 'camera') {
      void this.camerasService.ingest(deviceId, text);
    }
  }
}
