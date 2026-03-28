export default function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-[#161822]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="h-12 w-12 bg-gray-200 rounded-lg animate-pulse mx-auto mb-4" />
          <div className="h-7 bg-gray-200 rounded animate-pulse w-56 mx-auto" />
        </div>
        <div className="bg-white dark:bg-[#161822] rounded-lg border border-gray-200 dark:border-[#2A2D3E] shadow-sm p-8 space-y-4">
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}
