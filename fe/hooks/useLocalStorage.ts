import { useState, useEffect } from 'react';

/**
 * Hook tùy chỉnh để đồng bộ state với localStorage.
 * Giúp dữ liệu không bị mất khi reload trang.
 * 
 * @param key - Key để lưu trong localStorage
 * @param initialValue - Giá trị khởi tạo nếu chưa có dữ liệu
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}