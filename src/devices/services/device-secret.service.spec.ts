import { DeviceSecretService } from './device-secret.service';

describe('DeviceSecretService', () => {
  let service: DeviceSecretService;

  beforeAll(() => {
    process.env.DEVICE_SECRET_PEPPER = 'test-pepper';
  });

  beforeEach(() => {
    service = new DeviceSecretService();
  });

  it('generates unique secrets', () => {
    const a = service.generateSecret();
    const b = service.generateSecret();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it('hashes and verifies a secret', async () => {
    const secret = service.generateSecret();
    const hash = await service.hashSecret(secret);

    expect(hash).not.toContain(secret);
    await expect(service.verifySecret(secret, hash)).resolves.toBe(true);
  });

  it('rejects a wrong secret', async () => {
    const hash = await service.hashSecret('correct-secret');
    await expect(service.verifySecret('wrong-secret', hash)).resolves.toBe(
      false,
    );
  });
});
