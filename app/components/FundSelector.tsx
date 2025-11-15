'use client';

import React, { useState } from 'react';

interface FundInput {
  id: string;
  code: string;
  name?: string;
}

interface FundSelectorProps {
  mode: 'single' | 'multi-dca' | 'multi-lumpsum';
  onModeChange: (mode: 'single' | 'multi-dca' | 'multi-lumpsum') => void;
  funds: FundInput[];
  onFundsChange: (funds: FundInput[]) => void;
}

export default function FundSelector({ mode, onModeChange, funds, onFundsChange }: FundSelectorProps) {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddFund = () => {
    const newFund: FundInput = {
      id: Date.now().toString(),
      code: ''
    };
    onFundsChange([...funds, newFund]);
  };

  const handleRemoveFund = (id: string) => {
    onFundsChange(funds.filter(fund => fund.id !== id));
  };

  const handleFundCodeChange = (id: string, code: string) => {
    onFundsChange(funds.map(fund =>
      fund.id === id ? { ...fund, code } : fund
    ));
  };

  const handleModeChange = (newMode: 'single' | 'multi-dca' | 'multi-lumpsum') => {
    if (newMode === 'single') {
      onFundsChange([{ id: '1', code: funds[0]?.code || '' }]);
    } else {
      // 切换到多基金模式时，如果有多个基金代码则保留，否则添加两个空输入
      if (funds.length <= 1 && funds[0]?.code) {
        onFundsChange([
          { id: '1', code: funds[0].code },
          { id: '2', code: '' }
        ]);
      }
    }
    onModeChange(newMode);
  };

  return (
    <div className="space-y-3">
      {/* 比较模式选择 */}
      <div className="group">
        <label className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
          <span className="text-[#4a9eff]">⚙️</span>
          比较模式
        </label>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => handleModeChange('single')}
            className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border text-left flex items-center gap-2 ${
              mode === 'single'
                ? 'bg-[#4a9eff]/20 border-[#4a9eff] text-[#4a9eff]'
                : 'bg-[#252525] border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a4a4a]'
            }`}
          >
            <span>📊</span>
            <div className="flex-1">
              <div className="font-medium">单基金比较</div>
              <div className="text-xs opacity-70">定投 vs 一次性投入</div>
            </div>
          </button>

          <button
            onClick={() => handleModeChange('multi-dca')}
            className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border text-left flex items-center gap-2 ${
              mode === 'multi-dca'
                ? 'bg-[#4a9eff]/20 border-[#4a9eff] text-[#4a9eff]'
                : 'bg-[#252525] border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a4a4a]'
            }`}
          >
            <span>📈</span>
            <div className="flex-1">
              <div className="font-medium">多基金定投比较</div>
              <div className="text-xs opacity-70">多个基金定投收益对比</div>
            </div>
          </button>

          <button
            onClick={() => handleModeChange('multi-lumpsum')}
            className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border text-left flex items-center gap-2 ${
              mode === 'multi-lumpsum'
                ? 'bg-[#4a9eff]/20 border-[#4a9eff] text-[#4a9eff]'
                : 'bg-[#252525] border-[#3a3a3a] text-[#b0b0b0] hover:bg-[#2a2a2a] hover:border-[#4a4a4a]'
            }`}
          >
            <span>💹</span>
            <div className="flex-1">
              <div className="font-medium">多基金一次性投入比较</div>
              <div className="text-xs opacity-70">多个基金一次性投入收益对比</div>
            </div>
          </button>
        </div>
      </div>

      {/* 基金代码输入区域 */}
      {mode === 'single' ? (
        <div className="group">
          <label className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2">
            <span className="text-[#4a9eff]">📊</span>
            基金代码
          </label>
          <input
            type="text"
            value={funds[0]?.code || ''}
            onChange={(e) => handleFundCodeChange(funds[0]?.id || '1', e.target.value)}
            placeholder="例如：000001"
            className="w-full px-4 py-2.5 border border-[#3a3a3a] rounded-lg text-base text-sm transition-all duration-200 bg-[#252525] text-[#e0e0e0] placeholder:text-[#666] focus:outline-none focus:border-[#4a9eff] focus:bg-[#2a2a2a] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.1)] hover:border-[#4a4a4a]"
            inputMode="numeric"
          />
        </div>
      ) : (
        <div className="group">
          <label className="block mb-2 text-[#b0b0b0] font-medium text-sm flex items-center gap-2 justify-between">
            <span className="flex items-center gap-2">
              <span className="text-[#4a9eff]">📊</span>
              基金代码列表
            </span>
            <span className="text-xs text-[#888]">
              {funds.length} 个基金
            </span>
          </label>

          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
            {funds.map((fund, index) => (
              <div key={fund.id} className="flex gap-2 items-center">
                <div className="flex items-center gap-2 flex-1 bg-[#252525] px-3 py-2 rounded-lg border border-[#3a3a3a] hover:border-[#4a4a4a] transition-colors">
                  <span className="text-[#888] text-sm font-medium w-6">
                    {index + 1}.
                  </span>
                  <input
                    type="text"
                    value={fund.code}
                    onChange={(e) => handleFundCodeChange(fund.id, e.target.value)}
                    placeholder="基金代码"
                    className="flex-1 bg-transparent text-[#e0e0e0] placeholder:text-[#666] focus:outline-none text-sm"
                    inputMode="numeric"
                  />
                  {index < 3 && (
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: ['#00CED1', '#FFD700', '#FF6BFF'][index] }}
                    />
                  )}
                </div>

                {funds.length > 1 && (
                  <button
                    onClick={() => handleRemoveFund(fund.id)}
                    className="p-2 text-[#ff4d4f] hover:bg-[#ff4d4f]/10 rounded-lg transition-colors flex-shrink-0"
                    aria-label="删除基金"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {funds.length < 6 && (
            <button
              onClick={handleAddFund}
              className="w-full px-3 py-2 text-sm text-[#4a9eff] border border-[#4a9eff]/30 rounded-lg bg-[#4a9eff]/5 hover:bg-[#4a9eff]/10 hover:border-[#4a9eff]/50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加基金
            </button>
          )}

          <div className="text-xs text-[#666] mt-2">
            提示：最多可同时比较 6 个基金
          </div>
        </div>
      )}
    </div>
  );
}