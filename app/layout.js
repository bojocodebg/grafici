import './globals.css';

export const metadata = {
  title: 'Графици – Денонощни аптеки „Пулс“',
  description: 'Система за работни графици на служителите',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0e8f5b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="bg">
      <body>{children}</body>
    </html>
  );
}
