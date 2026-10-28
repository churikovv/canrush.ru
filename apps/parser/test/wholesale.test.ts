import { describe, expect, it } from 'vitest';
import { jsonAfter, napolkeOffer, parseNapolkePage, rscPayload } from '../src/wholesale/napolke.js';
import { identityTitle } from '../src/wholesale/run.js';
import { normalizeIdentity } from '../src/normalize.js';
import { loadProductsConfig } from '../src/config.js';

const product = {
  uuid: 'b7b29179-263d-4a0d-ae43-c71dd703f6e6',
  name: 'Напиток энергетический Burn манго 449 мл., ж/б',
  brand_name: 'Burn',
  seo_name: 'napitok_e_nergeticheskij_burn_mango_449_ml_zh_b-b7b29179-263d-4a0d-ae43-c71dd703f6e6',
  price: 87.5,
  deliveryUnit: { um: 'шт.', mult: 12 },
  offer_with_min_price: {
    supplier_display_name: 'Акварисейл-опт',
    price: { delivery_prepaid: 87.5, pickup_prepaid: 87.5 },
    minOrderCost: 30000,
    deliveryUnit: { mult: 12 },
    pricelist_updated_date: '2026-08-13T16:23:30+03:00',
    taxationSystem: { vatTaxation: false },
  },
  offers: { data: [], count: 3 },
};

/** The page as the site serves it: the RSC payload split over `self.__next_f.push` strings, quotes escaped. */
function page(products: unknown[], total: number): string {
  const payload = `0:["$","x",{"totalProductCount":${total},"token":"$undefined","productsResponse":${JSON.stringify({ result: 0, data: products, order: [] })}}]`;
  const cut = Math.floor(payload.length / 2);
  return [payload.slice(0, cut), payload.slice(cut)].map(part => `<script>self.__next_f.push([1,${JSON.stringify(part)}])</script>`).join('');
}

describe('napolke', () => {
  it('joins the RSC strings and reads values after a key, strings with brackets included', () => {
    const html = page([{ ...product, name: 'Банка [нов] {x}' }], 288);
    const payload = rscPayload(html);
    expect(jsonAfter(payload, 'totalProductCount')).toBe(288);
    expect((jsonAfter(payload, 'productsResponse') as { data: { name: string }[] }).data[0]!.name).toBe('Банка [нов] {x}');
    expect(jsonAfter(payload, 'missing')).toBeUndefined();
  });

  it('turns a product into a wholesale offer with the cheapest supplier and the case', () => {
    const { products, total } = parseNapolkePage(page([product], 287));
    expect(total).toBe(287);
    expect(napolkeOffer(products[0]!)).toEqual({
      source: 'napolke', sourceId: product.uuid, name: product.name, price: 87.5, packSize: 12, supplier: 'Акварисейл-опт', suppliers: 3,
      minOrder: 30000, vat: false, priceDate: '2026-08-13T16:23:30+03:00',
      url: `https://napolke.ru/catalog/soki_vody_napitki/ehnergeticheskie_napitki/product/${product.seo_name}`,
    });
    expect(napolkeOffer({ ...product, price: 0, offer_with_min_price: undefined })).toBeNull();
    expect(() => parseNapolkePage('<html></html>')).toThrow('no products');
  });

  it('reads catalog identities from wholesale titles, the country of origin cut out', () => {
    const config = loadProductsConfig();
    const identity = (name: string) => normalizeIdentity(identityTitle(name), undefined, config.brands, config.brandAliases ?? {}, config.flavors, config.flavorAliases ?? {});
    expect(identityTitle('Напиток энергетический Red Bull Австрия 250 мл., ж/б')).toBe('Напиток энергетический Red Bull 250 мл., ж/б');
    expect(identity('Напиток энергетический Red Bull Австрия 250 мл., ж/б')).toEqual({ brand: 'Red Bull', flavor: 'original', volumeMl: 250 });
    expect(identity('Напиток энергетический Burn манго 449 мл., ж/б')).toEqual({ brand: 'Burn', flavor: 'mango', volumeMl: 449 });
  });
});

