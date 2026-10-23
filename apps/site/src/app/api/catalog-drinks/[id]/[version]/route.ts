/**
 * The same photo under a versioned address (`/api/catalog-drinks/<id>/<updatedAt>`): a changed photo gets a new URL,
 * so neither the hour of public caching nor the image optimizer serves the old one. The version sits in the path
 * because Next's optimizer refuses local sources with a query string unless `images.localPatterns` allows them.
 */
export { GET } from '../route';
export const runtime = 'nodejs';
