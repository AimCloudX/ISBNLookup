import { describe, it, expect } from 'vitest';
import { formatBookRow } from './bookCopy';

describe('formatBookRow', () => {
  it('タイトル→著者→出版社→(空)→1→(空x4)→ISBN-13 のタブ区切りになる', () => {
    const row = formatBookRow('リーダブルコード', 'Dustin Boswell', 'オライリー', '978-4873115658');
    expect(row).toBe('リーダブルコード\tDustin Boswell\tオライリー\t\t1\t\t\t\t978-4873115658');
  });

  it('スプレッドシート貼り付け時に9列になる', () => {
    const row = formatBookRow('a', 'b', 'c', 'd');
    expect(row.split('\t')).toHaveLength(9);
    expect(row.split('\t')[8]).toBe('d');
  });
});
