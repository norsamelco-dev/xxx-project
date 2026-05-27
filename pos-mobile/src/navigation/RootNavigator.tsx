import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import BootstrapScreen from '../screens/BootstrapScreen'
import MachineRegistrationScreen from '../screens/MachineRegistrationScreen'
import PrinterSelectionScreen from '../screens/PrinterSelectionScreen'
import LoginScreen from '../screens/LoginScreen'
import MainPosScreen from '../screens/MainPosScreen'
import CheckoutScreen from '../screens/CheckoutScreen'
import XReportScreen from '../screens/XReportScreen'
import ZReportScreen from '../screens/ZReportScreen'
import UtilitiesScreen from '../screens/UtilitiesScreen'
import type { RootStackParamList } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function RootNavigator() {
  return (
    <NavigationContainer>
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
        <Stack.Screen name="MainPos" component={MainPosScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
        <Stack.Screen name="XReport" component={XReportScreen} options={{ title: 'X Report' }} />
        <Stack.Screen name="ZReport" component={ZReportScreen} options={{ title: 'Z Report' }} />
        <Stack.Screen name="Utilities" component={UtilitiesScreen} options={{ title: 'Utilities' }} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
