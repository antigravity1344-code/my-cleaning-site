/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * حالت اتصال سفارش‌ها؛ فقط هنگام build/راه‌اندازی تعیین می‌شود.
   * مقادیر مجاز: `demo` (پیش‌فرض)، `standalone`، `coordinated`. نگاه کنید به src/config/orderBackend.ts.
   */
  readonly VITE_ORDER_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
