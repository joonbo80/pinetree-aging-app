// hooks/useAgingFilters.ts
//
// URL-backed filter state for the v2.3 Statement Collection Workbench.
// Round 5 scope: native asOfDate picker + multi-AND quick filters.

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Currency, Direction } from '../selectors/agingReport';

export type AgingSignalFilter =
  | 'statementDiff'
  | 'highAmount'
  | 'ninetyPlus'
  | 'duplicate'
  | 'missingDueDate';

export interface AgingFilterState {
  asOfDate: string;
  currencies: Currency[];
  directions: Direction[];
  signals: AgingSignalFilter[];
}

export interface AgingFilterController extends AgingFilterState {
  activeFilterCount: number;
  setAsOfDate: (value: string) => void;
  toggleCurrency: (value: Currency) => void;
  toggleDirection: (value: Direction) => void;
  toggleSignal: (value: AgingSignalFilter) => void;
  clearCurrency: (value: Currency) => void;
  clearDirection: (value: Direction) => void;
  clearSignal: (value: AgingSignalFilter) => void;
  clearAll: () => void;
}

const CURRENCY_VALUES: Currency[] = ['USD', 'CAD'];
const DIRECTION_VALUES: Direction[] = ['receivable', 'payable', 'settled'];
const SIGNAL_VALUES: AgingSignalFilter[] = [
  'statementDiff',
  'highAmount',
  'ninetyPlus',
  'duplicate',
  'missingDueDate',
];

function parseCsvParam<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
): T[] {
  const raw = params.get(key);
  if (!raw) return [];

  const allowedSet = new Set<string>(allowed);
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is T => allowedSet.has(item));
}

function writeCsvParam<T extends string>(
  params: URLSearchParams,
  key: string,
  values: readonly T[],
) {
  if (values.length === 0) params.delete(key);
  else params.set(key, values.join(','));
}

function toggleValue<T extends string>(values: readonly T[], value: T): T[] {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }
  return [...values, value];
}

function withoutValue<T extends string>(values: readonly T[], value: T): T[] {
  return values.filter((item) => item !== value);
}

export function useAgingFilters(defaultAsOfDate: string): AgingFilterController {
  const [searchParams, setSearchParams] = useSearchParams();

  const currencies = useMemo(
    () => parseCsvParam(searchParams, 'currency', CURRENCY_VALUES),
    [searchParams],
  );
  const directions = useMemo(
    () => parseCsvParam(searchParams, 'direction', DIRECTION_VALUES),
    [searchParams],
  );
  const signals = useMemo(
    () => parseCsvParam(searchParams, 'signal', SIGNAL_VALUES),
    [searchParams],
  );
  const asOfDate = searchParams.get('asOf') || defaultAsOfDate;

  const updateParams = useCallback(
    (updater: (next: URLSearchParams) => void) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        updater(next);
        return next;
      });
    },
    [setSearchParams],
  );

  const setAsOfDate = useCallback(
    (value: string) => {
      updateParams((next) => {
        if (!value || value === defaultAsOfDate) next.delete('asOf');
        else next.set('asOf', value);
      });
    },
    [defaultAsOfDate, updateParams],
  );

  const setCurrencyValues = useCallback(
    (values: Currency[]) => {
      updateParams((next) => writeCsvParam(next, 'currency', values));
    },
    [updateParams],
  );

  const setDirectionValues = useCallback(
    (values: Direction[]) => {
      updateParams((next) => writeCsvParam(next, 'direction', values));
    },
    [updateParams],
  );

  const setSignalValues = useCallback(
    (values: AgingSignalFilter[]) => {
      updateParams((next) => writeCsvParam(next, 'signal', values));
    },
    [updateParams],
  );

  const clearAll = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('asOf');
      next.delete('currency');
      next.delete('direction');
      next.delete('signal');
      return next;
    });
  }, [setSearchParams]);

  return {
    asOfDate,
    currencies,
    directions,
    signals,
    activeFilterCount:
      currencies.length +
      directions.length +
      signals.length +
      (asOfDate && asOfDate !== defaultAsOfDate ? 1 : 0),
    setAsOfDate,
    toggleCurrency: (value) => setCurrencyValues(toggleValue(currencies, value)),
    toggleDirection: (value) =>
      setDirectionValues(toggleValue(directions, value)),
    toggleSignal: (value) => setSignalValues(toggleValue(signals, value)),
    clearCurrency: (value) =>
      setCurrencyValues(withoutValue(currencies, value)),
    clearDirection: (value) =>
      setDirectionValues(withoutValue(directions, value)),
    clearSignal: (value) => setSignalValues(withoutValue(signals, value)),
    clearAll,
  };
}
