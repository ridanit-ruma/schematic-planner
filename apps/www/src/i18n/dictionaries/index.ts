import type { Locale } from '../locales';
import { en, type Dictionary } from './en';
import { ja } from './ja';
import { ko } from './ko';
import { zhCN } from './zh-CN';
import { zhTW } from './zh-TW';

export type { Dictionary } from './en';

export const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  ko,
  ja,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
};
