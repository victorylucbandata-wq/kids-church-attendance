// Page-level "Sunday Playroom" circles for screens without a hero card.
// The parent must be `relative`; siblings after it need `relative` to sit on top.
export default function Decor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-yellow-200/60" />
      <div className="absolute -right-16 top-40 h-48 w-48 rounded-full bg-blue-200/50" />
      <div className="absolute -left-10 bottom-32 h-32 w-32 rounded-full bg-pink-200/50" />
    </div>
  )
}
