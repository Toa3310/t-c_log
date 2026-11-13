import type { ComponentProps } from 'react'
import { Link } from 'react-router'

type Props = Omit<ComponentProps<'a'>, 'href'> & { href: string }

/** Astryx は href を渡してくるので、React Router の Link（to を受け取る）につなぐ */
export function RouterLink({ href, ...rest }: Props) {
  return <Link to={href} {...rest} />
}
