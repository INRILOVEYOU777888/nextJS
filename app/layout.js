import './globals.scss';

export const metadata = {
  title: 'Next App',
  description: 'Next.js + PostgreSQL',
};

export default function RootLayout({ children }) {
  return (
    <html lang='ru'>
      <body>{children}</body>
    </html>
  );
}
