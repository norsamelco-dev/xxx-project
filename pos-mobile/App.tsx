import { SafeAreaProvider } from 'react-native-safe-area-context'
import RootNavigator from './src/navigation/RootNavigator'
import { AuthProvider } from './src/context/AuthContext'
import { PosSessionProvider } from './src/context/PosSessionContext'
import { CartProvider } from './src/context/CartContext'

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PosSessionProvider>
          <CartProvider>
            <RootNavigator />
          </CartProvider>
        </PosSessionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
