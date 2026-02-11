import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

type UsePagedListParams<T> = {
  enabled?: boolean;
  items: T[];
  rowHeightPx: number;
  minRows: number;
  maxRows: number;
  viewportRef: RefObject<HTMLElement | null>;
  stickyHeaderRef?: RefObject<HTMLElement | null>;
  paginatorRef?: RefObject<HTMLElement | null>;
  getAnchorKey?: (item: T) => string;
  initialPage?: number;
  verticalPaddingAdjustPx?: number;
  onMeasure?: (metrics: { viewport: number; header: number; pager: number; row: number; rowsPerPage: number }) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function usePagedList<T>({
  enabled = true,
  items,
  rowHeightPx,
  minRows,
  maxRows,
  viewportRef,
  stickyHeaderRef,
  paginatorRef,
  getAnchorKey,
  initialPage = 0,
  verticalPaddingAdjustPx = 0,
  onMeasure,
}: UsePagedListParams<T>) {
  const [rowsPerPage, setRowsPerPage] = useState(minRows);
  const [pageIndex, setPageIndexState] = useState(() => Math.max(0, initialPage));
  const prevItemsRef = useRef(items);
  const anchorKeyRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    if (!enabled) return;
    const viewportHeight = viewportRef.current?.getBoundingClientRect().height ?? 0;
    const stickyHeaderHeight = stickyHeaderRef?.current?.getBoundingClientRect().height ?? 0;
    const paginatorHeight = paginatorRef?.current?.getBoundingClientRect().height ?? 0;
    const available = Math.max(0, viewportHeight - stickyHeaderHeight - paginatorHeight - verticalPaddingAdjustPx);
    const nextRows = clamp(Math.floor(available / rowHeightPx), minRows, maxRows);
    onMeasure?.({ viewport: viewportHeight, header: stickyHeaderHeight, pager: paginatorHeight, row: rowHeightPx, rowsPerPage: nextRows });
    setRowsPerPage((prev) => (prev === nextRows ? prev : nextRows));
  }, [enabled, maxRows, minRows, onMeasure, paginatorRef, rowHeightPx, stickyHeaderRef, verticalPaddingAdjustPx, viewportRef]);

  useEffect(() => {
    if (!enabled) return;
    measure();

    const ro = new ResizeObserver(() => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        measure();
      });
    });

    const container = viewportRef.current;
    const stickyHeader = stickyHeaderRef?.current;
    const paginator = paginatorRef?.current;
    if (container) ro.observe(container);
    if (stickyHeader) ro.observe(stickyHeader);
    if (paginator) ro.observe(paginator);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      ro.disconnect();
    };
  }, [enabled, measure, paginatorRef, stickyHeaderRef, viewportRef]);

  const effectiveRowsPerPage = enabled ? rowsPerPage : Math.max(1, items.length || minRows);
  const pageCount = enabled ? Math.max(1, Math.ceil(items.length / effectiveRowsPerPage)) : 1;

  const setPageIndex = useCallback((next: number) => {
    if (!enabled) return;
    setPageIndexState(clamp(next, 0, pageCount - 1));
  }, [enabled, pageCount]);

  useEffect(() => {
    if (!enabled) return;
    setPageIndexState((prev) => clamp(prev, 0, pageCount - 1));
  }, [enabled, pageCount]);

  const pageItems = useMemo(() => {
    if (!enabled) return items;
    const start = pageIndex * effectiveRowsPerPage;
    return items.slice(start, start + effectiveRowsPerPage);
  }, [enabled, items, pageIndex, effectiveRowsPerPage]);

  const setAnchorByKey = useCallback((key: string) => {
    anchorKeyRef.current = key;
  }, []);

  const reanchor = useCallback(() => {
    if (!enabled || !getAnchorKey || !anchorKeyRef.current || !items.length) return;
    const newIndex = items.findIndex((item) => getAnchorKey(item) === anchorKeyRef.current);
    if (newIndex >= 0) {
      setPageIndexState(clamp(Math.floor(newIndex / effectiveRowsPerPage), 0, Math.max(0, pageCount - 1)));
    }
  }, [enabled, getAnchorKey, items, pageCount, effectiveRowsPerPage]);

  useEffect(() => {
    if (!enabled || !getAnchorKey) {
      prevItemsRef.current = items;
      return;
    }

    if (prevItemsRef.current !== items) {
      const previousItems = prevItemsRef.current;
      const previousFirst = previousItems[pageIndex * effectiveRowsPerPage];
      const fallbackAnchor = previousFirst ? getAnchorKey(previousFirst) : null;
      const anchor = anchorKeyRef.current ?? fallbackAnchor;

      if (anchor) {
        const newIndex = items.findIndex((item) => getAnchorKey(item) === anchor);
        if (newIndex >= 0) {
          setPageIndexState(clamp(Math.floor(newIndex / effectiveRowsPerPage), 0, Math.max(0, pageCount - 1)));
        } else {
          setPageIndexState((prev) => clamp(prev, 0, Math.max(0, pageCount - 1)));
        }
      }
    }

    prevItemsRef.current = items;
  }, [enabled, getAnchorKey, items, pageCount, pageIndex, effectiveRowsPerPage]);

  const firstIndex = items.length === 0 ? 0 : pageIndex * effectiveRowsPerPage + 1;
  const lastIndex = items.length === 0 ? 0 : Math.min(items.length, (pageIndex + 1) * effectiveRowsPerPage);

  const rangeLabel = `Items ${firstIndex}–${lastIndex} of ${items.length}`;

  return {
    pageIndex,
    setPageIndex,
    pageCount,
    rowsPerPage: effectiveRowsPerPage,
    pageItems,
    rangeLabel,
    nextPage: () => setPageIndex(pageIndex + 1),
    prevPage: () => setPageIndex(pageIndex - 1),
    firstPage: () => setPageIndex(0),
    lastPage: () => setPageIndex(pageCount - 1),
    jumpToPage: (n: number) => setPageIndex(Number.isFinite(n) ? n - 1 : 0),
    setAnchorByKey,
    reanchor,
  };
}
