import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl() {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',
  });
}

export async function getStoredSession() {
  return prisma.session.findFirst({ orderBy: { createdAt: 'desc' } });
}

export async function saveTokens(accessToken: string, refreshToken: string, expiresAt: Date) {
  await prisma.session.deleteMany();
  return prisma.session.create({ data: { accessToken, refreshToken, expiresAt } });
}

export async function getAuthenticatedClient() {
  const session = await getStoredSession();
  if (!session) return null;

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expiry_date: session.expiresAt.getTime(),
  });

  client.on('tokens', async (tokens) => {
    await prisma.session.updateMany({
      data: {
        accessToken: tokens.access_token ?? session.accessToken,
        ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : session.expiresAt,
      },
    });
  });

  return client;
}
