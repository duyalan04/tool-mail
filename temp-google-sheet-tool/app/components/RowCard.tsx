'use client';

import React, { useState } from 'react';
import type { SheetRow } from '../hooks/useSheet';

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

  const pollingRef = React.useRef(false);

  const handleGetOtp = async () => {
    if (!generated) return;
    if (pollingRef.current) return;
    
    setLoadingOtp(true);
    setErr('');
    pollingRef.current = true;
    
    const maxWaitTime = 10 * 60 * 1000; // Đợi tối đa 10 phút
    let attempts = 0;

    while (pollingRef.current && attempts < (maxWaitTime / 2000)) {
      attempts++;
      try {
        const res = await fetch('/api/wait-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: generated,
            sinceMs: createdAt ?? Date.now() - 5 * 60_000,
            timeoutMs: 2000, // Server check trong 2 giây rồi trả về
            fviaToken: fviaToken || ''
          }),
        });
        const data = await res.json();
        
        if (res.ok && data.success && data.otp) {
          setOtp(data.otp);
          onUpdated(row.rowIndex, { code: data.otp });
          pollingRef.current = false;
          setLoadingOtp(false);
          return;
        }
      } catch (e) {
        // Lỗi mạng hoặc server chập chờn thì bỏ qua, thử lại ở vòng lặp sau
        console.error('Lỗi khi lấy OTP:', e);
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
