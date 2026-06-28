'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSheet } from './hooks/useSheet';
import { SheetForm } from './components/SheetForm';
import { FilterBar } from './components/FilterBar';
import { RowCard } from './components/RowCard';

const DEFAULT_SHEET_ID = '1AB2LGfQqGP5es9nU2vMuwldI1HabyV1pyrVOhOC4GRE';
const SHEET_NAME = 'Sheet1';
const WEB_MAIL_KP_URL = 'https://login.live.com/login.srf?wa=wsignin1.0&rpsnv=198&ct=1782607399&rver=7.5.2211.0&wp=SA_20MIN&wreply=https%3A%2F%2Faccount.live.com%2Fproofs%2FManage%2Fadditional%3Fuaid%3D233239318fd1447bab2b4edd22546006&lc=1033&id=38936&mkt=vi-VN&uaid=233239318fd1447bab2b4edd22546006';

export default function Home() {
  const [pendingSheetId, setPendingSheetId] = useState(DEFAULT_SHEET_ID);
  const { sheetId, setSheetId, rows, loading, error, fetchRows, patchRow
  } =
    useSheet(pendingSheetId, SHEET_NAME);

  const [showForm, setShowForm] = useState(false);

  const [selectedName, setSelectedName] = useState('');
  const [fviaToken, setFviaToken] = useState('');
  const [iframeKey, setIframeKey] = useState(0);

  // Lắng nghe token từ iframe gửi lên
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'FVIA_TOKEN' && event.data.token) {
        setFviaToken(event.data.token);
        localStorage.setItem('fviaToken', event.data.token);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('selectedName');
    if (saved) {
      setSelectedName(saved);
    }
    const savedToken = localStorage.getItem('fviaToken');
    if (savedToken) {
      setFviaToken(savedToken);
    }
  }, []);

  const handleNameChange = (name: string) => {
    setSelectedName(name);
    localStorage.setItem('selectedName', name);
  };
  const [statusFilter, setStatusFilter] = useState<'all' | 'done' |
    'not-done'>('all');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (pendingSheetId && pendingSheetId !== sheetId) {
      setSheetId(pendingSheetId);
    }
  }, [pendingSheetId, sheetId, setSheetId]);

  const uniqueNames = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.name) set.add(r.name); });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    if (!selectedName) return [];
    const result = rows.filter(r => {
      if (selectedName !== 'all' && r.name !== selectedName) return false;
      if (statusFilter === 'done' && !r.isDone) return false;
      if (statusFilter === 'not-done' && r.isDone) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const hay = (r.name + ' ' + r.email + ' ' +
          r.recovery).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (a.isDone === b.isDone) {
        return a.rowIndex - b.rowIndex;
      }
      return a.isDone ? 1 : -1;
    });

    return result;
  }, [rows, selectedName, statusFilter, searchText]);

  const doneCount = filtered.filter(r => r.isDone).length;
  const notDoneCount = filtered.length - doneCount;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Toggle Form Button & Token Input */}
        {!showForm && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm border w-full sm:w-auto">
                <span className="text-sm font-medium whitespace-nowrap">🔑 Fvia Token:</span>
                <input
                  type="text"
                  value={fviaToken}
                  onChange={(e) => {
                    setFviaToken(e.target.value);
                    localStorage.setItem('fviaToken', e.target.value);
                  }}
                  placeholder="Nhập Token giải Captcha..."
                  className="text-sm outline-none w-full sm:w-64 bg-transparent"
                />
                <button
                  onClick={() => {
                    setFviaToken('⏳ Đang lấy token mới...');
                    setIframeKey(k => k + 1);
                  }}
                  className="ml-2 text-gray-500 hover:text-blue-600 transition-colors"
                  title="Làm mới Token (Tự động lấy lại)"
                >
                  🔄
                </button>
              </div>
              
              {/* Iframe ẩn hoàn toàn để chạy ngầm */}
              <iframe 
                key={iframeKey}
                src="https://fviainboxes.com" 
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px', top: 0, left: 0 }}
                title="Auto Captcha"
                scrolling="no"
              />
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium whitespace-nowrap"
            >
              ⚙️ Đổi link Google Sheet
            </button>
          </div>
        )}

        {/* Form nhập link */}
        {showForm && (
          <div className="relative">
            {sheetId && (
              <button
                onClick={() => setShowForm(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
                title="Đóng"
              >
                ✕
              </button>
            )}
            <SheetForm
              currentSheetId={sheetId}
              onSubmit={(id) => {
                setPendingSheetId(id);
                setShowForm(false);
              }}
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700   
  rounded-lg p-4 mb-6">
            ❌ {error}
          </div>
        )}

        {rows.length > 0 && (
          <FilterBar
            uniqueNames={uniqueNames}
            selectedName={selectedName}
            statusFilter={statusFilter}
            searchText={searchText}
            totalCount={rows.length}
            shownCount={filtered.length}
            doneCount={doneCount}
            notDoneCount={notDoneCount}
            onChangeName={handleNameChange}
            onChangeStatus={setStatusFilter}
            onChangeSearch={setSearchText}
          />
        )}

        {rows.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={fetchRows}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg     
  hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? '⏳ Đang tải...' : '🔄 Refresh'}
            </button>
            <a
              href={WEB_MAIL_KP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
            >
              🌐 Web mail KP
            </a>
          </div>
        )}

        {rows.length > 0 && selectedName === '' && (
          <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow border-2 border-dashed border-gray-300 mb-6">
            <span className="text-2xl mb-2 block">👆</span>
            Vui lòng chọn người ở mục <strong>"Lọc theo người"</strong> bên trên để hiển thị danh sách tài khoản.
          </div>
        )}

        {loading && rows.length === 0 && (
          <div className="text-center text-gray-500 py-12">⏳ Đang tải dữ
            liệu...</div>
        )}

        {!loading && sheetId && rows.length === 0 && !error && (
          <div className="text-center text-gray-500 py-12">Sheet trống
            hoặc chưa có dữ liệu.</div>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 
  gap-4">
            {filtered.map((row, idx) => (
              <RowCard
                key={row.rowIndex}
                row={row}
                index={idx}
                sheetId={sheetId}
                sheetName={SHEET_NAME}
                onUpdated={patchRow}
                fviaToken={fviaToken}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
