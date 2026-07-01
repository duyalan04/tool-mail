'use client';

import { useCallback, useEffect, useState } from 'react';

export type SheetRow = {
  rowIndex: number;
  name: string;
  date: string;
  email: string;
  password: string;
  recovery: string;
  oldRecovery?: string;
  newPassword?: string;
  newMkCapital?: string;
  mkCapital: string;
  code: string;
  isDone: boolean;
  isPasswordError?: boolean;
};

export function extractSheetId(url: string): string {
  const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : url.trim();
}

export function useSheet(initialSheetId: string, initialSheetName = 'Sheet1', initialMode: 'default' | 'capital' = 'default') {
  const [sheetId, setSheetId] = useState(initialSheetId);
  const [sheetName, setSheetName] = useState(initialSheetName);
  const [mode, setMode] = useState<'default' | 'capital'>(initialMode);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  // Khởi tạo thông tin từ localStorage sau khi component mounted để tránh hydration mismatch
  useEffect(() => {
    const savedId = localStorage.getItem('sheetId');
    const savedName = localStorage.getItem('sheetName');
    if (savedId) setSheetId(savedId);
    if (savedName) setSheetName(savedName);
    setIsReady(true);
  }, []);

  const fetchRows = useCallback(async () => {
    if (!isReady || !sheetId) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/read-rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId, sheetName, mode }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Không đọc được sheet (Vui lòng kiểm tra lại Tên Trang Tính)');
        setRows([]);
      } else {
        setRows(data.rows ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sheetId, sheetName, mode, isReady]);

  useEffect(() => {
    if (isReady && sheetId) void fetchRows();
  }, [isReady, sheetId, fetchRows]);

  const patchRow = useCallback((rowIndex: number, patch: Partial<SheetRow>) => {
    setRows(prev =>
      prev.map(r => (r.rowIndex === rowIndex ? { ...r, ...patch } : r))
    );
  }, []);

  return { sheetId, setSheetId, sheetName, setSheetName, mode, setMode, rows, loading, error, fetchRows, patchRow };
}
