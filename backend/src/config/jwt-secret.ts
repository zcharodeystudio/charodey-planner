const WEAK_SECRETS = new Set(['', 'change_me', 'secret', 'charodey_jwt_secret']);

export function getJwtSecret(): string {
  const secret = (process.env.JWT_SECRET ?? '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (WEAK_SECRETS.has(secret) || secret.length < 32) {
    throw new Error(
      isProd
        ? 'JWT_SECRET must be set to a strong random value (min 32 chars) in production'
        : 'JWT_SECRET must be a random value of at least 32 characters',
    );
  }

  return secret;
}
