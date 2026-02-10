import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

type UsePagedListParams<T> = {
  items: T[];
  rowHeightPx: number;
  minRows: number;
  maxRows: number;
  containerRef: RefObject<HTMLElement | null>;
  stickyHeaderRef?: RefObject<HTMLElement | null>;
  getAnchorKey?: (item: T) => string;
  initialPage?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function usePagedList<T>({
  items,
  rowHeightPx,
  minRows,
  maxRows,
  containerRef,
  stickyHeaderRef,
  getAnchorKey,
  initialPage = 0,
}: UsePagedListParams<T>) {
  const [rowsPerPage, setRowsPerPage] = useState(minRows);
  const [pageIndex, setPageIndexState] = useState(() => Math.max(0, initialPage));
  const prevItemsRef = useRef(items);
  const anchorKeyRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const containerHeight = containerRef.current?.clientHeight ?? 0;
    const stickyHeaderHeight = stickyHeaderRef?.current?.offsetHeight ?? 0;
    const available = Math.max(0, containerHeight - stickyHeaderHeight);
    const nextRows = clamp(Math.floor(available / rowHeightPx), minRows, maxRows);
    setRowsPerPage((prev) => (prev === nextRows ? prev : nextRows));
  }, [containerRef, maxRows, minRows, rowHeightPx, stickyHeaderRef]);

  useEffect(() => {
    measure();

    const ro = new ResizeObserver(() => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        measure();
      });
    });

    const container = containerRef.current;
    const stickyHeader = stickyHeaderRef?.current;
    if (container) ro.observe(container);
    if (stickyHeader) ro.observe(stickyHeader);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      ro.disconnect();
    };
  }, [containerRef, measure, stickyHeaderRef]);

  const pageCount = Math.max(1, Math.ceil(items.length / rowsPerPage));

  const setPageIndex = useCallback((next: number) => {
    setPageIndexState(clamp(next, 0, pageCount - 1));
  }, [pageCount]);

  useEffect(() => {
    setPageIndexState((prev) => clamp(prev, 0, pageCount - 1));
  }, [pageCount]);

  const pageItems = useMemo(() => {
    const start = pageIndex * rowsPerPage;
    return items.slice(start, start + rowsPerPage);
  }, [items, pageIndex, rowsPerPage]);

  const setAnchorByKey = useCallback((key: string) => {
    anchorKeyRef.current = key;
  }, []);

  const reanchor = useCallback(() => {
    if (!getAnchorKey || !anchorKeyRef.current || !items.length) return;
    const newIndex = items.findIndex((item) => getAnchorKey(item) === anchorKeyRef.current);
    if (newIndex >= 0) {
      setPageIndexState(clamp(Math.floor(newIndex / rowsPerPage), 0, Math.max(0, pageCount - 1)));
    }
  }, [getAnchorKey, items, pageCount, rowsPerPage]);

  useEffect(() => {
    if (!getAnchorKey) {
      prevItemsRef.current = items;
      return;
    }

    if (prevItemsRef.current !== items) {
      const previousItems = prevItemsRef.current;
      const previousFirst = previousItems[pageIndex * rowsPerPage];
      const fallbackAnchor = previousFirst ? getAnchorKey(previousFirst) : null;
      const anchor = anchorKeyRef.current ?? fallbackAnchor;

      if (anchor) {
        const newIndex = items.findIndex((item) => getAnchorKey(item) === anchor);
        if (newIndex >= 0) {
          setPageIndexState(clamp(Math.floor(newIndex / rowsPerPage), 0, Math.max(0, pageCount - 1)));
        } else {
          setPageIndexState((prev) => clamp(prev, 0, Math.max(0, pageCount - 1)));
        }
      }
    }

    prevItemsRef.current = items;
  }, [getAnchorKey, items, pageCount, pageIndex, rowsPerPage]);

  const firstIndex = items.length === 0 ? 0 : pageIndex * rowsPerPage + 1;
  const lastIndex = items.length === 0 ? 0 : Math.min(items.length, (pageIndex + 1) * rowsPerPage);

  const rangeLabel = `Items ${firstIndex}–${lastIndex} of ${items.length}`;

  return {
    pageIndex,
    setPageIndex,
    pageCount,
    rowsPerPage,
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
