export type RootStackParamList = {
  Bootstrap: undefined
  MachineRegistration: undefined
  PrinterSelection: { config: import('../types/config').PosConfig }
  Login: undefined
  ConnectionError: undefined
  MainPos: undefined
  SalesTransactions: { seriesNo?: string } | undefined
  Utilities: undefined
}
