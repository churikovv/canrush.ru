import { expect, it } from 'vitest';
import { mentionQuery, splitMentions } from '../src/lib/mentions';

it('splits @mentions out of a text, leaving e-mails, links and short handles alone', () => {
  expect(splitMentions('Привет, @Sobik_On! Пиши на me@mail.ru или canrush.ru/@abc, @ab')).toEqual([
    { text: 'Привет, ' }, { username: 'sobik_on', text: '@Sobik_On' },
    { text: '! Пиши на me@mail.ru или canrush.ru/@abc, @ab' },
  ]);
  expect(splitMentions('@canrush и @vov_vladimir2013')).toEqual([
    { username: 'canrush', text: '@canrush' }, { text: ' и ' }, { username: 'vov_vladimir2013', text: '@vov_vladimir2013' },
  ]);
  expect(splitMentions('без упоминаний')).toEqual([{ text: 'без упоминаний' }]);
});

it('finds the handle being typed before the caret', () => {
  expect(mentionQuery('спасибо @Can', 12)).toEqual({ start: 8, query: 'can' });
  expect(mentionQuery('@', 1)).toEqual({ start: 0, query: '' });
  expect(mentionQuery('me@mail', 7)).toBeNull();
  expect(mentionQuery('@can rush', 9)).toBeNull();
});
