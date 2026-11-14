import { useRef, useState } from 'react';
import { isSpendable } from '@shared/finance';
import { usePrefs } from '@shared/prefs';
import { describeEntry, parseQuickEntry, type ReceiptImage } from '@shared/quickEntry';
import { newId, useStore } from '@shared/store';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { Banner, Button } from './ui';

/** Shrinks a photo in the browser so the upload stays small, and returns it as base64 JPEG. */
async function toReceipt(file: File): Promise<ReceiptImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
  return { data, mediaType: 'image/jpeg' };
}

/** Type "cafe 35k, xăng 50k" or pick a receipt photo; the AI turns it into transactions. */
export function QuickEntryBar() {
  const { assets, categories, saveTransactions, deleteTransaction } = useStore();
  const { prefs } = usePrefs();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const run = async (input: { text?: string; image?: ReceiptImage }) => {
    setBusy(true);
    setError('');
    try {
      const { entries, offline } = await parseQuickEntry(input, categories);
      if (entries.length === 0) throw new Error('Không đọc được giao dịch nào. Hãy thử lại.');
      // Quick entries go to the wallet used last, like the full form does.
      const wallet = assets.find((a) => a.id === prefs.lastAccountId && isSpendable(a));
      const saved = entries.map((e) => ({ id: newId(), ...e, accountId: wallet?.id }));
      saveTransactions(saved);
      setText('');
      toast.show({
        message:
          `Đã thêm: ${entries.map((e) => describeEntry(e, categories)).join('; ')}` +
          (wallet ? ` · ${wallet.name}` : '') +
          (offline ? ' (tự phân loại, chưa qua AI)' : ''),
        tone: 'success',
        actionLabel: 'Hoàn tác',
        onAction: () => saved.forEach((t) => deleteTransaction(t.id)),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đã có lỗi xảy ra.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim() && !busy) run({ text: text.trim() });
        }}
      >
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder='Nhập nhanh: "cafe 35k, xăng 50k"' disabled={busy} aria-label="Nhập nhanh giao dịch" />
        <button type="button" className="icon-btn" title="Quét hoá đơn" aria-label="Quét hoá đơn" disabled={busy} onClick={() => file.current?.click()}>
          <Icon name="camera" />
        </button>
        <Button type="submit" label={busy ? 'Đang đọc…' : 'Thêm'} disabled={busy || !text.trim()} />
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const picked = e.target.files?.[0];
            e.target.value = '';
            if (!picked) return;
            try {
              run({ image: await toReceipt(picked) });
            } catch {
              setError('Không đọc được ảnh. Hãy chọn ảnh khác.');
            }
          }}
        />
      </form>
      {error ? <Banner tone="danger">{error}</Banner> : null}
    </div>
  );
}
