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
    } catch {}
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

export function RowCard({ row, index, sheetId, sheetName, onUpdated, fviaToken }: Props) {
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
      const baseName = row.email.split('@')[0] || 'user';
      const rnd = Math.floor(1000 + Math.random() * 9000);
      const name = `${baseName}${rnd}`;
      const res = await fetch('/api/create-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
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
    
    const maxWaitTime = 10 * 60 * 1000; // Đợi tối đa 10 phút
    let attempts = 0;

    const [username, domain] = generated.split('@');
    if (!username || !domain) {
      setErr('Email lấy thư bị lỗi định dạng.');
      setLoadingOtp(false);
      return;
    }

    while (pollingRef.current && attempts < (maxWaitTime / 2000)) {
      attempts++;
      try {
        if (!window.GM_fetch) {
          throw new Error('Chưa cài đặt Tampermonkey Proxy Script! Không tìm thấy window.GM_fetch.');
        }

        const listUrl = `https://fviainboxes.com/messages?username=${encodeURIComponent(username)}&domain=${encodeURIComponent(domain)}&_t=${Date.now()}`;
        const res = await window.GM_fetch(listUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://fviainboxes.com',
            'Referer': 'https://fviainboxes.com/',
            'Authorization': latestTokenRef.current ? `Bearer ${latestTokenRef.current}` : ''
          }
        });

        if (res.ok) {
          const data = await res.json();
          const messages = data.result || [];
          let foundOtp: string | null = null;

          for (const msg of messages) {
            const fromLower = msg.from.toLowerCase();
            if (!fromLower.includes('microsoft')) continue;
             
            const bodyUrl = `https://fviainboxes.com/message?username=${encodeURIComponent(username)}&domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(msg.id)}`;
            const bodyRes = await window.GM_fetch(bodyUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': 'https://fviainboxes.com',
                'Referer': 'https://fviainboxes.com/',
                'Authorization': latestTokenRef.current ? `Bearer ${latestTokenRef.current}` : ''
              }
            });
            
            if (bodyRes.ok) {
              const bodyText = await bodyRes.text();
              const code = extractOtp(bodyText);
              if (code) {
                 foundOtp = code;
                 break;
              }
            }
          }

          if (foundOtp) {
            // Đã lấy được OTP, gửi lên backend để lưu sheet
            const saveRes = await fetch('/api/wait-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sheetId,
                rowIndex: row.rowIndex,
                otp: foundOtp
              })
            });
            const saveData = await saveRes.json();
             
            if (saveRes.ok && saveData.success) {
              setOtp(foundOtp);
              onUpdated(row.rowIndex, { code: foundOtp });
              pollingRef.current = false;
              setLoadingOtp(false);
              return;
            } else {
              console.error('Lỗi lưu sheet:', saveData.error);
            }
          }
        } else if (res.status === 403 || res.status === 401) {
           console.error('Token Fvia bị từ chối hoặc hết hạn!');
        }
      } catch (e) {
        console.error('Lỗi khi lấy OTP:', e);
        if (e instanceof Error && e.message.includes('GM_fetch')) {
           setErr(e.message);
           pollingRef.current = false;
           setLoadingOtp(false);
           return;
        }
      }
      
      // Đợi 2 giây trước khi hỏi lại
      await new Promise(r => setTimeout(r, 2000));
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

  return (
    <div
      className={`bg-white rounded-lg shadow-md p-5 border-2 transition-all ${
        isDone ? 'border-green-400 bg-green-50' : 'border-orange-200 bg-orange-50 hover:border-blue-300'
      }`}
    >
      <div className="flex justify-between items-center mb-4">
        <div className="text-xs text-gray-500">
          #{row.rowIndex} · <span className="font-medium text-gray-700">{row.name || '—'}</span>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            isDone ? 'bg-green-500 text-white' : 'bg-orange-400 text-white'
          }`}
        >
          {isDone ? '✓ Đã làm' : '⏳ Đang làm'}
        </span>
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
                onClick={loadingOtp ? () => { pollingRef.current = false; setLoadingOtp(false); } : handleGetOtp}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium ${
                  loadingOtp ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'
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
          {!isDone && (
            <button
              onClick={handleComplete}
              disabled={loadingComplete}
              className="w-full px-4 py-2 mt-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-bold"
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
