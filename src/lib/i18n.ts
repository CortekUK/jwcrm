import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonEn from '@/locales/en/common.json';
import authEn from '@/locales/en/auth.json';
import portalEn from '@/locales/en/portal.json';
import adminEn from '@/locales/en/admin.json';
import formEn from '@/locales/en/form.json';
import landingEn from '@/locales/en/landing.json';
import pdfEn from '@/locales/en/pdf.json';
import toastEn from '@/locales/en/toast.json';
import hrEn from '@/locales/en/hr.json';
import financeEn from '@/locales/en/finance.json';
import leadManagementEn from '@/locales/en/leadManagement.json';
import salespersonEn from '@/locales/en/salesperson.json';

import commonAr from '@/locales/ar/common.json';
import authAr from '@/locales/ar/auth.json';
import portalAr from '@/locales/ar/portal.json';
import adminAr from '@/locales/ar/admin.json';
import formAr from '@/locales/ar/form.json';
import landingAr from '@/locales/ar/landing.json';
import pdfAr from '@/locales/ar/pdf.json';
import toastAr from '@/locales/ar/toast.json';
import hrAr from '@/locales/ar/hr.json';
import financeAr from '@/locales/ar/finance.json';
import leadManagementAr from '@/locales/ar/leadManagement.json';
import salespersonAr from '@/locales/ar/salesperson.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEn,
        auth: authEn,
        portal: portalEn,
        admin: adminEn,
        form: formEn,
        landing: landingEn,
        pdf: pdfEn,
        toast: toastEn,
        hr: hrEn,
        finance: financeEn,
        leadManagement: leadManagementEn,
        salesperson: salespersonEn,
      },
      ar: {
        common: commonAr,
        auth: authAr,
        portal: portalAr,
        admin: adminAr,
        form: formAr,
        landing: landingAr,
        pdf: pdfAr,
        toast: toastAr,
        hr: hrAr,
        finance: financeAr,
        leadManagement: leadManagementAr,
        salesperson: salespersonAr,
      },
    },
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'portal', 'admin', 'form', 'landing', 'pdf', 'toast', 'hr', 'finance', 'leadManagement', 'salesperson'],
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
