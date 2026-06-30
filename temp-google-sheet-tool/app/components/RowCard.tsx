'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { SheetRow } from '../hooks/useSheet';

declare global {
  interface Window {
    GM_fetch?: (url: string, options?: any) => Promise<any>;
  }
}

const MICROSOFT_OTP_REGEX = /(?:Security code|M[ãa]\s*b[ảaáo]o?\s*m[ậa]t|Mã bảo mật):\s*(\d{6})/i;
const GENERIC_6_DIGIT_REGEX = /\b(\d{6})\b/;

function extractOtp(rawText: string): string | null {
  let html = rawText;
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed === 'string') html = parsed;
  } catch (e) { }

  const cleanText = html.replace(/<[^>]*>/g, '').normalize("NFC");

  const m = cleanText.match(MICROSOFT_OTP_REGEX);
  if (m) return m[1];

  const m2 = cleanText.match(GENERIC_6_DIGIT_REGEX);
  return m2?.[1] ?? null;
}

type Props = {
  row: SheetRow;
  index: number;
  sheetId: string;
  sheetName: string;
  onUpdated: (rowIndex: number, updates: any) => void;
  fviaToken?: string;
  preferredDomain?: string;
  mailProvider: 'fvia' | 'inboxes';
};

function CopyField({ label, value, color = 'blue' }: { label: string; value: string; color?: 'blue' | 'green' | 'purple' | 'gray' }) {
  const [copied, setCopied] = useState(false);
  const colorClass: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-700 bg-green-100 border-green-200 hover:bg-green-200',
    purple: 'text-purple-700 bg-purple-100 border-purple-200 hover:bg-purple-200',
    gray: 'text-gray-900',
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { }
  };
  if (!value) return null;
  return (
    <div className="mb-3">
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div
        onClick={copy}
        className={`flex items-center justify-between bg-white rounded p-2 border border-gray-200 cursor-pointer transition-colors ${colorClass[color] ?? colorClass.blue}`}
        title="Click để copy"
      >
        <span className="text-sm font-medium truncate">{value}</span>
        <span className="ml-2 text-xs flex-shrink-0">{copied ? '✅' : '📋'}</span>
      </div>
    </div>
  );
}

