import { cn } from "@/lib/utils"

function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-vertical",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
