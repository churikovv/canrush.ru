#!/usr/bin/env node
import path from 'node:path';
import { publishIngredients } from './publish.js';

publishIngredients(path.resolve(import.meta.dirname, '../..'))
  .then(({ count, file }) => console.log(`Составов для сайта: ${count}. Файл: ${file}`))
  .catch(() => {
    console.error('Синхронизация составов остановлена: проверьте привязки, отчёты и каталог. Предыдущий срез сохранён.');
    process.exitCode = 1;
  });
