import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Milenium Motos · Inventario de Repuestos',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Milenium Motos',
  },
};

export const viewport: Viewport = {
  themeColor: '#1b2230',
  width: 'device-width',
  initialScale: 1,
};
