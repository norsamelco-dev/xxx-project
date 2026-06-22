import type { ReactNode, SVGProps } from 'react'

export type ButtonIconName =
  | 'reload'
  | 'plus'
  | 'generate'
  | 'export'
  | 'save'
  | 'delete'
  | 'cancel'
  | 'edit'
  | 'back'
  | 'sync'
  | 'submit'
  | 'close'
  | 'open'
  | 'view'
  | 'details'
  | 'hide'
  | 'logout'
  | 'login'
  | 'settings'
  | 'check'
  | 'minus'
  | 'printer'

type ButtonIconProps = SVGProps<SVGSVGElement> & {
  name: ButtonIconName
}

function IconPath({ name }: { name: ButtonIconName }) {
  switch (name) {
    case 'reload':
      return (
        <>
          <path d="M4 4v5h5" />
          <path d="M20 20v-5h-5" />
          <path d="M5.5 9A7 7 0 0 1 18 7.5" />
          <path d="M18.5 15A7 7 0 0 1 6 16.5" />
        </>
      )
    case 'plus':
      return (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      )
    case 'minus':
      return <path d="M5 12h14" />
    case 'generate':
      return (
        <>
          <path d="M4 6h16" />
          <path d="M6 10h12" />
          <path d="M8 14h8" />
          <path d="M10 18h4" />
        </>
      )
    case 'export':
      return (
        <>
          <path d="M12 4v10" />
          <path d="M8.5 10.5L12 14l3.5-3.5" />
          <path d="M5 20h14" />
        </>
      )
    case 'save':
      return (
        <>
          <path d="M5 5h11l3 3v11H5z" />
          <path d="M7 5v5h8V5" />
          <path d="M8 16h8" />
        </>
      )
    case 'delete':
      return (
        <>
          <path d="M4 7h16" />
          <path d="M9 7V5h6v2" />
          <path d="M8 7l1 12h6l1-12" />
        </>
      )
    case 'cancel':
    case 'close':
      return (
        <>
          <path d="M7 7l10 10" />
          <path d="M17 7L7 17" />
        </>
      )
    case 'edit':
      return (
        <>
          <path d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5z" />
          <path d="M13.5 7l3.5 3.5" />
        </>
      )
    case 'back':
      return (
        <>
          <path d="M10 6L4 12l6 6" />
          <path d="M4 12h16" />
        </>
      )
    case 'sync':
      return (
        <>
          <path d="M12 4v6l3-3" />
          <path d="M12 20v-6l3 3" />
          <path d="M5 9a7 7 0 0 1 12-2" />
          <path d="M19 15a7 7 0 0 1-12 2" />
        </>
      )
    case 'submit':
    case 'check':
      return <path d="M5 12l4.5 4.5L19 7" />
    case 'open':
    case 'view':
      return (
        <>
          <path d="M4 12s3.5-6 8-6 8 6 8 6-3.5 6-8 6-8-6-8-6z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )
    case 'details':
      return <path d="M6 9l6 6 6-6" />
    case 'hide':
      return <path d="M6 15l6-6 6 6" />
    case 'logout':
      return (
        <>
          <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" />
          <path d="M14 12H4" />
          <path d="M7 9l-3 3 3 3" />
        </>
      )
    case 'login':
      return (
        <>
          <path d="M14 7V5a2 2 0 0 0-2-2H5v18h7a2 2 0 0 0 2-2v-2" />
          <path d="M10 12h10" />
          <path d="M17 9l3 3-3 3" />
        </>
      )
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.9 4.9l1.4 1.4" />
          <path d="M17.7 17.7l1.4 1.4" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M4.9 19.1l1.4-1.4" />
          <path d="M17.7 6.3l1.4-1.4" />
        </>
      )
    case 'printer':
      return (
        <>
          <path d="M6 9V4h12v5" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <path d="M6 14h12v7H6z" />
        </>
      )
    default:
      return null
  }
}

export function ButtonIcon({ name, className = 'button-content__icon', ...props }: ButtonIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" {...props}>
      <IconPath name={name} />
    </svg>
  )
}

type ButtonLabelProps = {
  icon: ButtonIconName
  children: ReactNode
}

export function ButtonLabel({ icon, children }: ButtonLabelProps) {
  return (
    <span className="button-content">
      <ButtonIcon name={icon} />
      <span>{children}</span>
    </span>
  )
}

export default ButtonIcon
