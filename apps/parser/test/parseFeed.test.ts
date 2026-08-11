import { describe, expect, it } from 'vitest';
import { detectFeedFormat, parseCsvFeed, parseYmlFeed } from '../src/feed/parseFeed.js';

const SAMPLE_YML = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="2026-08-11 00:00">
  <shop>
    <offers>
      <offer id="111" available="true">
        <url>https://www.ozon.ru/product/energetik-111</url>
        <price>129</price>
        <oldprice>159</oldprice>
        <currencyId>RUR</currencyId>
        <categoryId>10</categoryId>
        <picture>https://example.com/111.jpg</picture>
        <vendor>Red Bull</vendor>
        <name>Red Bull Энергетический напиток 0.355л</name>
      </offer>
      <offer id="222">
        <url>https://www.ozon.ru/product/juice-222</url>
        <price>99</price>
        <name>Сок апельсиновый 1л</name>
      </offer>
    </offers>
  </shop>
</yml_catalog>`;

const SAMPLE_CSV = `id,name,price,oldprice,url,picture
111,Red Bull Энергетический напиток 0.355л,129,159,https://www.ozon.ru/product/energetik-111,https://example.com/111.jpg
222,Сок апельсиновый 1л,99,,https://www.ozon.ru/product/juice-222,`;

describe('parseYmlFeed', () => {
  it('разбирает офферы YML в RawProductInput[]', () => {
    const offers = parseYmlFeed(SAMPLE_YML);
    expect(offers).toHaveLength(2);
    expect(offers[0]).toMatchObject({
      sourceId: '111',
      name: 'Red Bull Энергетический напиток 0.355л',
      price: 129,
      oldPrice: 159,
      url: 'https://www.ozon.ru/product/energetik-111',
      imageUrl: 'https://example.com/111.jpg',
    });
  });

  it('пропускает офферы без цены/url/id', () => {
    const offers = parseYmlFeed('<yml_catalog><shop><offers><offer><name>Без id</name></offer></offers></shop></yml_catalog>');
    expect(offers).toHaveLength(0);
  });
});

describe('parseCsvFeed', () => {
  it('разбирает CSV с алиасами колонок', () => {
    const offers = parseCsvFeed(SAMPLE_CSV);
    expect(offers).toHaveLength(2);
    expect(offers[0]).toMatchObject({
      sourceId: '111',
      name: 'Red Bull Энергетический напиток 0.355л',
      price: 129,
      oldPrice: 159,
    });
    expect(offers[1]?.oldPrice).toBeUndefined();
  });
});

describe('detectFeedFormat', () => {
  it('определяет csv по расширению и content-type', () => {
    expect(detectFeedFormat('https://example.com/feed.csv')).toBe('csv');
    expect(detectFeedFormat('https://example.com/feed', 'text/csv; charset=utf-8')).toBe('csv');
  });

  it('по умолчанию считает фид YML', () => {
    expect(detectFeedFormat('https://example.com/feed.xml')).toBe('yml');
    expect(detectFeedFormat('https://example.com/feed')).toBe('yml');
  });
});
