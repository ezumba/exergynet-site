// Augment next-auth types to include portal-specific session fields
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    portalToken?:   string;
    isNewUser?:     boolean;
    apiKey?:        string | null;
    apiKeyPreview?: string | null;
    apiKeyNote?:    string | null;
    oauthError?:    string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    portalToken?:   string;
    isNewUser?:     boolean;
    apiKey?:        string | null;
    apiKeyPreview?: string | null;
    apiKeyNote?:    string | null;
    oauthError?:    string;
  }
}
