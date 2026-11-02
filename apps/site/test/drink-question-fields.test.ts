import { describe, expect, it } from 'vitest';
import { ANSWER_MAX, DrinkQuestionError, QUESTION_MAX, answersWord, parseAnswerText, parseQuestionText, questionsWord } from '../src/lib/drink-question-fields';
import { MAX_COLLECTION_CAPTION, collectionRoom, parseCollectionCaption } from '../src/lib/collection-photo-fields';

describe('drink questions', () => {
  it('keeps line breaks, collapses spaces and checks the length', () => {
    expect(parseQuestionText('  Бывает   в банке\r\n\n\n\n0,25?  ')).toBe('Бывает в банке\n\n0,25?');
    expect(() => parseQuestionText('Где?')).toThrow(DrinkQuestionError);
    expect(() => parseQuestionText('я'.repeat(QUESTION_MAX + 1))).toThrow('до 500');
    expect(() => parseQuestionText(42)).toThrow(DrinkQuestionError);
    expect(parseAnswerText(' Да ')).toBe('Да');
    expect(() => parseAnswerText('   ')).toThrow('Напишите ответ');
    expect(() => parseAnswerText('я'.repeat(ANSWER_MAX + 1))).toThrow('до 1000');
  });

  it('counts in Russian', () => {
    expect([1, 2, 5, 11, 21, 22, 112].map(count => `${count} ${questionsWord(count)}`)).toEqual(['1 вопрос', '2 вопроса', '5 вопросов', '11 вопросов', '21 вопрос', '22 вопроса', '112 вопросов']);
    expect([1, 3, 14].map(count => `${count} ${answersWord(count)}`)).toEqual(['1 ответ', '3 ответа', '14 ответов']);
  });
});

describe('collection photos', () => {
  it('takes one short line as a caption and counts the room left', () => {
    expect(parseCollectionCaption('  Лимитки\n Red Bull ')).toBe('Лимитки Red Bull');
    expect(parseCollectionCaption('   ')).toBeNull();
    expect(parseCollectionCaption(undefined)).toBeNull();
    expect(() => parseCollectionCaption('я'.repeat(MAX_COLLECTION_CAPTION + 1))).toThrow('до 80');
    expect([0, 11, 12, 20].map(collectionRoom)).toEqual([12, 1, 0, 0]);
  });
});
