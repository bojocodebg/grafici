import './globals.css';

export const metadata = {
  title: 'Графици – Денонощни аптеки „Пулс“',
  description: 'Система за работни графици на служителите',
};

export default function RootLayout({ children }) {
  return (
    <html lang="bg">
      <body>{children}</body>
    </html>
  );
}
