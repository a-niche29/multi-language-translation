'use client';

import { useState } from 'react';
import { AlertCircle, Check } from 'lucide-react';

export interface RowRange {
  startRow: number;
  endRow: number;
  enabled: boolean;
}

interface RowRangeSelectorProps {
  totalRows: number;
  onRangeChange: (range: RowRange | null) => void;
}

export default function RowRangeSelector({ totalRows, onRangeChange }: RowRangeSelectorProps) {
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [startRow, setStartRow] = useState(1);
  const [endRow, setEndRow] = useState(Math.min(10, totalRows));
  const [error, setError] = useState('');

  const presetRanges = [
    { label: 'All rows', start: 1, end: totalRows },
    { label: 'First 10 rows', start: 1, end: Math.min(10, totalRows) },
    { label: 'First 50 rows', start: 1, end: Math.min(50, totalRows) },
    { label: 'First 100 rows', start: 1, end: Math.min(100, totalRows) },
  ];

  const validateRange = (start: number, end: number): boolean => {
    if (start < 1) {
      setError('Start row must be at least 1');
      return false;
    }
    if (end > totalRows) {
      setError(`End row cannot exceed ${totalRows}`);
      return false;
    }
    if (start > end) {
      setError('Start row must be less than or equal to end row');
      return false;
    }
    setError('');
    return true;
  };

  const handlePresetSelect = (start: number, end: number) => {
    setIsCustomRange(false);
    setStartRow(start);
    setEndRow(end);
    setError('');
    onRangeChange({ startRow: start, endRow: end, enabled: true });
  };

  const handleCustomRange = () => {
    if (validateRange(startRow, endRow)) {
      onRangeChange({ startRow, endRow, enabled: true });
    }
  };

  const handleStartChange = (value: string) => {
    const num = parseInt(value) || 0;
    setStartRow(num);
    if (isCustomRange && num > 0) {
      validateRange(num, endRow);
    }
  };

  const handleEndChange = (value: string) => {
    const num = parseInt(value) || 0;
    setEndRow(num);
    if (isCustomRange && num > 0) {
      validateRange(startRow, num);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
      <h3 className="text-lg font-semibold text-black mb-4">Row Selection</h3>
      
      <div className="space-y-4">
        {/* Preset ranges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {presetRanges.map((range, index) => {
            const isSelected = !isCustomRange && startRow === range.start && endRow === range.end;
            return (
              <button
                key={index}
                onClick={() => handlePresetSelect(range.start, range.end)}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-black border-black hover:bg-blue-50'
                }`}
              >
                {range.label}
              </button>
            );
          })}
        </div>

        {/* Custom range */}
        <div className="border-t border-black pt-4">
          <label className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={isCustomRange}
              onChange={(e) => {
                setIsCustomRange(e.target.checked);
                if (e.target.checked) {
                  handleCustomRange();
                } else {
                  handlePresetSelect(1, totalRows);
                }
              }}
              className="w-4 h-4"
            />
            <span className="font-medium text-black">Use custom range</span>
          </label>

          {isCustomRange && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-black">From row:</label>
                <input
                  type="number"
                  value={startRow}
                  onChange={(e) => handleStartChange(e.target.value)}
                  onBlur={handleCustomRange}
                  min="1"
                  max={totalRows}
                  className="w-20 px-2 py-1 border border-black rounded"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-black">To row:</label>
                <input
                  type="number"
                  value={endRow}
                  onChange={(e) => handleEndChange(e.target.value)}
                  onBlur={handleCustomRange}
                  min="1"
                  max={totalRows}
                  className="w-20 px-2 py-1 border border-black rounded"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-black">
                <Check className="w-4 h-4 text-green-600" />
                <span>{endRow - startRow + 1} rows selected</span>
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Info message */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-black">
            <strong>Selected range:</strong> Rows {startRow} to {endRow} ({endRow - startRow + 1} total rows)
          </p>
          <p className="text-xs text-black mt-1">
            Only the selected rows will be translated. You can change this range at any time before starting translation.
          </p>
        </div>
      </div>
    </div>
  );
}