import { describe, expect, it } from 'vitest';
import { checkImageFiles, fieldErrorsFromApi } from './forms.js';
import { moveItem } from './reorder.js';

describe('moveItem', () => {
  it('moves an item forward and backward without mutating the input', () => {
    const list = ['a', 'b', 'c', 'd'];
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns the same list for no-op or out-of-range moves', () => {
    const list = ['a', 'b'];
    expect(moveItem(list, 1, 1)).toBe(list);
    expect(moveItem(list, -1, 0)).toBe(list);
    expect(moveItem(list, 0, 2)).toBe(list);
  });
});

describe('checkImageFiles', () => {
  const file = (name, type, size = 1000) => ({ name, type, size });

  it('accepts supported images and explains every rejection', () => {
    const { accepted, rejected } = checkImageFiles([
      file('a.jpg', 'image/jpeg'),
      file('b.gif', 'image/gif'),
      file('c.svg', 'image/svg+xml'),
      file('d.png', 'image/png', 6 * 1024 * 1024),
      file('e.webp', 'image/webp'),
    ]);
    expect(accepted.map((f) => f.name)).toEqual(['a.jpg', 'e.webp']);
    expect(rejected).toHaveLength(3);
    expect(rejected[0]).toMatch(/b\.gif.*JPEG, PNG or WebP/);
    expect(rejected[2]).toMatch(/d\.png.*5 MB/);
  });

  it('stops at the number of free slots', () => {
    const files = [file('1.jpg', 'image/jpeg'), file('2.jpg', 'image/jpeg'), file('3.jpg', 'image/jpeg')];
    const { accepted, rejected } = checkImageFiles(files, { slotsLeft: 2 });
    expect(accepted).toHaveLength(2);
    expect(rejected[0]).toMatch(/limit reached/);
  });
});

describe('fieldErrorsFromApi', () => {
  it('maps API details to field keys', () => {
    const errors = fieldErrorsFromApi({
      details: [
        { path: 'body.price', message: 'bad price' },
        { path: 'body.specifications.0.items.1.label', message: 'dup' },
        { path: 'body.price', message: 'second' },
      ],
    });
    expect(errors).toEqual({ price: 'bad price', 'specifications.0.items.1.label': 'dup' });
  });

  it('copes with errors that have no details', () => {
    expect(fieldErrorsFromApi(new Error('x'))).toEqual({});
  });
});
