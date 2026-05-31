import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(visitorId: string) {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar',
    ],
    prompt: 'consent',
    state: visitorId,
  });
}

export async function getStoredSession(visitorId?: string) {
  if (!visitorId) return null;
  return prisma.session.findFirst({
    where: { visitorId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function saveTokens(
  accessToken: string,
  refreshToken: string,
  expiresAt: Date,
  visitorId: string,
  googleSub: string,
  email: string,
) {
  await prisma.session.deleteMany({ where: { visitorId } });
  return prisma.session.create({
    data: { accessToken, refreshToken, expiresAt, visitorId, googleSub, email },
  });
}

export async function getAuthenticatedClient(visitorId?: string) {
  const session = await getStoredSession(visitorId);
  if (!session) return null;

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expiry_date: session.expiresAt.getTime(),
  });

  client.on('tokens', async (tokens) => {
    await prisma.session.updateMany({
      where: { visitorId: session.visitorId },
      data: {
        accessToken: tokens.access_token ?? session.accessToken,
        ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : session.expiresAt,
      },
    });
  });

  return client;
}
