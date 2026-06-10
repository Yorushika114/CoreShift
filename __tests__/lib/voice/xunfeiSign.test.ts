import { generateTtsSignedUrl, generateAsrSignedUrl } from '@/lib/voice/xunfeiSign';

describe('generateTtsSignedUrl', () => {
  it('returns wss URL with required query params', () => {
    const url = generateTtsSignedUrl('appId', 'apiKey', 'apiSecret');
    expect(url).toMatch(/^wss:\/\/tts-api\.xfyun\.cn\/v2\/tts\?/);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.has('authorization')).toBe(true);
    expect(params.has('date')).toBe(true);
    expect(params.has('host')).toBe(true);
  });

  it('authorization field decodes to correct format', () => {
    const url = generateTtsSignedUrl('appId', 'myKey', 'mySecret');
    const params = new URLSearchParams(url.split('?')[1]);
    const auth = Buffer.from(params.get('authorization')!, 'base64').toString();
    expect(auth).toContain('api_key="myKey"');
    expect(auth).toContain('algorithm="hmac-sha256"');
    expect(auth).toContain('signature=');
  });
});

describe('generateAsrSignedUrl', () => {
  it('returns wss IAT URL with required query params', () => {
    const url = generateAsrSignedUrl('apiKey', 'apiSecret');
    expect(url).toMatch(/^wss:\/\/iat-api\.xfyun\.cn\/v2\/iat\?/);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.has('authorization')).toBe(true);
    expect(params.has('date')).toBe(true);
    expect(params.has('host')).toBe(true);
  });

  it('authorization decodes to correct format', () => {
    const url = generateAsrSignedUrl('myKey', 'mySecret');
    const params = new URLSearchParams(url.split('?')[1]);
    const auth = Buffer.from(params.get('authorization')!, 'base64').toString();
    expect(auth).toContain('api_key="myKey"');
    expect(auth).toContain('algorithm="hmac-sha256"');
    expect(auth).toContain('headers="host date request-line"');
  });
});