describe('otlichnye', async () => {
  const { otlichnyeOffer, storeSitemapLinks, tildaProduct } = await import('../src/wholesale/otlichnye.js');
  const url = 'https://otlichnye-tseny.ru/catalog/energeticheskiye-napitkki/tproduct/579905276842-burn-sochnaya-energiya-zhb-05-l';

  it('takes the parts of the sitemap index, then only energy drink pages', () => {
    expect(storeSitemapLinks('<sitemapindex><sitemap><loc>https://otlichnye-tseny.ru/sitemap-store-part1.xml</loc></sitemap></sitemapindex>'))
      .toEqual({ parts: ['https://otlichnye-tseny.ru/sitemap-store-part1.xml'], products: [] });
    expect(storeSitemapLinks(`<urlset><url><loc>${url}</loc></url><url><loc>https://otlichnye-tseny.ru/catalog/gazirovannye-napitki/tproduct/1-cola</loc></url></urlset>`))
      .toEqual({ parts: [], products: [url] });
  });

  it('reads the product of a Tilda page: price per can, the case from the description, stock', () => {
    const html = `<script>var product = {"uid":579905276842,"title":"Burn Сочная энергия ж\\/б 0.5 л","brand":"Burn","descr":"12 шт в упаковке<br \\/><strong>Товар в наличии<\\/strong>","price":"98.2700","url":"${url}"};</script>`;
    const product = tildaProduct(html)!;
    expect(product.title).toBe('Burn Сочная энергия ж/б 0.5 л');
    expect(otlichnyeOffer(product, url)).toEqual({ source: 'otlichnye', sourceId: '579905276842', name: 'Burn Сочная энергия ж/б 0.5 л', price: 98.27, packSize: 12, supplier: 'Отличные цены', suppliers: 1, url, siteBrand: 'Burn' });
    expect(otlichnyeOffer({ ...product, descr: 'Нет в наличии' }, url)).toBeNull();
    expect(tildaProduct('<html></html>')).toBeNull();
  });
});

describe('esweets', async () => {
  const { esweetsCards, hasNextPage } = await import('../src/wholesale/esweets.js');
  const card = (id: string, name: string, price: string, stock: 'yes' | 'no') => `<div class="product"><div class="in">
    <div class="h5 product_name"><a href="/product/${id}-can/" title="${name}"><span>${name} </span></a></div>
    <form class="purchase addtocart" method="post" action="/cart/add/"><input type="hidden" name="product_id" value="${id}">
    <span class="price nowrap">${price} руб. за шт.</span><div class="v_upakovke">В упаковке: 12 шт.</div></form>
    <div class="stock ${stock}">${stock === 'yes' ? 'В наличии' : 'Нет в наличии'}</div></div></div>`;

  it('reads each card once, with the case and stock, and finds the next page', () => {
    const html = card('1322', 'Monster Energy Monarch 500 мл', '189', 'yes') + card('1641', 'Monster Energy Green 500 мл', '1 219', 'no') + card('1322', 'Monster Energy Monarch 500 мл', '189', 'yes')
      + '<a href="/category/energeticheskie-napitki/?page=2">2</a>';
    expect(esweetsCards(html)).toEqual([
      { source: 'esweets', sourceId: '1322', name: 'Monster Energy Monarch 500 мл', price: 189, packSize: 12, supplier: 'E-sweets', suppliers: 1, inStock: true, url: 'https://msk.e-sweets.ru/product/1322-can/' },
      { source: 'esweets', sourceId: '1641', name: 'Monster Energy Green 500 мл', price: 1219, packSize: 12, supplier: 'E-sweets', suppliers: 1, inStock: false, url: 'https://msk.e-sweets.ru/product/1641-can/' },
    ]);
    expect(hasNextPage(html, 1)).toBe(true);
    expect(hasNextPage(html, 2)).toBe(false);
  });
});
