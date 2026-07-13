export function IconCircle({ icon, colour, size = 36 }: { icon: string; colour: string; size?: number }) {
  return (
    <span className="icircle" style={{ width: size, height: size, background: `${colour}38`, fontSize: size * 0.5 }}>
      {icon}
    </span>
  )
}
