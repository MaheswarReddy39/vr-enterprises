import { z } from 'zod';
import { objectId } from './common.js';

/** Internal path ("/shop?category=x") or an https URL. Anything else (javascript:, data:, //host, http:) is rejected. */
export const isSafeLink = (value) => {
  if (value === '') return true;
  if (/^\/(?!\/)[A-Za-z0-9\-._~/?=&#%+]*$/.test(value)) return true;
  if (!URL.canParse(value)) return false;
  return new URL(value).protocol === 'https:';
};

const link = z.string().trim().max(300).refine(isSafeLink, 'Use a site path like /shop or a full https:// address.');

const dateOrNull = z.preprocess((v) => (v === '' ? null : v), z.coerce.date().nullable());

const shape = {
  title: z.string().trim().min(2, 'Enter a title (at least 2 characters).').max(80),
  subtitle: z.string().trim().max(200),
  ctaLabel: z.string().trim().max(30),
  linkUrl: link,
  isActive: z.boolean(),
  startsAt: dateOrNull,
  endsAt: dateOrNull,
};

const datesInOrder = (data, ctx) => {
  if (data.startsAt && data.endsAt && data.endsAt < data.startsAt) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'The end date must be after the start date.' });
  }
};

export const bannerCreateBody = z
  .strictObject({
    title: shape.title,
    subtitle: shape.subtitle.optional(),
    ctaLabel: shape.ctaLabel.optional(),
    linkUrl: shape.linkUrl.optional(),
    isActive: shape.isActive.optional(),
    startsAt: shape.startsAt.optional(),
    endsAt: shape.endsAt.optional(),
  })
  .superRefine(datesInOrder);

export const bannerUpdateBody = z.strictObject(shape).partial().superRefine(datesInOrder);

export const bannerOrderBody = z.strictObject({ order: z.array(objectId).min(1).max(100) });
