import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Milenium Motos · Inventario de Repuestos',
    short_name: 'Milenium Motos',
    description: 'Inventario de repuestos por grupo y SKU: stock, movimientos y alertas de Milenium Motos.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f6f7f9',
    theme_color: '#1b2230',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
