export default function RegisterLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-[#1A1D2E]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="h-12 w-12 bg-gray-200 rounded-lg animate-pulse mx-auto mb-4" />
          <div className="h-7 bg-gray-200 rounded animate-pulse w-64 mx-auto" />
        </div>
        <div className="bg-white dark:bg-[#1A1D2E] rounded-lg border border-gray-200 dark:border-[#2E3148] shadow-sm p-8 space-y-4">
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}
