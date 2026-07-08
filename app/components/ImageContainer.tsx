
export default function ImageContainer({ src }: { src: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center flex-col bg-white p-10">
      <h1 className="text-4xl font-bold text-gray-800 mb-3">U.S. 7 Day Forecast Weather Type</h1>
      <img src={src} alt="" className="h-full w-full object-contain" />
    </div>
  )
}
