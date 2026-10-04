export const NOTIFICATION_OPTIONS = [
  { kind: 'follow', label: 'Новые подписчики' },
  { kind: 'like', label: 'Лайки к отзывам' },
  { kind: 'review-comment', label: 'Комментарии к отзывам' },
  { kind: 'wall-comment', label: 'Сообщения на стене' },
  { kind: 'price', label: 'Изменение цен в избранном' },
] as const;
