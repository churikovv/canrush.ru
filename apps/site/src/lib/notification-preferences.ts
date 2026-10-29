export const NOTIFICATION_OPTIONS = [
  { kind: 'follow', label: 'Новые подписчики' },
  { kind: 'like', label: 'Лайки к отзывам' },
  { kind: 'review-comment', label: 'Комментарии к отзывам' },
  { kind: 'comment-reply', label: 'Ответы на ваши комментарии' },
  { kind: 'business-reply', label: 'Ответы компаний на ваши отзывы' },
  { kind: 'company-post', label: 'Публикации компаний, на которые вы подписаны' },
  { kind: 'mention', label: 'Упоминания через @' },
  { kind: 'wall-comment', label: 'Сообщения на стене' },
  { kind: 'price', label: 'Изменение цен в избранном' },
  { kind: 'overtaken', label: 'Вас обогнали в топе месяца' },
] as const;
