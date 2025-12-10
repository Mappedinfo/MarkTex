/**
 * LaTeX 格式文件管理服务
 * 使用 IndexedDB 持久化存储预编译的格式文件
 */

const DB_NAME = 'swiftlatex-formats';
const DB_VERSION = 1;
const STORE_NAME = 'formats';

export class FormatFileService {
  private db: IDBDatabase | null = null;

  /**
   * 初始化 IndexedDB
   */
  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  /**
   * 保存格式文件
   */
  async saveFormat(engineType: 'pdftex' | 'xetex', formatData: Uint8Array): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const key = `${engineType}.fmt`;
      
      const request = store.put(formatData, key);
      request.onsuccess = () => {
        console.log(`✅ 格式文件已保存: ${key}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 加载格式文件
   */
  async loadFormat(engineType: 'pdftex' | 'xetex'): Promise<Uint8Array | null> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const key = `${engineType}.fmt`;
      
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result) {
          console.log(`✅ 格式文件已加载: ${key}`);
          resolve(request.result);
        } else {
          console.log(`⚠️ 格式文件不存在: ${key}`);
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 检查格式文件是否存在
   */
  async hasFormat(engineType: 'pdftex' | 'xetex'): Promise<boolean> {
    const format = await this.loadFormat(engineType);
    return format !== null;
  }

  /**
   * 删除格式文件
   */
  async deleteFormat(engineType: 'pdftex' | 'xetex'): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const key = `${engineType}.fmt`;
      
      const request = store.delete(key);
      request.onsuccess = () => {
        console.log(`✅ 格式文件已删除: ${key}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 清空所有格式文件
   */
  async clearAll(): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.clear();
      request.onsuccess = () => {
        console.log('✅ 所有格式文件已清空');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// 导出单例
export const formatFileService = new FormatFileService();

