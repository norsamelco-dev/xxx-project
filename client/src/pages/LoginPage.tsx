import { ThemedLogin } from '../components/ThemedLogin'
import { useLoginPage } from '../hooks/useLoginPage'

function LoginPage() {
  const loginProps = useLoginPage()
  return <ThemedLogin {...loginProps} />
}

export default LoginPage
