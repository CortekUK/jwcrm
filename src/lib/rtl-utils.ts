import { cn } from '@/lib/utils';

export const rtlClass = (rtlClassName: string, ltrClassName: string = '') => {
  return cn(
    `rtl:${rtlClassName}`,
    ltrClassName && `ltr:${ltrClassName}`
  );
};

export const flexDirection = (isRtl: boolean) => {
  return isRtl ? 'flex-row-reverse' : 'flex-row';
};

export const textAlign = (isRtl: boolean) => {
  return isRtl ? 'text-right' : 'text-left';
};

export const marginStart = (value: string) => {
  return `ms-${value}`;
};

export const marginEnd = (value: string) => {
  return `me-${value}`;
};

export const paddingStart = (value: string) => {
  return `ps-${value}`;
};

export const paddingEnd = (value: string) => {
  return `pe-${value}`;
};
