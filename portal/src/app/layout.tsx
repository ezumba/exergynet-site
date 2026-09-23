import type { Metadata } from 'next';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'ExergyNet Developer Portal',
  description: 'Vanguard Engine · Base Mainnet · Developer API Portal',
  robots: { index: false },
};

const themeScript = `(function(){try{var t=localStorage.getItem('en_theme');if(t==='light'||t==='color'){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.removeAttribute('data-theme');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
