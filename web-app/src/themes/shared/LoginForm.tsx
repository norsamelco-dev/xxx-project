import type { FormEvent } from 'react'
import { ButtonLabel } from '../../components/ButtonIcon'
import { ThemedButton } from '../../components/ThemedButton'

type LoginFormProps = {
  username: string
  password: string
  error: string
  isSubmitting: boolean
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function LoginForm({
  username,
  password,
  error,
  isSubmitting,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: LoginFormProps) {
  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          placeholder="Enter your username"
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="Enter your password"
        />
      </div>

      {error ? <div className="error-state">{error}</div> : null}

      <ThemedButton variant="primary" type="submit" disabled={isSubmitting}>
        <ButtonLabel icon="login">{isSubmitting ? 'Signing in...' : 'Sign in'}</ButtonLabel>
      </ThemedButton>
    </form>
  )
}
