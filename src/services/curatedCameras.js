// Curated webcamcollections camera dataset — schema + validation.
//
// The dataset itself is a checked-in JSON file at
// public/data/curated-cameras.json. This module exposes the zod schema
// every entry must satisfy and a `validateCuratedDataset` helper that
// pinpoints the offending entry by id when validation fails.
//
// Schema constraints come from PRD #66 / issue #69:
//   - coordinates within Sweden's WGS84 bounding box
//   - `type` ∈ traffic|weather|ski|construction|wildlife
//   - `media` ∈ image|linkout (curated entries are linkout in practice)
//   - https `pageUrl`
//   - non-empty `name` and `attribution`

import { z } from 'zod';

const SWEDEN_BOUNDS = {
  south: 55.0,
  west: 10.5,
  north: 69.5,
  east: 24.5,
};

export const CAMERA_TYPES = ['traffic', 'weather', 'ski', 'construction', 'wildlife'];
export const MEDIA_CAPABILITIES = ['image', 'linkout'];

export const curatedCameraSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(CAMERA_TYPES),
  media: z.enum(MEDIA_CAPABILITIES),
  lat: z.number().min(SWEDEN_BOUNDS.south).max(SWEDEN_BOUNDS.north),
  lon: z.number().min(SWEDEN_BOUNDS.west).max(SWEDEN_BOUNDS.east),
  imageUrl: z.string().url().nullable(),
  pageUrl: z.string().url().refine(u => u.startsWith('https://'), {
    message: 'pageUrl must use https',
  }),
  source: z.string().min(1),
  attribution: z.string().min(1),
  lastUpdated: z.string().nullable(),
});

/**
 * Validate every entry against the curated schema. Throws on the first
 * invalid entry, naming it by id so the offending row is obvious.
 *
 * @param {Array<object>} entries
 * @returns {Array<object>}  validated entries (returned for chaining)
 */
export function validateCuratedDataset(entries) {
  entries.forEach((entry, i) => {
    const result = curatedCameraSchema.safeParse(entry);
    if (!result.success) {
      const id = entry?.id || `index ${i}`;
      const issues = result.error.issues
        .map(iss => `${iss.path.join('.') || '(root)'}: ${iss.message}`)
        .join('; ');
      throw new Error(`curated dataset entry ${id} failed validation — ${issues}`);
    }
  });
  return entries;
}
