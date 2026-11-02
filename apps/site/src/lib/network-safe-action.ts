export const NETWORK_ERROR = 'Не получилось отправить: нет связи с сервером. Заполненное на месте, проверьте интернет и отправьте ещё раз.';

/**
 * Если запрос server action оборвался, `fetch` бросает TypeError, а `useActionState` показывает вместо формы экран ошибки, и заполненное
 * пропадает. Эта обёртка делает из обрыва обычную ошибку формы. Остальное бросается дальше: это уже настоящие сбои.
 */
export function surviveNetworkError<State extends { error?: string }>(action: (state: State, form: FormData) => Promise<State>) {
  return async (state: State, form: FormData): Promise<State> => {
    try {
      return await action(state, form);
    } catch (error) {
      if (error instanceof TypeError) return { ...state, error: NETWORK_ERROR };
      throw error;
    }
  };
}
