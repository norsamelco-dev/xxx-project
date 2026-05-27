const express = require('express')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile } = require('child_process')
const { promisify } = require('util')
const { buildLogoEscPosBuffer } = require('../utils/escPosLogo')

const execFileAsync = promisify(execFile)
const router = express.Router()

function isLocalRequest(request) {
  const ip = String(request.ip || '')
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.endsWith('127.0.0.1')
  )
}

async function listWindowsPrinters() {
  if (process.platform !== 'win32') {
    return []
  }

  const { stdout } = await execFileAsync(
    'powershell',
    ['-NoProfile', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'],
    { encoding: 'utf8', timeout: 15000, windowsHide: true },
  )

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

async function printRawWindows(printerName, tempFile) {
  const escapedPrinter = printerName.replace(/'/g, "''")
  const escapedFile = tempFile.replace(/'/g, "''")
  const script = `
$printerName = '${escapedPrinter}'
$filePath = '${escapedFile}'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public class DOCINFOW
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOW di);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string printerName, byte[] bytes)
    {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOW di = new DOCINFOW();
        di.pDocName = "Linda POS Receipt";
        di.pDataType = "RAW";
        IntPtr unmanagedBytes = IntPtr.Zero;

        try
        {
            if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
            if (!StartDocPrinter(hPrinter, 1, di)) return false;
            if (!StartPagePrinter(hPrinter)) return false;

            unmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
            Marshal.Copy(bytes, 0, unmanagedBytes, bytes.Length);

            int written;
            if (!WritePrinter(hPrinter, unmanagedBytes, bytes.Length, out written)) return false;
            if (written != bytes.Length) return false;

            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
            ClosePrinter(hPrinter);
            return true;
        }
        finally
        {
            if (unmanagedBytes != IntPtr.Zero) Marshal.FreeCoTaskMem(unmanagedBytes);
            if (hPrinter != IntPtr.Zero) ClosePrinter(hPrinter);
        }
    }
}
"@

$bytes = [System.IO.File]::ReadAllBytes($filePath)
if (-not [RawPrinterHelper]::SendBytesToPrinter($printerName, $bytes)) {
  throw "RAW print failed for printer: $printerName"
}
`

  await execFileAsync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8', timeout: 30000, windowsHide: true },
  )
}

router.get('/printers', async (request, response) => {
  if (!isLocalRequest(request)) {
    return response.status(403).json({
      error: 'Installed printers can only be listed from this computer.',
    })
  }

  if (process.platform !== 'win32') {
    return response.json({ data: [] })
  }

  try {
    const names = await listWindowsPrinters()
    return response.json({
      data: names.map((name) => ({
        id: name,
        name,
        connectionType: 'system',
      })),
    })
  } catch (error) {
    return response.status(500).json({
      error: error.message || 'Failed to list installed printers.',
    })
  }
})

router.post('/print', async (request, response) => {
  if (!isLocalRequest(request)) {
    return response.status(403).json({
      error: 'Local printing is only available on this computer.',
    })
  }

  if (process.platform !== 'win32') {
    return response.status(400).json({
      error: 'Local printing is only supported on Windows.',
    })
  }

  const printerName = String(request.body?.printerName || '').trim()
  const text = String(request.body?.text || '')

  if (!printerName || !text) {
    return response.status(400).json({
      error: 'printerName and text are required.',
    })
  }

  try {
    const tempFile = path.join(os.tmpdir(), `pos-print-${Date.now()}.bin`)
    const normalized = text.replace(/\r?\n/g, '\r\n')
    const textBuffer = Buffer.from(normalized, 'utf8')
    const heading = request.body?.heading || null
    let printBuffer = textBuffer

    if (heading) {
      const logoBuffer = await buildLogoEscPosBuffer(heading)
      if (logoBuffer) {
        printBuffer = Buffer.concat([logoBuffer, textBuffer])
      }
    }

    fs.writeFileSync(tempFile, printBuffer)

    await printRawWindows(printerName, tempFile)

    try {
      fs.unlinkSync(tempFile)
    } catch {
      // ignore cleanup errors
    }

    return response.json({ ok: true })
  } catch (error) {
    return response.status(500).json({
      error: error.message || 'Failed to print.',
    })
  }
})

module.exports = router
