import { NavigationContainer, StackActions, useNavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useEffect, useState } from 'react'
import BootstrapScreen from '../screens/BootstrapScreen'
import MachineRegistrationScreen from '../screens/MachineRegistrationScreen'
import PrinterSelectionScreen from '../screens/PrinterSelectionScreen'
import LoginScreen from '../screens/LoginScreen'
import MainPosScreen from '../screens/MainPosScreen'
import SalesTransactionsScreen from '../screens/SalesTransactionsScreen'
import UtilitiesScreen from '../screens/UtilitiesScreen'
import type { RootStackParamList } from './types'
import ConnectionErrorScreen from '../screens/ConnectionErrorScreen'
import { useNetworkError } from '../context/NetworkErrorContext'
import { setConnectionErrorHandler, setConnectionRecoveredHandler } from '../services/api/client'

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function RootNavigator() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>()
  const [isNavReady, setIsNavReady] = useState(false)
  const { hasConnectionError, reportConnectionError, clearConnectionError } = useNetworkError()

  useEffect(() => {
    setConnectionErrorHandler((details) => reportConnectionError(details))
    setConnectionRecoveredHandler(() => clearConnectionError())

    return () => {
      setConnectionErrorHandler(null)
      setConnectionRecoveredHandler(null)
    }
  }, [reportConnectionError, clearConnectionError])

  useEffect(() => {
    if (!hasConnectionError || !isNavReady || !navigationRef.isReady()) {
      return
    }

    const route = navigationRef.getCurrentRoute()
    if (route?.name !== 'ConnectionError') {
      navigationRef.dispatch(StackActions.replace('ConnectionError'))
    }
  }, [hasConnectionError, isNavReady, navigationRef])

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        setIsNavReady(true)
      }}
    >
      <Stack.Navigator
        initialRouteName="Bootstrap"
        screenOptions={{
          headerStyle: { backgroundColor: '#1e293b' },
          headerTintColor: '#f8fafc',
          contentStyle: { backgroundColor: '#0f172a' },
        }}
      >
        <Stack.Screen name="Bootstrap" component={BootstrapScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MachineRegistration" component={MachineRegistrationScreen} options={{ title: 'Machine Registration' }} />
        <Stack.Screen name="PrinterSelection" component={PrinterSelectionScreen} options={{ title: 'Printer Selection' }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign In' }} />
        <Stack.Screen name="ConnectionError" component={ConnectionErrorScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MainPos" component={MainPosScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="SalesTransactions"
          component={SalesTransactionsScreen}
          options={{ title: 'Sales Transactions' }}
        />
        <Stack.Screen name="Utilities" component={UtilitiesScreen} options={{ title: 'Utilities' }} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
