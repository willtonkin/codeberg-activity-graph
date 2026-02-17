import './globals.css';

export const metadata = {
  title: 'Codeberg Activity Graph',
  description: 'Generate GitHub-style SVG activity graphs for Codeberg users.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
