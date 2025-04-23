'use client';

import { ThemeProvider } from '@/utils/themeContext';

export default function ThemeProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
