'use client';

import React, { useEffect, useState } from 'react';
import { extractSheetId } from '../hooks/useSheet';

type Props = {
  currentSheetId: string;
  currentSheetName: string;
  onSubmit: (sheetId: string, sheetName: string) => void;
};

export function SheetForm({ currentSheetId, currentSheetName, onSubmit }: Props) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState(currentSheetName || 'Sheet1');
  const [sheetOptions, setSheetOptions] = useState<string[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [err, setErr] = useState('');

  // Tự động load danh sách các trang tính (sheet names) khi nhập link
  useEffect(() => {
    const id = extractSheetId(url);
    if (!id) {
      if (currentSheetId && sheetOptions.length === 0) {
        // Load các trang tính của sheet hiện tại
        void fetchSheetNames(currentSheetId);
      }
      return;
    }
    void fetchSheetNames(id);
  }, [url]);

  const fetchSheetNames = async (id: string) => {
    setLoadingSheets(true);
    setErr('');
    try {
      const res = await fetch('/api/get-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId: id }),
      });
      const data = await res.json();
      if (data.success && data.sheetNames && data.sheetNames.length > 0) {
        setSheetOptions(data.sheetNames);
        // Nếu trang tính hiện tại không nằm trong danh sách, chọn trang tính đầu tiên làm mặc định
        if (!data.sheetNames.includes(name)) {
          setName(data.sheetNames[0]);
        }
      } else {
        throw new Error(data.error || 'Không tải được danh sách trang tính');
      }
    } catch (e) {
      setErr('Lỗi: Cần chia sẻ quyền truy cập Google Sheet cho Email Service Account trước!');
      setSheetOptions([]);
    } finally {
      setLoadingSheets(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = url.trim() ? extractSheetId(url) : currentSheetId;
    if (!id) {
      setErr('Vui lòng cung cấp link Google Sheet');
      return;
    }
    setErr('');
    onSubmit(id, name || 'Sheet1');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6 border border-blue-200">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔗 Link Google Sheet:
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={currentSheetId ? "Để trống nếu giữ nguyên link cũ..." : "https://docs.google.com/spreadsheets/d/..."}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📄 Chọn Trang tính (Sheet Tab): {loadingSheets && <span className="text-xs text-blue-600 animate-pulse">(Đang tải...)</span>}
            </label>
            {sheetOptions.length > 0 ? (
              <select
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {sheetOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên trang tính thủ công..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={loadingSheets}
              />
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loadingSheets}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400"
          >
            Lưu cấu hình
          </button>
        </div>
        {currentSheetId && (
          <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div>⚙️ <b>Sheet ID hiện tại:</b> <span className="font-mono text-gray-700">{currentSheetId}</span></div>
            <div>📂 <b>Tên Sheet hiện tại:</b> <span className="text-blue-600 font-semibold">{currentSheetName}</span></div>
          </div>
        )}
        {err && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg">
            ⚠️ {err}
          </div>
        )}
      </form>
    </div>
  );
}
