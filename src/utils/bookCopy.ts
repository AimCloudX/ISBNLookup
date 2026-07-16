// src/utils/bookCopy.ts
// スプレッドシート貼り付け用の行形式: タイトル→著者→出版社→(空)→1→(空x4)→ISBN-13
export function formatBookRow(title: string, authors: string, publisher: string, isbn13: string): string {
  return `${title}\t${authors}\t${publisher}\t\t1\t\t\t\t${isbn13}`;
}
