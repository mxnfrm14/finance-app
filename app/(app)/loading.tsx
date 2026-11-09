import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Chargement / Loading" className="flex flex-col gap-7">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="hidden h-10 w-36 rounded-xl sm:block" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-40 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Skeleton className="h-[430px] rounded-2xl" />
        <Skeleton className="h-[430px] rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </main>
  )
}
