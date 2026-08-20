import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">404</p>
      <h1 className="text-2xl font-semibold text-slate-900">Không tìm thấy trang</h1>
      <p className="text-slate-500">Đường dẫn này không tồn tại hoặc đã được di chuyển.</p>
      <Link to="/" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
        Về trang chính
      </Link>
    </div>
  )
}
