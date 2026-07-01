'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSheet } from './hooks/useSheet';
import { SheetForm } from './components/SheetForm';
import { FilterBar } from './components/FilterBar';
import { RowCard } from './components/RowCard';

const DEFAULT_SHEET_ID = '1AB2LGfQqGP5es9nU2vMuwldI1HabyV1pyrVOhOC4GRE';
const DEFAULT_SHEET_NAME = 'Sheet1';
const WEB_MAIL_KP_URL = 'https://login.live.com/login.srf?wa=wsignin1.0&rpsnv=198&ct=1782607399&rver=7.5.2211.0&wp=SA_20MIN&wreply=https%3A%2F%2Faccount.live.com%2Fproofs%2FManage%2Fadditional%3Fuaid%3D233239318fd1447bab2b4edd22546006&lc=1033&id=38936&mkt=vi-VN&uaid=233239318fd1447bab2b4edd22546006';

export default function Home() {
  const { sheetId, setSheetId, sheetName, setSheetName, mode, setMode, rows, loading, error, fetchRows, patchRow
  } =
    useSheet(DEFAULT_SHEET_ID, DEFAULT_SHEET_NAME, 'default');

  const [showForm, setShowForm] = useState(false);

  const [selectedName, setSelectedName] = useState('');
  const [fviaToken, setFviaToken] = useState('');
  const [fviaError, setFviaError] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const [mailProvider, setMailProvider] = useState<'inboxes' | 'fvia'>('inboxes');
  const [preferredDomain, setPreferredDomain] = useState('random');

  // Lắng nghe token từ iframe gửi lên
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === 'FVIA_TOKEN' && event.data.token) {
        setFviaToken(event.data.token);
        setFviaError('');
        localStorage.setItem('fviaToken', event.data.token);
      } else if (event.data.type === 'FVIA_ERROR') {
        if (event.data.msg) {
          setFviaError(event.data.msg);
          setFviaToken('❌ Lỗi chặn Token');
        } else {
          setFviaError('');
        }
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

  const uniqueNames = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.name) set.add(r.name); });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const result = rows.filter(r => {
      if (mode !== 'capital' && selectedName && selectedName !== 'all' && r.name !== selectedName) return false;
      if (statusFilter === 'done' && !r.isDone) return false;
      if (statusFilter === 'not-done' && r.isDone) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const hay = (r.name + ' ' + r.email + ' ' +
          (r.recovery || '') + ' ' + (r.oldRecovery || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      const aAtEnd = a.isDone || a.isPasswordError;
      const bAtEnd = b.isDone || b.isPasswordError;
      
      if (aAtEnd === bAtEnd) {
        return a.rowIndex - b.rowIndex;
      }
      return aAtEnd ? 1 : -1;
    });

    return result;
  }, [rows, selectedName, statusFilter, searchText, mode]);

  const doneCount = filtered.filter(r => r.isDone).length;
  const notDoneCount = filtered.length - doneCount;

  // Phân trang gọn gàng (Pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [activeEmail, setActiveEmail] = useState('');
  
  // Tự động kiểm tra nếu Backend đã xóa tài khoản (VD: Tampermonkey báo lỗi)
  useEffect(() => {
    if (!activeEmail) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/current-account');
        const data = await res.json();
        // Nếu API trả về success nhưng account là null => tài khoản đã bị xóa khỏi trạng thái Đang chạy
        if (data.success && !data.account) {
          setActiveEmail('');
          fetchRows();
        }
      } catch (e) {
        console.error('Lỗi poll current-account:', e);
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [activeEmail, fetchRows]);
  // Reset trang về 1 khi các bộ lọc thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [mode, selectedName, statusFilter, searchText, pageSize]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Toggle Form Button & Token Input */}
        {!showForm && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              
              {/* Mode Toggle */}
              <div className="flex bg-gray-200 p-1 rounded-lg mr-2">
                <button
                  onClick={() => { setMode('default'); setSelectedName(''); }}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'default' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Mặc định
                </button>
                <button
                  onClick={() => { setMode('capital'); setSelectedName('Capital'); }}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'capital' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Capital One
                </button>
              </div>

              {/* Provider Toggle */}
              <div className="flex bg-gray-200 p-1 rounded-lg">
                <button
                  onClick={() => { setMailProvider('inboxes'); setPreferredDomain('random'); }}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${mailProvider === 'inboxes' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Inboxes.com
                </button>
                <button
                  onClick={() => { setMailProvider('fvia'); setPreferredDomain('random'); }}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${mailProvider === 'fvia' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Fvia
                </button>
              </div>

              {/* Domain Dropdown */}
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm border w-full sm:w-auto">
                <span className="text-sm font-medium whitespace-nowrap">🌐 Đuôi:</span>
                <select
                  value={preferredDomain}
                  onChange={(e) => setPreferredDomain(e.target.value)}
                  className="text-sm outline-none w-full sm:w-auto bg-transparent py-1 cursor-pointer font-medium text-gray-700"
                >
                  <option value="random">Ngẫu nhiên (Tự động)</option>
                  {mailProvider === 'inboxes' ? (
                    <optgroup label="Inboxes.com">
                      <option value="blondmail.com">@blondmail.com</option>
                      <option value="chapsmail.com">@chapsmail.com</option>
                      <option value="clowmail.com">@clowmail.com</option>
                      <option value="dropjar.com">@dropjar.com</option>
                      <option value="fivermail.com">@fivermail.com</option>
                      <option value="getairmail.com">@getairmail.com</option>
                      <option value="getmule.com">@getmule.com</option>
                      <option value="getnada.com">@getnada.com</option>
                      <option value="gimpmail.com">@gimpmail.com</option>
                      <option value="givmail.com">@givmail.com</option>
                      <option value="guysmail.com">@guysmail.com</option>
                      <option value="inboxbear.com">@inboxbear.com</option>
                      <option value="replyloop.com">@replyloop.com</option>
                      <option value="robot-mail.com">@robot-mail.com</option>
                      <option value="tafmail.com">@tafmail.com</option>
                      <option value="temptami.com">@temptami.com</option>
                      <option value="tupmail.com">@tupmail.com</option>
                      <option value="vomoto.com">@vomoto.com</option>
                      <option value="smvmail.com">@smvmail.com</option>
                    </optgroup>
                  ) : (
                    <optgroup label="Fvia">
                      <option value="fviainboxes.com">@fviainboxes.com</option>
                      <option value="fviadropinbox.com">@fviadropinbox.com</option>
                      <option value="fviamail.work">@fviamail.work</option>
                      <option value="dropinboxes.com">@dropinboxes.com</option>
                    </optgroup>
                  )}
                </select>
              </div>

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
                    setFviaError('');
                    setIframeKey(k => k + 1);
                  }}
                  className="ml-2 text-gray-500 hover:text-blue-600 transition-colors"
                  title="Làm mới Token (Tự động lấy lại)"
                >
                  🔄
                </button>
              </div>
              
              {fviaError && (
                <div className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 px-3 py-2 rounded-lg animate-pulse w-full sm:w-auto">
                  {fviaError}
                </div>
              )}

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
              ⚙️ Cấu hình Google Sheet
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
              currentSheetName={sheetName}
              onSubmit={(id, name) => {
                setSheetId(id);
                setSheetName(name);
                localStorage.setItem('sheetId', id);
                localStorage.setItem('sheetName', name);
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

        {rows.length > 0 && mode !== 'capital' && (
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

        {rows.length > 0 && mode === 'capital' && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">📌 Trạng thái:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'done' | 'not-done')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">Tất cả</option>
                  <option value="not-done">⏳ Đang làm</option>
                  <option value="done">✅ Đã làm</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">🔎 Tìm kiếm:</label>
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Tìm theo Hotmail, mail khôi phục..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex items-end">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-2 rounded-lg w-full text-sm">
                  <div>📋 Hiển thị: <b>{filtered.length}</b> / {rows.length}</div>
                  <div>
                    ✅ <b className="text-green-600">{doneCount}</b>{' '}
                    ⏳ <b className="text-orange-600">{notDoneCount}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>
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

        {rows.length > 0 && selectedName === '' && mode !== 'capital' && (
          <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow border-2 border-dashed border-gray-300 mb-6">
            <span className="text-2xl mb-2 block">👆</span>
            Vui lòng chọn người ở mục <strong>"Lọc theo người"</strong> bên trên để hiển thị danh sách tài khoản.
          </div>
        )}

        {loading && rows.length === 0 && (
          <div className="text-center text-gray-500 py-12">⏳ Đang tải dữ liệu...</div>
        )}

        {!loading && sheetId && rows.length === 0 && !error && (
          <div className="text-center text-gray-500 py-12">Sheet trống hoặc chưa có dữ liệu.</div>
        )}

        {paginatedRows.length > 0 && (
          <>
            {/* Page Size Selector & Pagination Summary */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 mt-6 gap-3 bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">📄 Hiển thị mỗi trang:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 border rounded-lg text-sm bg-gray-50 font-medium text-gray-700 cursor-pointer"
                >
                  <option value="3">3 tài khoản</option>
                  <option value="4">4 tài khoản</option>
                  <option value="5">5 tài khoản</option>
                  <option value="6">6 tài khoản</option>
                </select>
              </div>
              <div className="text-sm text-gray-500 font-medium">
                Hiển thị tài khoản <b>{Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}</b> - <b>{Math.min(filtered.length, currentPage * pageSize)}</b> trong tổng số <b>{filtered.length}</b>
              </div>
            </div>

            {/* Grid hiển thị danh sách RowCard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedRows.map((row, idx) => (
                <RowCard
                  key={row.rowIndex}
                  row={row}
                  index={idx}
                  sheetId={sheetId}
                  sheetName={sheetName}
                  onUpdated={patchRow}
                  fviaToken={fviaToken}
                  preferredDomain={preferredDomain}
                  mailProvider={mailProvider}
                  mode={mode}
                  activeEmail={activeEmail}
                  onActive={setActiveEmail}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8 mb-6">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white text-gray-700 rounded-lg border hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition-colors text-sm font-medium"
                >
                  ◀ Trước
                </button>
                
                {/* Hiển thị số trang */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors ${
                          currentPage === page
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white text-gray-700 border hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  }
                  if (page === 2 || page === totalPages - 1) {
                    return <span key={page} className="text-gray-400">...</span>;
                  }
                  return null;
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white text-gray-700 rounded-lg border hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition-colors text-sm font-medium"
                >
                  Sau ▶
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
