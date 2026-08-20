import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-gray-400">404</p>
      <h1 className="text-3xl font-bold text-gray-800">Không tìm thấy trang</h1>
      <p className="text-gray-500">Đường dẫn này không tồn tại hoặc đã được di chuyển.</p>
      <Link to="/" className="rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-md hover:bg-amber-700">
        Về trang chủ
      </Link>
    </div>
  );
}
