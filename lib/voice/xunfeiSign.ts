import { createHmac } from 'crypto';

export function generateTtsSignedUrl(
  appId: string,
  apiKey: string,
  apiSecret: string
): string {
  const date = new Date().toUTCString();
  const host = 'tts-api.xfyun.cn';
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
  const signatureSha = createHmac('sha256', apiSecret)
    .update(signatureOrigin)
    .digest('base64');
  const authorization = Buffer.from(
    `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`
  ).toString('base64');
  return (
    `wss://${host}/v2/tts` +
    `?authorization=${encodeURIComponent(authorization)}` +
    `&date=${encodeURIComponent(date)}` +
    `&host=${host}`
  );
}

export function generateAsrSignedUrl(
  apiKey: string,
  apiSecret: string
): string {
  const date = new Date().toUTCString();
  const host = 'iat-api.xfyun.cn';
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
  const signatureSha = createHmac('sha256', apiSecret)
    .update(signatureOrigin)
    .digest('base64');
  const authorization = Buffer.from(
    `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`
  ).toString('base64');
  return (
    `wss://${host}/v2/iat` +
    `?authorization=${encodeURIComponent(authorization)}` +
    `&date=${encodeURIComponent(date)}` +
    `&host=${host}`
  );
}
