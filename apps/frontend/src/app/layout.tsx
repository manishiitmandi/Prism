import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PRism — AI Pull Request Risk Analyzer',
  description: 'Analyze GitHub Pull Requests with AI-powered risk analysis, dependency graphs, and evidence-backed insights.',
  keywords: ['GitHub', 'Pull Request', 'Code Review', 'Risk Analysis', 'AI'],
  openGraph: {
    title: 'PRism — AI Pull Request Risk Analyzer',
    description: 'Evidence-backed AI risk analysis for GitHub Pull Requests',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
