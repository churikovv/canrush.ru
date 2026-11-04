export const LEGAL_DETAILS = {
  contactEmail: 'hello@canrush.ru',
  effectiveDate: '4 ноября 2026 года',
  effectiveDateIso: '2026-11-04',
  // The privacy policy and the account deletion page have their own edition date (Android app, push).
  privacyEffectiveDate: '4 ноября 2026 года',
  privacyEffectiveDateIso: '2026-11-04',
  // The owner of the site and operator of personal data (149-ФЗ art. 10, 152-ФЗ); the address is not published.
  ownerName: 'Чуриков Владимир Владимирович',
  ownerStatus: 'самозанятый (плательщик налога на профессиональный доход)',
  ownerInn: '772022680300',
  operatorName: 'Чуриков Владимир Владимирович, самозанятый (плательщик налога на профессиональный доход), ИНН 772022680300',
  // «Условия для бизнеса» (/business/terms): their own edition; the company's consent stores this version.
  businessTermsEffectiveDate: '4 ноября 2026 года',
  businessTermsEffectiveDateIso: '2026-11-04',
  // «Публичная оферта» (/offer): paid plans of the business cabinet, paid on the payment provider's page.
  offerEffectiveDate: '4 ноября 2026 года',
  offerEffectiveDateIso: '2026-11-04',
  // Who takes card and SBP payments for the plans; the privacy policy and the offer name it.
  paymentProvider: 'RollyPay (rollypay.io)',
  // «Условия охоты за ценниками» (/hunt/rules): their own edition.
  huntRulesEffectiveDate: '2 ноября 2026 года',
  huntRulesEffectiveDateIso: '2026-11-02',
} as const;
