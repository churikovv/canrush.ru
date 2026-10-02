#!/usr/bin/env node
import path from 'node:path';
import { publishIngredients } from './publish.js';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--bundled')) throw new Error('Допустимый аргумент: --bundled');

publishIngredients(path.resolve(import.meta.dirname, '../..'), args.includes('--bundled'))
  .then(({ count, file }) => console.log(`Составов для сайта: ${count}. Файл: ${file}`))
  .catch((error: unknown) => {
    console.error('Синхронизация составов остановлена: проверьте привязки, отчёты и каталог. Предыдущий срез сохранён.');
    if (error instanceof Error) console.error(error.message);
    process.exitCode = 1;
  });