export function RowCard({ row, index, sheetId, sheetName, onUpdated, fviaToken, preferredDomain, mailProvider }: Props) {
  const [isCreatingMail, setIsCreatingMail] = useState(false);
  const [generated, setGenerated] = useState<string>(row.recovery);
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [otp, setOtp] = useState<string>('');
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [err, setErr] = useState('');

  const isDone = row.isDone;

  const pollingRef = useRef(false);
  const latestTokenRef = useRef(fviaToken);

  useEffect(() => {
    latestTokenRef.current = fviaToken;
  }, [fviaToken]);

  const handleCreate = async () => {
    setLoadingCreate(true);
    setErr('');
    try {
      const baseName = (row.email.split('@')[0] || 'user').toLowerCase();
      const rnd = Math.floor(1000 + Math.random() * 9000);
      const name = `${baseName}${rnd}`;
      const res = await fetch('/api/create-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          domain: preferredDomain && preferredDomain !== 'Ngẫu nhiên (Tự động)' ? preferredDomain : undefined,
          provider: mailProvider,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Không tạo được email');
      setGenerated(data.email);
      setCreatedAt(Date.now());
      onUpdated(row.rowIndex, { recovery: data.email });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleGetOtp = async () => {
    if (!generated) return;
    if (pollingRef.current) return;

    setLoadingOtp(true);
    setErr('');
    pollingRef.current = true;

    // Đợi 1 giây trước lần quét đầu tiên theo yêu cầu
    await new Promise(r => setTimeout(r, 1000));

    const maxWaitTime = 10 * 60 * 1000; // Đợi tối đa 10 phút
    const startTime = Date.now();

    const [username, domain] = generated.split('@');
    if (!username || !domain) {
      setErr('Email lấy thư bị lỗi định dạng.');
      setLoadingOtp(false);
      return;
    }

    const isFvia = mailProvider === 'fvia';

    let attempts = 0;
    while (pollingRef.current && (Date.now() - startTime < maxWaitTime)) {
      attempts++;
      let currentWaitMs = isFvia ? 2000 : 4000; // Mặc định 2s cho Fvia, 4s cho Inboxes
      try {
        let foundOtp: string | null = null;
        let isAuthError = false;

        // Gọi về web (Next.js server) để fetch thư
        const res = await fetch('/api/read-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            domain,
            provider: mailProvider,
            fviaToken: latestTokenRef.current
          })
        });

        const data = await res.json();
        if (!data.success) {
          isAuthError = data.status === 401 || data.status === 403;
          if (isAuthError) {
            console.error('Lỗi auth: Token bị từ chối hoặc hết hạn!', data.error);
          }
          throw new Error(data.error || 'Lỗi khi đọc mail từ web mình');
        }

        if (data.otp) {
          foundOtp = data.otp;
        }

        if (foundOtp) {
          // Đã lấy được OTP, chỉ lưu vào State, KHÔNG ghi lên sheet tự động
          setOtp(foundOtp);
          onUpdated(row.rowIndex, { code: foundOtp });
          pollingRef.current = false;
          setLoadingOtp(false);
          return;
        }
      } catch (e) {
        console.error('Lỗi khi lấy OTP:', e);
        if (e instanceof Error) {
          if (e.message.includes('GM_fetch') || e.message.includes('web mình')) {
            setErr(e.message);
            pollingRef.current = false;
            setLoadingOtp(false);
            return;
          }
          // Hiển thị tạm lỗi ra UI nếu muốn theo dõi
          setErr(`Cảnh báo lúc lấy mail: ${e.message}`);
        }
      }

      // Đợi trước khi hỏi lại (sử dụng currentWaitMs thay vì 200ms)
      await new Promise(r => setTimeout(r, currentWaitMs));
    }

    if (pollingRef.current) {
      setErr('Quá thời gian chờ OTP (10 phút). Hãy thử lại.');
      pollingRef.current = false;
      setLoadingOtp(false);
    }
  };

  const handleComplete = async () => {
    setLoadingComplete(true);
    setErr('');
    try {
      const res = await fetch('/api/complete-row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetId,
          sheetName,
          rowIndex: row.rowIndex,
          recovery: generated,
          code: otp,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Lỗi cập nhật Sheet');
      onUpdated(row.rowIndex, { isDone: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingComplete(false);
    }
  };

  const handleError = async () => {
    setLoadingComplete(true);
    setErr('');
    try {
      const res = await fetch('/api/error-row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetId,
          sheetName,
          rowIndex: row.rowIndex,
          errorMsg: 'LỖI MẬT KHẨU'
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Lỗi ghi lỗi vào Sheet');
      onUpdated(row.rowIndex, { isDone: true, status: 'LỖI MẬT KHẨU' });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingComplete(false);
    }
  };  return (
    <div
      className={`bg-white rounded-lg shadow-md p-5 border-2 transition-all ${
        isDone 
          ? (row.status ? 'border-red-400 bg-red-50' : 'border-green-400 bg-green-50')
          : 'border-orange-200 bg-orange-50 hover:border-blue-300'
        }`}
    >
      <div className="flex justify-between items-center mb-4">
        <div className="text-xs text-gray-500">
          #{row.rowIndex} · <span className="font-medium text-gray-700">{row.name || '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          {!isDone && (
            <button
              onClick={handleError}
              disabled={loadingComplete}
              title="Báo lỗi mật khẩu"
              className="px-2 py-1 bg-red-100 text-red-600 border border-red-200 rounded text-xs font-bold hover:bg-red-200 transition-colors shadow-sm"
            >
              {loadingComplete ? '⏳...' : '⚠️ Lỗi Mật khẩu'}
            </button>
          )}
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isDone 
                ? (row.status ? 'bg-red-500 text-white' : 'bg-green-500 text-white')
                : 'bg-orange-400 text-white'
              }`}
          >
            {isDone ? (row.status ? `❌ ${row.status}` : '✓ Đã làm') : '⏳ Đang làm'}
          </span>
        </div>
      </div>

      <CopyField label="📧 Email Hotmail" value={row.email} color="blue" />
      <CopyField label="🔑 Mật khẩu" value={row.password} color="gray" />

      <div className="border-t border-dashed border-gray-300 my-3" />

      {generated ? (
        <>
          <CopyField label="✨ Mail khôi phục đã tạo" value={generated} color="green" />
          {otp && <CopyField label="🔐 Code (OTP Microsoft)" value={otp} color="purple" />}
          {!otp && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={loadingOtp ? () => {
                  pollingRef.current = false;
                  setLoadingOtp(false);
                } : handleGetOtp}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium ${loadingOtp ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'
                  }`}
              >
                {loadingOtp ? '⏹ Dừng chờ OTP' : '🔐 Lấy code'}
              </button>

              {!loadingOtp && (
                <button
                  onClick={() => {
                    setGenerated('');
                    setOtp('');
                    onUpdated(row.rowIndex, { recovery: '' });
                  }}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm flex-shrink-0"
                  title="Xóa mail ảo này để tạo mail mới"
                >
                  🔄 Đổi mail khác
                </button>
              )}
            </div>
          )}
          {isDone ? (
            <button
              onClick={() => onUpdated(row.rowIndex, { isDone: false })}
              className="w-full px-4 py-2 mt-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-bold transition-colors"
            >
              ↩️ Làm lại (Bỏ đánh dấu Hoàn thành)
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={loadingComplete}
              className="w-full px-4 py-2 mt-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-bold transition-colors"
            >
              {loadingComplete ? '⏳ Đang lưu...' : '✅ Hoàn thành & Lưu'}
            </button>
          )}
        </>
      ) : (
        <button
          onClick={handleCreate}
          disabled={loadingCreate}
          className="w-full px-4 py-2 mt-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loadingCreate ? '⏳ Đang tạo...' : '✨ Tạo mail khôi phục'}
        </button>
      )}

      {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
    </div>
  );
}
