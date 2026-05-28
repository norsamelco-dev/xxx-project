package expo.modules.lindaprinter

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.hardware.usb.UsbManager
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

class LindaPrinterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LindaPrinter")

    AsyncFunction("getPrinters") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, String>>()
      val printers = mutableListOf<Map<String, String>>()
      printers.addAll(getBondedBluetoothPrinters(context))
      printers.addAll(getUsbDevices(context))
      printers
    }

    AsyncFunction("printRawText") { printerId: String, text: String, promise: Promise ->
      Thread {
        try {
          printToBluetooth(printerId, text)
          promise.resolve(null)
        } catch (error: Exception) {
          promise.reject("PRINT_FAILED", error.message ?: "Print failed.", error)
        }
      }.start()
    }
  }

  private fun getBondedBluetoothPrinters(context: Context): List<Map<String, String>> {
    val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    val adapter: BluetoothAdapter = manager?.adapter ?: return emptyList()

    if (!adapter.isEnabled) {
      return emptyList()
    }

    return adapter.bondedDevices
      ?.map { device ->
        mapOf(
          "id" to device.address,
          "name" to (device.name ?: device.address),
          "connectionType" to "bluetooth",
        )
      }
      ?.sortedBy { it["name"]?.lowercase() }
      ?: emptyList()
  }

  private fun getUsbDevices(context: Context): List<Map<String, String>> {
    val usbManager = context.getSystemService(Context.USB_SERVICE) as? UsbManager ?: return emptyList()

    return usbManager.deviceList.values.map { device ->
      val productName = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        device.productName
      } else {
        null
      }

      val label = listOfNotNull(device.manufacturerName, productName, "USB device")
        .joinToString(" ")
        .trim()
        .ifBlank { "USB device ${device.deviceId}" }

      mapOf(
        "id" to "usb:${device.deviceId}",
        "name" to label,
        "connectionType" to "usb",
      )
    }
  }

  private fun printToBluetooth(printerId: String, text: String) {
    val adapter = BluetoothAdapter.getDefaultAdapter()
      ?: throw IllegalStateException("Bluetooth is not available on this device.")

    if (!adapter.isEnabled) {
      throw IllegalStateException("Bluetooth is turned off.")
    }

    val device = adapter.getRemoteDevice(printerId)
    val uuid = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    val socket = device.createRfcommSocketToServiceRecord(uuid)

    socket.use { connectedSocket ->
      connectedSocket.connect()
      connectedSocket.outputStream.use { stream ->
        stream.write(text.toByteArray(Charsets.UTF_8))
        stream.write(byteArrayOf(0x0A, 0x0A, 0x0A))
        stream.flush()
      }
    }
  }
}
