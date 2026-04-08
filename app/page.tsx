import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold text-orange-500">SafetyEd QLD</h1>
        <p className="text-gray-400 text-lg">Workshop Safety Training Platform</p>
        <Link 
          href="/login"
          className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-lg transition-colors"
        >
          Login
        </Link>
      </div>
    </main>
  )
}