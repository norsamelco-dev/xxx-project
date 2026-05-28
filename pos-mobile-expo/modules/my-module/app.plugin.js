const { withAndroidManifest } = require('@expo/config-plugins')

const PERMISSIONS = [
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_ADMIN',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_SCAN',
]

function addPermissions(androidManifest) {
  const manifest = androidManifest.manifest
  if (!manifest['uses-permission']) {
    manifest['uses-permission'] = []
  }

  const existing = new Set(
    manifest['uses-permission'].map((entry) => entry.$?.['android:name']).filter(Boolean),
  )

  for (const permission of PERMISSIONS) {
    if (!existing.has(permission)) {
      manifest['uses-permission'].push({ $: { 'android:name': permission } })
    }
  }

  return androidManifest
}

module.exports = function withLindaPrinter(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = addPermissions(config.modResults)
    return config
  })
}
