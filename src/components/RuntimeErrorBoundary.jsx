import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class RuntimeErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Portal rendering failure', { name: error?.name });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="shell flex min-h-screen items-center justify-center py-10" dir="rtl">
        <section className="panel max-w-lg text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-rose-400" />
          <h1 className="mt-4 text-2xl font-black">تعذر عرض الصفحة</h1>
          <p className="mt-2 text-sm leading-7 text-slate-300">حدث خطأ غير متوقع في الواجهة. أعد تحميل الصفحة، ولن يؤدي ذلك إلى إنشاء تسجيل مكرر.</p>
          <button className="btn-primary mt-5" onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" />إعادة تحميل الصفحة</button>
        </section>
      </main>
    );
  }
}
