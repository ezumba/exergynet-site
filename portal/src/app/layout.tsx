import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import Providers from './providers';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ExergyNet Developer Portal',
  description: 'Vanguard Engine · Base Sepolia · Developer API Portal',
  robots: { index: false },
};

const themeScript = `(function(){try{var t=localStorage.getItem('en_theme');if(t==='light'||t==='color'){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.removeAttribute('data-theme');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
