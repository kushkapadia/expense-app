import Link from 'next/link'
 
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Not Found</h2>
        <p className="text-muted-foreground mb-4">Could not find requested resource</p>
        <Link href="/dashboard" className="text-primary hover:underline">
          Return to Dashboard
        </Link>
      </div>
    </div>
  )
}
