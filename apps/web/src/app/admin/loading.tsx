export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[#0F1117] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading admin dashboard...</p>
      </div>
    </div>
  )
}
