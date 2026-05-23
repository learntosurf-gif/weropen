import './globals.css';

export const metadata = {
  title: 'WeRopen — Is it open right now?',
  description:
    'Real-time business status during ice storms, holidays, and closures in Austin & Central Texas.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
