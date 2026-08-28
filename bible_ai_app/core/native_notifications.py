"""
Module de notification système native Windows pour Open Shema.
Permet d'afficher des notifications Windows 10/11 (Toast) ou BalloonTip
de façon asynchrone (thread d'arrière-plan non bloquant).
"""

import subprocess
import threading
import base64
import logging

logger = logging.getLogger("native_notifications")

def send_windows_toast(title: str, message: str) -> bool:
    """
    Affiche une notification système Windows dans un thread d'arrière-plan.
    Utilise PowerShell avec encodage UTF-8 Base64 pour une fiabilité totale.
    """
    def _worker():
        try:
            # Encodage Base64 pour éviter tout problème d'échappement de caractères spéciaux
            title_b64 = base64.b64encode((title or "Open Shema").encode('utf-8')).decode('ascii')
            msg_b64 = base64.b64encode((message or "").encode('utf-8')).decode('ascii')

            ps_script = f'''
            $title = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("{title_b64}"))
            $msg = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("{msg_b64}"))
            $shown = $false
            try {{
                [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
                [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
                $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
                $xmlContent = @"
<toast>
    <visual>
        <binding template="ToastGeneric">
            <text>$title</text>
            <text>$msg</text>
        </binding>
    </visual>
</toast>
"@
                $xml.LoadXml($xmlContent)
                $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
                $appId = '{{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}}\\WindowsPowerShell\\v1.0\\powershell.exe'
                [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
                $shown = $true
            }} catch {{}}

            if (-not $shown) {{
                try {{
                    Add-Type -AssemblyName System.Windows.Forms
                    $notify = New-Object System.Windows.Forms.NotifyIcon
                    $notify.Icon = [System.Drawing.SystemIcons]::Information
                    $notify.BalloonTipTitle = $title
                    $notify.BalloonTipText = $msg
                    $notify.Visible = $true
                    $notify.ShowBalloonTip(4000)
                    Start-Sleep -Seconds 4
                    $notify.Dispose()
                }} catch {{}}
            }}
            '''
            CREATE_NO_WINDOW = 0x08000000
            subprocess.run(
                ['powershell', '-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps_script],
                capture_output=True, text=True, creationflags=CREATE_NO_WINDOW, timeout=8
            )
        except Exception as e:
            logger.debug("Erreur lors de l'envoi de la notification système Windows: %s", e)

    t = threading.Thread(target=_worker, daemon=True)
    t.start()
    return True
